(() => {
  if (new URLSearchParams(location.search).get('debug') !== '1') return;
  const key = 'sel.master.session';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const download = (name, data, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); };
  const taskScore = (id, t) => id === 'T01_A' || id === 'T01_B' ? ([t.emotion?.score, t.cause?.score].filter((v) => typeof v === 'number').length ? [t.emotion?.score, t.cause?.score].filter((v) => typeof v === 'number').reduce((a, b) => a + b, 0) : null) : t.score ?? t.task_score ?? t.total_score ?? t.T06_score ?? t.T10_score ?? null;
  const showLatest = (id, value) => {
    if (!id || location.hash === '#score-check') return;
    let card = document.querySelector('#debugScoreCard');
    if (!card) { card = document.createElement('aside'); card.id = 'debugScoreCard'; card.className = 'debug-score-card'; document.body.append(card); }
    const score = taskScore(id, value); const status = value.score_status || (score == null ? 'score_missing' : 'available');
    const transcript = value.transcript || value.asr_text || value.emotion?.asr_text || value.cause?.asr_text || '';
    const detail = id === 'T01_A' || id === 'T01_B' ? `情绪：${value.emotion?.score ?? '未测'}；原因：${value.cause?.score ?? '未测'}` : id === 'T03' ? `安静：${value.quiet_score ?? '未测'}；干扰：${value.distractor_score ?? '未测'}` : id === 'T06' ? `A：${value.T06A_score ?? '未测'}；B：${value.T06B_score ?? '未测'}` : '';
    card.innerHTML = `<h4>刚完成：${esc(id)}</h4><div>任务得分：<strong>${esc(score == null ? 'score_missing' : score)}</strong></div><div>状态：${esc(status)}</div>${detail ? `<div>${detail}</div>` : ''}${transcript ? `<div class="debug-score-transcript">语音：${esc(transcript)}</div>` : ''}`;
  };
  const render = () => {
    const raw = JSON.parse(localStorage.getItem(key) || '{"tasks":{}}'); const tasks = raw.tasks || {};
    const ids = ['T02','T03','T04','T01_A','T06','T05','T07','T08','T01_B','T09','T10'];
    const rows = ids.map((id) => { const t = tasks[id] || {}; const sub = id === 'T01_A' || id === 'T01_B' ? `emotion=${esc(t.emotion?.score)}; cause=${esc(t.cause?.score)}` : id === 'T06' ? `A=${esc(t.T06A_score)}; B=${esc(t.T06B_score)}; total=${esc(t.T06_score)}` : id === 'T03' ? `quiet=${esc(t.quiet_score)}; distractor=${esc(t.distractor_score)}; final=${esc(t.score)}` : esc(t.score); return `<tr><td>${id}</td><td>${esc(t.selected_option || t.answer || t.emotion?.raw_response || t.cause?.raw_response)}</td><td>${esc(t.transcript || t.emotion?.asr_text || t.cause?.asr_text)}</td><td>${esc(t.prompt_level || t.emotion?.prompt_level || t.cause?.prompt_level)}</td><td>${sub}</td><td>${t.score_status === 'score_missing' || t.score == null ? 'true' : 'false'}</td></tr>`; }).join('');
    document.querySelector('#app').innerHTML = `<main class="shell score-panel"><h1>开发计分核对</h1><p>仅用于 debug=1。</p><table><thead><tr><th>task_id</th><th>answer</th><th>transcript</th><th>prompt_level</th><th>scores</th><th>score_missing</th></tr></thead><tbody>${rows}</tbody></table><details><summary>查看原始JSON</summary><pre>${esc(JSON.stringify(raw, null, 2))}</pre></details><button id="json">导出JSON</button> <button id="csv">导出CSV</button></main>`;
    document.querySelector('#json').onclick = () => download('SEL_score_check.json', JSON.stringify(raw, null, 2), 'application/json');
    document.querySelector('#csv').onclick = () => download('SEL_score_check.csv', 'task_id,answer,transcript,prompt_level,score,score_missing\n' + ids.map((id) => { const t = tasks[id] || {}; return [id, t.answer || '', t.transcript || '', t.prompt_level || '', t.score ?? '', t.score_status === 'score_missing'].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','); }).join('\n'), 'text/csv');
  };
  window.addEventListener('message', (e) => { const d = e.data || {}; if (!['TASK_COMPLETE', 'SEL_T01_COMPLETE', 'SEL_ASSESSMENT_COMPLETE'].includes(d.type)) return; const s = JSON.parse(localStorage.getItem(key) || '{"tasks":{}}'); const id = String(d.taskId || d.task_id || d.payload?.task || '').replaceAll('-', '_'); const value = { ...(s.tasks[id] || {}), ...(d.result || d.payload || {}) }; s.tasks[id] = value; localStorage.setItem(key, JSON.stringify(s)); showLatest(id, value); if (location.hash === '#score-check') render(); });
  let lastSeen = {};
  setInterval(() => { if (location.hash === '#score-check') return; const s = JSON.parse(localStorage.getItem(key) || '{"tasks":{}}'); Object.entries(s.tasks || {}).forEach(([id, value]) => { if (value?.end_time && value.end_time !== lastSeen[id]) { lastSeen[id] = value.end_time; showLatest(id, value); } }); }, 400);
  const install = () => { const shell = document.querySelector('.task-shell'); if (!shell || shell.dataset.pauseInstalled) return; shell.dataset.pauseInstalled = '1'; const b = document.createElement('button'); b.className = 'master-pause'; b.textContent = '暂停'; shell.append(b); const o = document.createElement('div'); o.className = 'master-pause-overlay'; o.hidden = true; o.innerHTML = '<div><strong>测评已暂停</strong><button>继续</button></div>'; document.body.append(o); const toggle = () => { o.hidden = !o.hidden; b.textContent = o.hidden ? '暂停' : '继续'; shell.querySelector('iframe')?.contentWindow?.postMessage({ source: 'sel-master', type: o.hidden ? 'RESUME' : 'PAUSE' }, '*'); }; b.onclick = toggle; o.querySelector('button').onclick = toggle; };
  new MutationObserver(install).observe(document.body, { childList: true, subtree: true });
  if (location.hash === '#score-check') setTimeout(render, 400);
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.textContent?.trim() !== '继续') return;
    const overlay = target.closest('.master-pause-overlay');
    if (!overlay) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    overlay.hidden = true;
    overlay.style.pointerEvents = 'none';
    const shell = document.querySelector('.task-shell');
    const pause = shell?.querySelector('.master-pause');
    if (pause) pause.textContent = '暂停';
    shell?.querySelector('iframe')?.contentWindow?.postMessage({ source: 'sel-master', type: 'RESUME' }, '*');
  }, true);
})();
