(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SELReportScores = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const SCORE_MIN = 0;
  const SCORE_MAX = 2;
  const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const round = (value) => value == null ? null : Number(value.toFixed(3));
  const mean = (values) => values.every((value) => number(value) !== null)
    ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
  const at = (obj, path) => path.split('.').reduce((value, key) => value == null ? undefined : value[key], obj);
  const firstNumber = (obj, paths) => {
    for (const path of paths) {
      const value = number(at(obj, path));
      if (value !== null) return value;
    }
    return null;
  };
  const firstText = (obj, paths) => {
    for (const path of paths) {
      const value = at(obj, path);
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  };
  const inRange = (value) => value !== null && value >= SCORE_MIN && value <= SCORE_MAX;
  const task = (tasks, id) => tasks[id] || tasks[id.replace('_', '-')] || {};
  const hasInvalid = (raw) => /^(INV|invalid)$/i.test(firstText(raw, ['validity', 'score_status', 'status'])) || /:\s*"(?:INV|invalid)"/i.test(JSON.stringify(raw || {}));
  const hasPending = (raw) => JSON.stringify(raw || {}).includes('pending_aliyun_semantic_scoring');

  function standard(id, raw, privatePaths, extra = {}) {
    const score = firstNumber(raw, ['final_score', ...privatePaths]);
    const status = hasInvalid(raw) ? 'INV' : score === null ? (firstText(raw, ['score_status']) || 'score_missing') : 'available';
    return { task_id: id, score: inRange(score) ? round(score) : null, score_status: status, ...extra };
  }

  function normalize(session) {
    const tasks = session?.tasks || {};
    const anomalies = [];
    const normalized = {};
    const addAnomaly = (taskId, missingScore, reason, stage = 'report_score_normalization') => {
      anomalies.push({ task_id: taskId, missing_score: missingScore, reason, stage });
    };

    const t01a = task(tasks, 'T01_A');
    const t01b = task(tasks, 'T01_B');
    const t01 = {
      A_emotion: firstNumber(t01a, ['subscores.emotion_score', 'emotion_score', 'emotion.score', 'raw_result.emotion_score', 'raw_result.emotion.score']),
      A_cause: firstNumber(t01a, ['subscores.cause_score', 'cause_score', 'cause.score', 'raw_result.cause_score', 'raw_result.cause.score']),
      B_emotion: firstNumber(t01b, ['subscores.emotion_score', 'emotion_score', 'emotion.score', 'raw_result.emotion_score', 'raw_result.emotion.score']),
      B_cause: firstNumber(t01b, ['subscores.cause_score', 'cause_score', 'cause.score', 'raw_result.cause_score', 'raw_result.cause.score'])
    };
    const t01Pending = hasPending(t01a) || hasPending(t01b);
    const t01Invalid = hasInvalid(t01a) || hasInvalid(t01b);
    const t01E = mean([t01.A_emotion, t01.B_emotion]);
    const t01C = mean([t01.A_cause, t01.B_cause]);
    const t01ReportScore = mean([t01E, t01C]);
    normalized.T01 = { task_id: 'T01', score: t01ReportScore, score_status: t01Invalid ? 'INV' : t01Pending ? 'pending_aliyun_semantic_scoring' : t01ReportScore === null ? 'score_missing' : 'available', subscores: { ...t01, T01_E: t01E, T01_C: t01C } };
    if (t01ReportScore === null) addAnomaly('T01', 'T01_E/T01_C', t01Pending ? '后置阿里云语义评分仍处于 pending 状态' : t01Invalid ? '必要情绪或原因探针为 INV' : 'A/B 情绪或原因正式分缺失', 'T01_post_semantic_scoring');

    normalized.T02 = standard('T02', task(tasks, 'T02'), ['T02_total_score', 'raw_result.T02_total_score', 'score', 'task_score']);

    const t03raw = task(tasks, 'T03');
    const t03Formal = firstNumber(t03raw, ['final_score']);
    let rawPercent = firstNumber(t03raw, ['raw_score_percent', 'subscores.raw_score_percent', 'raw_result.raw_score_percent']);
    if (rawPercent === null) {
      const legacy = firstNumber(t03raw, ['T03_score', 'raw_result.T03_score', 'score', 'task_score']);
      if (legacy !== null && legacy > SCORE_MAX) rawPercent = legacy;
    }
    const t03Score = inRange(t03Formal) ? t03Formal : rawPercent === null ? firstNumber(t03raw, ['T03_score', 'score']) : round(rawPercent / 100 * 2);
    normalized.T03 = { task_id: 'T03', score: inRange(t03Score) ? round(t03Score) : null, score_status: hasInvalid(t03raw) ? 'INV' : inRange(t03Score) ? 'available' : 'score_missing', raw_score_percent: rawPercent };

    normalized.T04 = standard('T04', task(tasks, 'T04'), ['T04_score', 'raw_result.T04_score', 'score', 'task_score']);

    const t05raw = task(tasks, 'T05');
    const t05A = firstNumber(t05raw, ['subscores.T05A_score', 'T05A_score', 'raw_result.T05A_score', 'raw_result.subscores.T05A_score']);
    const t05B = firstNumber(t05raw, ['subscores.T05B_score', 'T05B_score', 'raw_result.T05B_score', 'raw_result.subscores.T05B_score']);
    const t05Score = hasInvalid(t05raw) ? null : mean([t05A, t05B]);
    normalized.T05 = { task_id: 'T05', score: t05Score, score_status: hasInvalid(t05raw) ? 'INV' : t05Score === null ? 'score_missing' : 'available', subscores: { T05A_score: t05A, T05B_score: t05B }, scoring_formula: 'mean(T05A_score, T05B_score)' };

    const t06raw = task(tasks, 'T06');
    const t06A = firstNumber(t06raw, ['subscores.T06A_score', 'T06A_score', 'raw_result.T06A_score']);
    const t06B = firstNumber(t06raw, ['subscores.T06B_score', 'T06B_score', 'raw_result.T06B_score']);
    normalized.T06 = standard('T06', t06raw, ['T06_score', 'raw_result.T06_score', 'score', 'task_score'], { subscores: { T06A_score: t06A, T06B_score: t06B } });
    if (normalized.T06.score === null && !hasInvalid(t06raw)) normalized.T06.score = mean([t06A, t06B]);
    if (normalized.T06.score !== null) normalized.T06.score_status = 'available';

    normalized.T07 = standard('T07', task(tasks, 'T07'), ['T07_score', 'raw_result.T07_score', 'score', 'task_score']);
    normalized.T08 = standard('T08', task(tasks, 'T08'), ['T08_total_score', 'raw_result.T08_total_score', 'score', 'task_score']);
    normalized.T09 = standard('T09', task(tasks, 'T09'), ['total_score', 'raw_result.total_score', 'T09_score', 'score', 'task_score']);
    normalized.T10 = standard('T10', task(tasks, 'T10'), ['T10_score', 'raw_result.T10_score', 'score', 'task_score']);

    for (const id of ['T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10']) {
      if (normalized[id].score === null) addAnomaly(id, `${id}_score`, normalized[id].score_status === 'INV' ? '正式结果为 INV' : '已完成任务未找到可用的正式得分字段');
    }

    const dimensions = {
      self_awareness: mean([normalized.T01.score, normalized.T02.score]),
      self_management: mean([normalized.T03.score, normalized.T04.score]),
      social_awareness: mean([normalized.T05.score, normalized.T06.score]),
      relationship_skills: mean([normalized.T07.score, normalized.T08.score]),
      responsible_decision: mean([normalized.T09.score, normalized.T10.score])
    };
    const totalScore = mean(Object.values(dimensions));
    if (Object.values(dimensions).some((value) => value === null)) addAnomaly('SEL_REPORT', 'dimension_scores/total_score', '至少一个维度缺少必要任务正式分', 'dimension_aggregation');
    return { tasks: normalized, dimension_scores: dimensions, total_score: totalScore, anomalies, valid: totalScore !== null && anomalies.length === 0 };
  }

  return { normalize, mean };
});
