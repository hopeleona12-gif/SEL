from dataclasses import dataclass
from typing import Protocol, Sequence


@dataclass(frozen=True)
class TrialResult:
    stimulus: str
    actual_response: str
    correct: bool
    condition: str = "quiet"
    reaction_time_ms: int | None = None


@dataclass(frozen=True)
class ScoringResult:
    score: float
    go_accuracy: float
    no_go_accuracy: float
    scored_trial_count: int
    quiet_score: float
    distractor_score: float
    go_omissions: int
    no_go_false_alarms: int
    mean_go_reaction_time_ms: float | None
    go_reaction_time_sd_ms: float | None


class Scorer(Protocol):
    def __call__(self, responses: Sequence[TrialResult]) -> ScoringResult: ...
