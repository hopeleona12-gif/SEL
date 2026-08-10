import type { Condition, Phase } from './types'

export const taskConfig = {
  task_id: 'T07' as const,
  prompt_after_ms: 8000,
  option_animation_ms: 2400,
  scenes: {
    A: {
      label: '搭城堡',
      observe: '小兔和小熊正在按照图纸搭城堡。',
      entryQuestion: '你想一起搭城堡。你会怎么做？',
      peerResponse: '可以。等我们把墙放好，再轮到你放屋顶。',
      entry: ['先看看图纸，再问“我可以一起搭吗？”', '站在旁边等待', '直接拿走屋顶积木', '转身离开'],
      adjustment: ['在旁边等待，墙搭好后接过屋顶', '马上抢走屋顶', '改变同伴已经搭好的墙', '离开'],
    },
    B: {
      label: '画森林海报',
      observe: '小兔和小熊正在一起画森林海报，右下角还空着。',
      entryQuestion: '你也想参加。你会怎么做？',
      peerResponse: '可以，你来画右下角的小花。蓝色蜡笔要等小熊用完。',
      entry: ['先看看海报，再问“我可以一起画吗？”', '站在旁边等待', '直接在海报中间画', '拿走蓝色蜡笔离开'],
      adjustment: ['先用可用颜色画右下角小花，并等待蓝笔', '立刻抢蓝色蜡笔', '画到同伴已经完成的区域', '离开'],
    },
  } satisfies Record<Condition, {
    label: string; observe: string; entryQuestion: string; peerResponse: string;
    entry: string[]; adjustment: string[]
  }>,
}

export const questionFor = (condition: Condition, phase: Phase) =>
  phase === 'entry' ? taskConfig.scenes[condition].entryQuestion : '接下来你会怎么做？'
