(function () {
  'use strict';
  var sent = false;
  function emit() {
    if (sent) return;
    var raw = localStorage.getItem('SEL_T07_result');
    var result;
    try { result = raw ? JSON.parse(raw) : null; } catch (_) { result = null; }
    if (!result || !Array.isArray(result.responses)) return;
    if (!document.querySelector('.complete-panel')) return;
    sent = true;
    var normalized = Object.assign({}, result, {
      task_id: 'T07',
      records: result.responses,
      subscores: result.condition_scores,
      T07_score: typeof result.task_score === 'number' ? result.task_score : null,
      score: typeof result.task_score === 'number' ? result.task_score : null,
      score_status: typeof result.task_score === 'number' ? 'available' : 'score_missing',
      completed_at: new Date().toISOString()
    });
    window.parent.postMessage({ source: 'sel-task', type: 'TASK_COMPLETE', taskId: 'T07', result: normalized }, '*');
  }
  new MutationObserver(emit).observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(emit, 250);
  emit();
}());
