const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const statusOf = (raw, score, validity) => {
  if (validity === 'INV' || raw?.validity === 'INV' || raw?.status === 'INV') return 'INV';
  if (score === null) return raw?.score_status || 'score_missing';
  return 'available';
};
const mean = values => values.every(value => typeof value === 'number') ? values.reduce((a,b) => a+b, 0) / values.length : null;

export function normalizeTaskResult(taskId, rawResult = {}, context = {}) {
  const raw = rawResult && typeof rawResult === 'object' ? rawResult : {};
  const validity = raw.validity || raw.status || null;
  let finalScore = null;
  let subscores = {};
  if (taskId === 'T01-A' || taskId === 'T01-B') {
    const emotion = number(raw.emotion?.score);
    const cause = number(raw.cause?.score);
    subscores = { emotion_score: emotion, cause_score: cause, T01_E: null, T01_C: null };
  } else if (taskId === 'T02') {
    finalScore = number(raw.T02_total_score);
    subscores = { A_score: number(raw.A_score ?? raw.T02_A_score), B_score: number(raw.B_score ?? raw.T02_B_score) };
  } else if (taskId === 'T03') {
    const rawPercent = number(raw.raw_score_percent ?? raw.T03_score ?? raw.score);
    finalScore = rawPercent === null ? null : rawPercent / 100 * 2;
    subscores = { raw_score_percent: rawPercent, quiet_score: number(raw.quiet_score), distractor_score: number(raw.distractor_score) };
  } else if (taskId === 'T05') {
    const a = number(raw.T05A_score ?? raw.T05A?.score);
    const b = number(raw.T05B_score ?? raw.T05B?.score);
    subscores = { T05A_score: a, T05B_score: b, T05_dimension_input: a !== null && b !== null ? (a + b) / 2 : null };
  } else if (taskId === 'T06') {
    subscores = { T06A_score: number(raw.T06A_score), T06B_score: number(raw.T06B_score) };
    finalScore = mean([subscores.T06A_score, subscores.T06B_score]);
  } else if (taskId === 'T07') {
    subscores = { A_score: number(raw.condition_scores?.A ?? raw.subscores?.A), B_score: number(raw.condition_scores?.B ?? raw.subscores?.B) };
    finalScore = number(raw.T07_score ?? raw.task_score ?? raw.score);
  } else if (taskId === 'T08') {
    finalScore = number(raw.T08_total_score);
    subscores = { T08_A_score: number(raw.T08_A_score), T08_B_score: number(raw.T08_B_score) };
  } else if (taskId === 'T09') {
    finalScore = number(raw.total_score);
    subscores = { A_score: number(raw.scenarios?.A?.score), B_score: number(raw.scenarios?.B?.score), A_validity: raw.scenarios?.A?.status || null, B_validity: raw.scenarios?.B?.status || null };
  } else if (taskId === 'T10') {
    finalScore = number(raw.T10_score ?? raw.score);
    subscores = { A_score: number(raw.A_score), B_score: number(raw.B_score) };
  } else if (taskId === 'T04') {
    finalScore = number(raw.T04_score ?? raw.score);
    subscores = { A_score: number(raw.T04_strategy1_score), B_score: number(raw.T04_strategy2_score) };
  }
  return { task_id: taskId, final_score: finalScore, score_status: statusOf(raw, finalScore, validity), validity, subscores, raw_result: raw, assessment_session_id: context.assessment_session_id || raw.assessment_session_id || null, participant_id: context.participant_id || raw.participant_id || null };
}
