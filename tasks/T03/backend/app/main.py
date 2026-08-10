import json
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import Base, engine, ensure_schema_compatibility, get_db
from scoring import score_task
from scoring.base import TrialResult
from reports.generators import build_interpretation

from .models import AssessmentSession, Child, Response, Score
from .schemas import (
    AssessmentCreate, ChildCreate, ReportAssessment, ReportChild, ResponseCreate,
    ScoreRead, SelDimensions, SelReport, TaskPerformance,
)

ROOT = Path(__file__).resolve().parents[2]
TASKS_DIR = ROOT / "tasks"

app = FastAPI(title="SEL Assessment API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:4170"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()


def load_task(task_id: str) -> dict:
    path = TASKS_DIR / f"{task_id}.json"
    if not path.exists():
        raise HTTPException(404, "任务不存在")
    task = json.loads(path.read_text(encoding="utf-8"))
    prefix = os.getenv("SEL_ASSET_PREFIX", "")
    if prefix:
        def rewrite(value):
            return value.replace("/assets/tasks/T03/", prefix.rstrip("/") + "/") if isinstance(value, str) else value
        task["assets"] = {key: rewrite(value) for key, value in task.get("assets", {}).items()}
        for phase in ("practice_trials", "test_trials"):
            for trial in task.get(phase, []):
                if "distractor_video" in trial:
                    trial["distractor_video"] = rewrite(trial["distractor_video"])
    return task


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


@app.post("/api/v1/children")
def create_child(payload: ChildCreate, db: Session = Depends(get_db)):
    child = db.scalar(select(Child).where(Child.child_id == payload.child_id))
    if child:
        child.age = payload.age
        if payload.participant_group is not None:
            child.participant_group = payload.participant_group
    else:
        child = Child(
            child_id=payload.child_id,
            age=payload.age,
            participant_group=payload.participant_group or "unspecified",
        )
        db.add(child)
    db.commit()
    db.refresh(child)
    return child


@app.get("/api/v1/tasks/{task_id}")
def get_task(task_id: str):
    return load_task(task_id)


@app.post("/api/v1/assessments")
def create_assessment(payload: AssessmentCreate, db: Session = Depends(get_db)):
    child = db.scalar(select(Child).where(Child.child_id == payload.child_id))
    if not child:
        raise HTTPException(404, "儿童记录不存在")
    task = load_task(payload.task_id)
    session = AssessmentSession(
        session_id=str(uuid4()), child_id=payload.child_id, task_id=payload.task_id,
        age_at_assessment=child.age,
        participant_group=child.participant_group,
        task_config_version=task["config_version"]
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@app.post("/api/v1/assessments/{session_id}/start")
def start_assessment(session_id: str, db: Session = Depends(get_db)):
    session = db.scalar(select(AssessmentSession).where(AssessmentSession.session_id == session_id))
    if not session:
        raise HTTPException(404, "测评会话不存在")
    session.status = "running"
    session.started_time = datetime.now(timezone.utc)
    db.commit()
    return {"session_id": session_id, "status": session.status}


@app.post("/api/v1/assessments/{session_id}/responses", status_code=201)
def save_response(session_id: str, payload: ResponseCreate, db: Session = Depends(get_db)):
    session = db.scalar(select(AssessmentSession).where(AssessmentSession.session_id == session_id))
    if not session or session.status != "running":
        raise HTTPException(409, "测评会话未运行")
    task = load_task(session.task_id)
    trials = task[f"{payload.phase}_trials"]
    trial = next((item for item in trials if item["trial_id"] == payload.trial_id), None)
    if (
        not trial
        or trial["stimulus"] != payload.stimulus
        or trial["condition"] != payload.condition
    ):
        raise HTTPException(422, "trial 与任务配置不一致")
    expected = "click" if payload.stimulus == "dong" else "no_click"
    accuracy = payload.actual_response == expected
    record = Response(
        session_id=session_id, child_id=session.child_id, task_id=session.task_id,
        expected_response=expected,
        correct=accuracy,
        accuracy=accuracy,
        stimulus_started_time=payload.stimulus_onset,
        **payload.model_dump()
    )
    if payload.phase == "practice" and not accuracy:
        session.practice_error_count += 1
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "trial 已记录")
    return {"saved": True, "trial_id": payload.trial_id}


@app.post("/api/v1/assessments/{session_id}/abort")
def abort_assessment(session_id: str, db: Session = Depends(get_db)):
    session = db.scalar(select(AssessmentSession).where(AssessmentSession.session_id == session_id))
    if not session:
        raise HTTPException(404, "Assessment session not found")
    if session.status in {"created", "running"}:
        session.status = "aborted"
        db.commit()
    return {"session_id": session_id, "status": session.status}


@app.post("/api/v1/assessments/{session_id}/complete")
def complete_assessment(session_id: str, db: Session = Depends(get_db)):
    session = db.scalar(select(AssessmentSession).where(AssessmentSession.session_id == session_id))
    if not session:
        raise HTTPException(404, "测评会话不存在")
    task = load_task(session.task_id)
    responses = db.scalars(select(Response).where(
        Response.session_id == session_id, Response.phase == "test"
    ).order_by(Response.trial_order)).all()
    if len(responses) != len(task["test_trials"]):
        raise HTTPException(409, "正式测评数据不完整")
    existing_score = db.scalar(select(Score).where(
        Score.session_id == session_id, Score.task_id == session.task_id
    ))
    if existing_score:
        return {
            "session_id": session_id, "status": session.status,
            "score": existing_score.score,
            "score_available": True, "report_available": False,
        }
    try:
        result = score_task(task["scoring_strategy"], [
            TrialResult(
                item.stimulus, item.actual_response, item.correct,
                item.condition, item.reaction_time_ms,
            )
            for item in responses
        ])
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    db.add(Score(
        session_id=session_id,
        child_id=session.child_id,
        task_id=session.task_id,
        dimension=task["dimension"],
        score=result.score,
        go_accuracy=result.go_accuracy,
        no_go_accuracy=result.no_go_accuracy,
        scored_trial_count=result.scored_trial_count,
        scoring_version=task["scoring_version"],
        quiet_score=result.quiet_score,
        distractor_score=result.distractor_score,
        go_omissions=result.go_omissions,
        no_go_false_alarms=result.no_go_false_alarms,
        mean_go_reaction_time_ms=result.mean_go_reaction_time_ms,
        go_reaction_time_sd_ms=result.go_reaction_time_sd_ms,
    ))
    session.status = "completed"
    session.completed_time = datetime.now(timezone.utc)
    db.commit()
    return {
        "session_id": session_id, "status": "completed",
        "score": result.score,
        "score_available": True, "report_available": False,
    }


@app.get("/api/v1/assessments/{session_id}/score", response_model=ScoreRead)
def get_score(session_id: str, db: Session = Depends(get_db)):
    score = db.scalar(select(Score).where(Score.session_id == session_id))
    if not score:
        raise HTTPException(404, "评分结果不存在")
    return score


@app.get("/api/v1/reports/{session_id}", response_model=SelReport)
def get_report(session_id: str, db: Session = Depends(get_db)):
    session = db.scalar(select(AssessmentSession).where(
        AssessmentSession.session_id == session_id
    ))
    if not session or session.status != "completed" or not session.completed_time:
        raise HTTPException(409, "测评尚未完成")
    child = db.scalar(select(Child).where(Child.child_id == session.child_id))
    score = db.scalar(select(Score).where(Score.session_id == session_id))
    if not child or not score or score.go_accuracy is None or score.no_go_accuracy is None:
        raise HTTPException(404, "报告数据不存在")
    task = load_task(session.task_id)
    narrative = build_interpretation(score.go_accuracy, score.no_go_accuracy)
    return SelReport(
        child=ReportChild(child_id=child.child_id, age=session.age_at_assessment),
        assessment=ReportAssessment(
            session_id=session.session_id,
            task_id=session.task_id,
            task_name=task["name"],
            completed_time=session.completed_time,
        ),
        sel_dimensions=SelDimensions(self_management=score.score),
        task_performance=TaskPerformance(
            score=score.score,
            go_accuracy=score.go_accuracy,
            no_go_accuracy=score.no_go_accuracy,
            quiet_score=score.quiet_score,
            distractor_score=score.distractor_score,
            go_omissions=score.go_omissions,
            no_go_false_alarms=score.no_go_false_alarms,
            mean_go_reaction_time_ms=score.mean_go_reaction_time_ms,
            go_reaction_time_sd_ms=score.go_reaction_time_sd_ms,
        ),
        interpretation=narrative.interpretation,
        support_suggestions=narrative.support_suggestions,
        disclaimer="本结果仅反映本次任务中的行为表现，不作为医学或临床诊断依据。",
    )
