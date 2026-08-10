import type { Condition, ResponseRecord, Result } from './types'

export function scoreCondition(records: ResponseRecord[], condition: Condition): number {
  const items = records.filter(item => item.condition === condition)
  if (items.length !== 2) throw new Error(`情境 ${condition} 需要 entry 与 adjustment 两次作答`)
  const correct = items.filter(item => item.correctness).length
  if (correct === 2 && items.every(item => item.prompt_level !== 'P2')) return 2
  if (correct >= 1) return 1
  return 0
}

export function scoreTask(responses: ResponseRecord[]): Result {
  const A = scoreCondition(responses, 'A')
  const B = scoreCondition(responses, 'B')
  return {
    task_id: 'T07',
    responses,
    condition_scores: { A, B },
    task_score: (A + B) / 2,
    scoring_formula: 'T07=mean(A,B)',
  }
}
