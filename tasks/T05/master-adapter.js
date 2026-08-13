(() => {
  let sent = false;
  const send = () => {
    if (sent || !document.querySelector('.end')) return;
    const raw = localStorage.getItem('T05_latest');
    if (!raw) return;
    sent = true;
    const result = JSON.parse(raw);
    result.T05_score = null;
    result.T05_score_status = 'score_missing';
    window.parent.postMessage({ source: 'sel-task', type: 'TASK_COMPLETE', taskId: 'T05', result }, '*');
  };
  new MutationObserver(send).observe(document.documentElement, { childList: true, subtree: true });
  send();
})();
