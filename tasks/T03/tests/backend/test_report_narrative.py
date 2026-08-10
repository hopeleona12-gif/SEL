import unittest

from reports.generators import build_interpretation


class ReportNarrativeTests(unittest.TestCase):
    def test_high_inhibition_language(self):
        report = build_interpretation(1.0, 1.0)
        self.assertIn("较好控制冲动反应", report.interpretation)

    def test_low_inhibition_language(self):
        report = build_interpretation(1.0, 0.25)
        self.assertIn("仍需要支持", report.interpretation)

    def test_low_go_adds_support(self):
        report = build_interpretation(0.25, 0.75)
        self.assertIn("声音线索反应不够稳定", report.interpretation)
        self.assertEqual(len(report.support_suggestions), 3)
