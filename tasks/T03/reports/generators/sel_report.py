from dataclasses import dataclass


@dataclass(frozen=True)
class Narrative:
    interpretation: str
    support_suggestions: list[str]


def build_interpretation(go_accuracy: float, no_go_accuracy: float) -> Narrative:
    """Generate neutral, educational language from accuracy proportions."""
    if no_go_accuracy >= 0.8:
        interpretation = "儿童能够较好控制冲动反应，在明确规则条件下保持行为控制。"
        suggestions = [
            "可继续通过规则转换游戏，练习在不同情境中灵活保持行为控制。",
            "在日常活动中给予短暂等待机会，巩固先听规则、再行动的习惯。",
        ]
    elif no_go_accuracy >= 0.6:
        interpretation = "儿童基本能够按照规则停止反应，但在部分试次中仍需要更多时间保持控制。"
        suggestions = [
            "建议通过等待游戏和停止—行动游戏，逐步延长停止反应的时间。",
            "使用简短、稳定的口头提示，帮助儿童在行动前回忆规则。",
        ]
    else:
        interpretation = "儿童能够参与并理解任务要求，但在停止反应方面仍需要支持。"
        suggestions = [
            "建议通过等待游戏、红灯绿灯和停止—行动游戏提升行为抑制能力。",
            "练习时先缩短等待时间，成功后再逐步增加难度，并给予具体鼓励。",
        ]

    if go_accuracy < 0.6:
        interpretation += " 同时，儿童对需要行动的声音线索反应不够稳定，可能需要更清晰的提示和重复练习。"
        suggestions.append("可先使用视觉与声音的组合提示，帮助儿童建立声音规则与行动之间的联系。")
    return Narrative(interpretation, suggestions)
