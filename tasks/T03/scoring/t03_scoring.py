from collections.abc import Sequence
from statistics import mean, pstdev

from .base import ScoringResult, TrialResult


def score_t03(responses: Sequence[TrialResult]) -> ScoringResult:
    """Score T03 test trials. Accuracy values are stored as proportions (0-1)."""
    go_trials = [item for item in responses if item.stimulus == "dong"]
    no_go_trials = [item for item in responses if item.stimulus == "ding"]
    if not go_trials or not no_go_trials:
        raise ValueError("T03 scoring requires both Go and No-Go trials")

    go_correct = sum(
        item.correct and item.actual_response == "click" for item in go_trials
    )
    no_go_correct = sum(
        item.correct and item.actual_response == "no_click" for item in no_go_trials
    )
    go_accuracy = go_correct / len(go_trials)
    no_go_accuracy = no_go_correct / len(no_go_trials)
    condition_scores: dict[str, float] = {}
    for condition in ("quiet", "distractor"):
        condition_go = [item for item in go_trials if item.condition == condition]
        condition_no_go = [item for item in no_go_trials if item.condition == condition]
        if not condition_go or not condition_no_go:
            raise ValueError(f"T03 scoring requires Go and No-Go trials in {condition}")
        condition_scores[condition] = (
            sum(item.correct for item in condition_go) / len(condition_go)
            + sum(item.correct for item in condition_no_go) / len(condition_no_go)
        ) / 2 * 100
    score = round(mean(condition_scores.values()), 1)
    go_rts = [
        item.reaction_time_ms for item in go_trials
        if item.actual_response == "click" and item.reaction_time_ms is not None
    ]
    return ScoringResult(
        score=score,
        go_accuracy=go_accuracy,
        no_go_accuracy=no_go_accuracy,
        scored_trial_count=len(responses),
        quiet_score=round(condition_scores["quiet"], 1),
        distractor_score=round(condition_scores["distractor"], 1),
        go_omissions=sum(item.actual_response == "no_click" for item in go_trials),
        no_go_false_alarms=sum(item.actual_response == "click" for item in no_go_trials),
        mean_go_reaction_time_ms=round(mean(go_rts), 1) if go_rts else None,
        go_reaction_time_sd_ms=round(pstdev(go_rts), 1) if len(go_rts) > 1 else None,
    )
