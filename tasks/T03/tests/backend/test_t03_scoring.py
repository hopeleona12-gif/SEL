import unittest

from scoring.base import TrialResult
from scoring.t03_scoring import score_t03


class T03ScoringTests(unittest.TestCase):
    @staticmethod
    def balanced_responses(correct=True):
        rows = []
        for condition in ("quiet", "distractor"):
            rows.extend([
                TrialResult("dong", "click" if correct else "no_click", correct, condition, 500),
                TrialResult("dong", "click" if correct else "no_click", correct, condition, 600),
                TrialResult("ding", "no_click" if correct else "click", correct, condition),
            ])
        return rows

    def test_perfect_score(self):
        result = score_t03(self.balanced_responses())
        self.assertEqual(result.score, 100.0)
        self.assertEqual(result.go_accuracy, 1.0)
        self.assertEqual(result.no_go_accuracy, 1.0)
        self.assertEqual(result.quiet_score, 100.0)
        self.assertEqual(result.distractor_score, 100.0)
        self.assertEqual(result.mean_go_reaction_time_ms, 550.0)

    def test_balanced_formula(self):
        result = score_t03([
            TrialResult("dong", "click", True, "quiet", 500),
            TrialResult("dong", "no_click", False, "quiet"),
            TrialResult("ding", "no_click", True, "quiet"),
            TrialResult("dong", "click", True, "distractor", 700),
            TrialResult("dong", "no_click", False, "distractor"),
            TrialResult("ding", "click", False, "distractor", 400),
        ])
        self.assertEqual(result.score, 50.0)
        self.assertEqual(result.quiet_score, 75.0)
        self.assertEqual(result.distractor_score, 25.0)
        self.assertEqual(result.go_omissions, 2)
        self.assertEqual(result.no_go_false_alarms, 1)
        self.assertEqual(result.scored_trial_count, 6)

    def test_requires_both_trial_types(self):
        with self.assertRaises(ValueError):
            score_t03([TrialResult("dong", "click", True)])


if __name__ == "__main__":
    unittest.main()
