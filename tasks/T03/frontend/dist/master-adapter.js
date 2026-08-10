(() => {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = String(args[0]?.url || args[0] || '');
    if (url.includes('/api/v1/assessments/') && url.endsWith('/complete')) {
      try {
        const body = await response.clone().json();
        if (typeof body.score === 'number') {
          window.parent.postMessage({
            source: 'sel-task', type: 'TASK_COMPLETE', taskId: 'T03',
            result: { task_id: 'T03', score: body.score, T03_score: body.score, ...body }
          }, '*');
        }
      } catch (error) {
        console.warn('[T03 adapter] score response unavailable', error);
      }
    }
    return response;
  };
})();
