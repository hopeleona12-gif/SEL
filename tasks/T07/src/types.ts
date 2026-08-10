export type Condition = 'A' | 'B'
export type Phase = 'entry' | 'adjustment'
export type PromptLevel = 'P0' | 'P1' | 'P2'

export type ResponseRecord = {
  task_id: 'T07'
  condition: Condition
  phase: Phase
  selected_option: 1 | 2 | 3 | 4
  correctness: boolean
  prompt_level: PromptLevel
  reaction_time: number
  timeout: boolean
  answered_at: string
}

export type Result = {
  task_id: 'T07'
  responses: ResponseRecord[]
  condition_scores: Record<Condition, number>
  task_score: number
  scoring_formula: 'T07=mean(A,B)'
}
