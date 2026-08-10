from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ChildCreate(BaseModel):
    child_id: str = Field(min_length=1, max_length=64)
    age: float = Field(gt=0, le=30)
    participant_group: str | None = Field(default=None, min_length=1, max_length=64)


class AssessmentCreate(BaseModel):
    child_id: str
    task_id: str


class ResponseCreate(BaseModel):
    trial_id: str
    trial_order: int = Field(ge=1)
    phase: Literal["practice", "test"]
    practice_attempt_no: int = Field(default=1, ge=1)
    condition: Literal["quiet", "distractor"]
    stimulus: Literal["dong", "ding"]
    actual_response: Literal["click", "no_click"]
    stimulus_onset: datetime
    sound_onset: datetime
    response_time: datetime | None = None
    reaction_time_ms: int | None = Field(default=None, ge=0)


class ScoreRead(BaseModel):
    session_id: str
    child_id: str
    task_id: str
    dimension: str
    score: float
    go_accuracy: float
    no_go_accuracy: float
    scored_trial_count: int
    scoring_version: str
    quiet_score: float | None
    distractor_score: float | None
    go_omissions: int | None
    no_go_false_alarms: int | None
    mean_go_reaction_time_ms: float | None
    go_reaction_time_sd_ms: float | None


class ReportChild(BaseModel):
    child_id: str
    age: float


class ReportAssessment(BaseModel):
    session_id: str
    task_id: str
    task_name: str
    completed_time: datetime


class SelDimensions(BaseModel):
    self_awareness: float | None = None
    self_management: float | None = None
    social_awareness: float | None = None
    relationship: float | None = None
    responsible_decision: float | None = None


class TaskPerformance(BaseModel):
    score: float
    go_accuracy: float
    no_go_accuracy: float
    quiet_score: float | None
    distractor_score: float | None
    go_omissions: int | None
    no_go_false_alarms: int | None
    mean_go_reaction_time_ms: float | None
    go_reaction_time_sd_ms: float | None


class SelReport(BaseModel):
    child: ReportChild
    assessment: ReportAssessment
    sel_dimensions: SelDimensions
    task_performance: TaskPerformance
    interpretation: str
    support_suggestions: list[str]
    disclaimer: str
