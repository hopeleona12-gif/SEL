from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Child(Base):
    __tablename__ = "child"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    age: Mapped[float] = mapped_column(Float)
    participant_group: Mapped[str] = mapped_column(String(64), default="unspecified")
    created_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class AssessmentSession(Base):
    __tablename__ = "assessment_session"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("child.child_id"), index=True)
    task_id: Mapped[str] = mapped_column(String(16), index=True)
    age_at_assessment: Mapped[float] = mapped_column(Float)
    participant_group: Mapped[str] = mapped_column(String(64), default="unspecified")
    status: Mapped[str] = mapped_column(String(20), default="created")
    practice_error_count: Mapped[int] = mapped_column(Integer, default=0)
    task_config_version: Mapped[str] = mapped_column(String(32))
    started_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Response(Base):
    __tablename__ = "response"
    __table_args__ = (
        UniqueConstraint("session_id", "trial_id", "phase", "practice_attempt_no"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("assessment_session.session_id"), index=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("child.child_id"), index=True)
    task_id: Mapped[str] = mapped_column(String(16))
    trial_id: Mapped[str] = mapped_column(String(32))
    trial_order: Mapped[int] = mapped_column(Integer)
    phase: Mapped[str] = mapped_column(String(16))
    practice_attempt_no: Mapped[int] = mapped_column(Integer, default=1)
    condition: Mapped[str] = mapped_column(String(16), default="quiet")
    stimulus: Mapped[str] = mapped_column(String(32))
    expected_response: Mapped[str] = mapped_column(String(16))
    actual_response: Mapped[str] = mapped_column(String(16))
    correct: Mapped[bool] = mapped_column(Boolean)
    accuracy: Mapped[bool] = mapped_column(Boolean, default=False)
    stimulus_onset: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sound_onset: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stimulus_started_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    response_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reaction_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Score(Base):
    __tablename__ = "score"
    __table_args__ = (UniqueConstraint("session_id", "task_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("assessment_session.session_id"))
    child_id: Mapped[str] = mapped_column(ForeignKey("child.child_id"))
    task_id: Mapped[str] = mapped_column(String(16))
    dimension: Mapped[str] = mapped_column(String(32))
    score: Mapped[float] = mapped_column(Float)
    go_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    no_go_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    scored_trial_count: Mapped[int] = mapped_column(Integer)
    scoring_version: Mapped[str] = mapped_column(String(32))
    quiet_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    distractor_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    go_omissions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    no_go_false_alarms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mean_go_reaction_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    go_reaction_time_sd_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
