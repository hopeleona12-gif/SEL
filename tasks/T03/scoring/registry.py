from collections.abc import Sequence

from .base import ScoringResult, Scorer, TrialResult
from .t03_scoring import score_t03

SCORERS: dict[str, Scorer] = {"t03_go_nogo": score_t03}


def score_task(strategy: str, responses: Sequence[TrialResult]) -> ScoringResult:
    try:
        scorer = SCORERS[strategy]
    except KeyError as exc:
        raise ValueError(f"Unknown scoring strategy: {strategy}") from exc
    return scorer(responses)
