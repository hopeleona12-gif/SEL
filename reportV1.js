(() => {
  const labels = {
    self_awareness: '自我意识',
    self_management: '自我管理',
    social_awareness: '社会意识',
    relationship_skills: '关系技能',
    responsible_decision: '负责任决策'
  };
  const descriptions = {
    self_awareness: '认识自己的感受、想法和需要，并尝试表达出来。',
    self_management: '在规则、等待和困难情境中保持参与，并逐步调整自己的行为。',
    social_awareness: '理解他人的感受、观点和需要，并作出相应回应。',
    relationship_skills: '与他人沟通、合作、轮流，并根据互动情况调整行动。',
    responsible_decision: '识别问题和可能后果，选择更合适、更有帮助的做法。'
  };
  const advice = {
    self_awareness: '日常事件后，可以问孩子“你有什么感觉？”“为什么？”并鼓励孩子说出需要的帮助。',
    self_management: '活动前先说明规则和步骤；遇到困难时给予短暂等待、分步尝试和重新参与的机会。',
    social_awareness: '阅读绘本或观看生活情境时，引导孩子观察他人的表情、行动和需要，再讨论可以怎样帮助。',
    relationship_skills: '在合作游戏中练习观察、询问、轮流和倾听，并鼓励孩子根据伙伴的回应调整自己的做法。',
    responsible_decision: '和孩子比较不同做法可能带来的结果，讨论这些做法对自己、他人和共同活动的影响。'
  };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const scoreText = (value) => typeof value === 'number' ? `${Number(value.toFixed(2))} / 2` : '待核验';
  const timeText = (value) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未记录';
  const participantId = (session) => session?.participant?.child_id || session?.participant?.id || session?.participant?.participant_id || '未记录';
  const statusText = (status) => ({ available: '已形成', score_missing: '缺少正式分数', INV: '无效 / 需复核', pending_aliyun_semantic_scoring: '语义评分处理中' }[status] || status || '待核验');
  const polygon = (values, radius, center = 180) => values.map((value, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
    const r = radius * value / 2;
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
  }).join(' ');
  function radar(dimensions) {
    const keys = Object.keys(labels);
    const rings = [0.5, 1, 1.5, 2].map((v) => `<polygon points="${polygon(Array(5).fill(v), 112)}" fill="none" stroke="#d9e5e2"/>`).join('');
    const axes = keys.map((_, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      return `<line x1="180" y1="180" x2="${180 + Math.cos(a) * 112}" y2="${180 + Math.sin(a) * 112}" stroke="#d9e5e2"/>`;
    }).join('');
    const text = keys.map((key, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      return `<text x="${180 + Math.cos(a) * 137}" y="${180 + Math.sin(a) * 132}" text-anchor="middle" dominant-baseline="middle">${labels[key]}</text>`;
    }).join('');
    const values = keys.map((key) => dimensions[key]);
    const shape = values.every((v) => typeof v === 'number')
      ? `<polygon points="${polygon(values, 112)}" fill="rgba(48,132,119,.24)" stroke="#2f8479" stroke-width="3"/>`
      : '<text x="180" y="180" text-anchor="middle" class="radar-empty">数据待核验</text>';
    return `<svg class="formal-radar" viewBox="0 0 360 360" role="img" aria-label="SEL五维能力雷达图">${rings}${axes}${shape}${text}</svg>`;
  }
  function dimensionCards(dimensions) {
    return Object.entries(labels).map(([key, label]) => {
      const value = dimensions[key];
      const pct = typeof value === 'number' ? Math.max(0, Math.min(100, value / 2 * 100)) : 0;
      return `<article class="ability-card"><div class="ability-card-head"><div><span class="ability-index">${Object.keys(labels).indexOf(key) + 1}</span><h3>${label}</h3></div><strong>${scoreText(value)}</strong></div><div class="ability-bar"><i style="width:${pct}%"></i></div><p>${descriptions[key]}</p><small>${typeof value === 'number' ? '基于本次测评的标准化维度得分' : '该维度暂缺必要的正式任务分数'}</small></article>`;
    }).join('');
  }
  function reportError(host, session, aggregate) {
    const issues = aggregate.anomalies.map((x) => `<li><strong>${esc(x.task_id)}</strong>：${esc(x.missing_score)} — ${esc(x.reason)}</li>`).join('');
    host.className = 'report-v1 report-error';
    host.innerHTML = `<header class="report-hero"><span class="report-kicker">SEL 社会情感学习测评</span><h1>结果需要主试核验</h1><p>测评流程已结束，但正式评分汇总尚未完整形成。系统没有把缺失或无效数据转换成 0 分。</p></header><section class="report-summary"><div><span>儿童编号</span><strong>${esc(participantId(session))}</strong></div><div><span>完成时间</span><strong>${esc(timeText(session?.session?.end_time))}</strong></div><div><span>报告状态</span><strong>待核验</strong></div></section><section class="report-review-card"><h2>需要核对的评分链路</h2><ul>${issues || '<li>存在未识别的评分异常，请查看主试计分核对页。</li>'}</ul><p>请在主试计分核对页确认任务正式分数和语义评分状态后，再生成正式报告。</p><button id="report-print">打印核验提示</button></section>`;
    host.querySelector('#report-print').onclick = () => window.print();
  }
  function render(session) {
    const host = document.querySelector('.completion, .report-v1');
    if (!host || !window.SELReportScores) return false;
    const aggregate = window.SELReportScores.normalize(session);
    if (!aggregate.valid) { reportError(host, session, aggregate); return false; }
    const ranked = Object.entries(aggregate.dimension_scores).sort((a, b) => b[1] - a[1]);
    const strengths = ranked.slice(0, 2);
    const support = [...ranked].reverse().slice(0, 2);
    host.className = 'report-v1';
    host.innerHTML = `<header class="report-hero"><span class="report-kicker">SEL 社会情感学习测评</span><h1>测评结果报告</h1><p>本报告反映儿童在本次测评中的相对表现，不用于医学、心理诊断或常模判断。</p></header>
      <section class="report-summary"><div><span>儿童编号</span><strong>${esc(participantId(session))}</strong></div><div><span>年龄</span><strong>${esc(session?.participant?.age || '未记录')}</strong></div><div><span>完成时间</span><strong>${esc(timeText(session?.session?.end_time))}</strong></div></section>
      <section class="report-score-hero"><div><span>SEL 综合得分</span><strong>${scoreText(aggregate.total_score)}</strong><small>五个维度正式得分的综合结果</small></div><div class="report-status-pill">评分已完成</div></section>
      <section class="report-section"><div class="section-heading"><span>能力画像</span><h2>五维社会情感能力</h2><p>雷达图用于观察儿童本次测评中的相对表现。</p></div><div class="profile-layout"><div class="radar-card">${radar(aggregate.dimension_scores)}</div><div class="ability-cards">${dimensionCards(aggregate.dimension_scores)}</div></div></section>
      <section class="insight-grid"><article class="insight-card strength"><span class="insight-label">相对优势</span><h2>可以继续发展的能力</h2>${strengths.map(([key, value]) => `<div class="insight-item"><strong>${labels[key]} · ${scoreText(value)}</strong><p>这是本次五个维度中相对较高的表现，可以在日常互动和学习活动中继续提供练习机会。</p></div>`).join('')}</article><article class="insight-card support"><span class="insight-label">支持方向</span><h2>可以重点支持的能力</h2>${support.map(([key, value]) => `<div class="insight-item"><strong>${labels[key]} · ${scoreText(value)}</strong><p>可以通过稳定、具体、可重复的生活情境练习，帮助儿童逐步巩固这一能力。</p></div>`).join('')}</article></section>
      <section class="report-section advice-section"><div class="section-heading"><span>家庭与学校支持</span><h2>教育支持建议</h2></div><div class="advice-grid">${support.map(([key]) => `<article><h3>${labels[key]}</h3><p>${advice[key]}</p></article>`).join('')}</div></section>
      <footer class="report-footer"><button id="report-print">打印 / 保存报告</button><p>报告仅描述本次测评中的相对表现，请结合儿童日常情境和持续观察进行理解。</p></footer>`;
    host.querySelector('#report-print').onclick = () => window.print();
    return true;
  }
  window.SELReportV1 = { render };
})();
