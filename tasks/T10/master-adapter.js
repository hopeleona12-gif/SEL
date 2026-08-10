(() => {
  const emit = () => {
    const result = document.querySelector('.result');
    if (!result) return;
    const values = [...result.querySelectorAll('.score strong')]
      .map((node) => Number(node.textContent));
    if (values.length < 3 || !Number.isFinite(values[2])) return;
    const score = values[2];
    window.parent.postMessage({
      source: 'sel-task',
      type: 'TASK_COMPLETE',
      taskId: 'T10',
      result: { task_id: 'T10', T10_score: score, score }
    }, '*');
  };
  new MutationObserver(emit).observe(document.body, { childList: true, subtree: true });
  emit();
})();
