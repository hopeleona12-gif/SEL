(() => {
  const labels = {
    self_awareness: '自我意识',
    self_management: '自我管理',
    social_awareness: '社会意识',
    relationship_skills: '关系技能',
    responsible_decision: '负责任决策'
  };
  const explanations = {
    self_awareness: '反映儿童觉察和表达自身感受、理解感受原因，以及判断困难与支持需要的表现。',
    self_management: '反映儿童在规则任务中保持注意、抑制冲动，以及受阻后调整并恢复参与的表现。',
    social_awareness: '反映儿童理解他人情绪、观点和具体需要，并匹配支持行动的表现。',
    relationship_skills: '反映儿童加入同伴活动、根据回应调整行为，以及进行轮流沟通的表现。',
    responsible_decision: '反映儿童识别责任线索、选择建设性方案并判断直接后果的表现。'
  };
  const advice = {
    self_awareness: '在日常事件后用简短问题帮助孩子说出感受及原因，并鼓励孩子具体说明自己能做什么、需要什么支持。',
    self_management: '活动开始前提供清晰规则和视觉提示；受阻时给予短暂停顿、分步尝试和重新参与的机会。',
    social_awareness: '结合绘本和生活情境练习观察他人的表情、信息和需要，再讨论什么帮助最贴合当下情境。',
    relationship_skills: '在合作游戏中练习先观察和询问、等待轮次、倾听伙伴回应，并根据回应调整自己的行动。',
    responsible_decision: '用生活故事练习识别问题、比较不同做法，并讨论这些做法对自己、他人和共同活动的直接影响。'
  };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const formatScore = (value) => typeof value === 'number' ? `${Number(value.toFixed(2))} / 2` : '—';
  const formatTime = (value) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '';
  const polygon = (values, radius, center = 180) => values.map((value, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
    const r = radius * value / 2;
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
  }).join(' ');
  function radar(dimensions) {
    const keys = Object.keys(labels);
    const values = keys.map((key) => dimensions[key]);
    const rings = [0.4, 0.8, 1.2, 1.6, 2].map((value) => `<polygon points="${polygon(Array(5).fill(value), 125)}" fill="none" stroke="#d8e5e5"/>`).join('');
    const axes = keys.map((_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
      return `<line x1="180" y1="180" x2="${180 + Math.cos(angle) * 125}" y2="${180 + Math.sin(angle) * 125}" stroke="#d8e5e5"/>`;
    }).join('');
    const text = keys.map((key, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
      const x = 180 + Math.cos(angle) * 154;
      const y = 180 + Math.sin(angle) * 146;
      return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${labels[key]}</text>`;
    }).join('');
    return `<svg class="formal-radar" viewBox="0 0 360 360" role="img" aria-label="SEL五维能力雷达图">${rings}${axes}<polygon points="${polygon(values, 125)}" fill="rgba(73,139,132,.32)" stroke="#397f79" stroke-width="3"/>${text}</svg>`;
  }
  function participantId(session) {
    return session?.participant?.child_id || session?.participant?.id || session?.participant?.participant_id || '';
  }
  function reportError(host, session, aggregate) {
    console.error('[REPORT_SCORE_CHAIN_ERROR]', { participant_id: participantId(session), anomalies: aggregate.anomalies });
    host.className = 'report-v1 report-error';
    host.innerHTML = `<header><p class="report-kicker">SEL 社会情感学习测评</p><h1>报告生成异常</h1></header><section class="report-error-card"><h2>评分结果需要主试核验</h2><p>测评已结束，但评分汇总链路存在异常，系统未生成可能误导的正式报告。请由主试在开发日志中核对缺失的正式得分。</p><button id="report-print">打印当前提示</button></section>`;
    host.querySelector('#report-print').onclick = () => window.print();
  }
  function render(session) {
    const host = document.querySelector('.completion, .report-v1');
    if (!host || !window.SELReportScores) return false;
    const aggregate = window.SELReportScores.normalize(session);
    if (!aggregate.valid) {
      reportError(host, session, aggregate);
      return false;
    }
    const ranked = Object.entries(aggregate.dimension_scores).sort((a, b) => b[1] - a[1]);
    const strengths = ranked.slice(0, 2);
    const support = [...ranked].reverse().slice(0, 2);
    host.className = 'report-v1';
    host.innerHTML = `<header><p class="report-kicker">正式测评结果</p><h1>SEL 社会情感学习测评报告</h1><p>本报告描述儿童在本次任务中的相对表现，不作诊断或常模判断。</p></header>
      <section class="report-overview"><h2>测评概览</h2><div class="report-facts"><div><span>儿童编号</span><strong>${esc(participantId(session))}</strong></div><div><span>年龄</span><strong>${esc(session?.participant?.age)}</strong></div><div><span>完成时间</span><strong>${esc(formatTime(session?.session?.end_time))}</strong></div></div></section>
      <section class="report-composite"><div><span>综合表现</span><strong>${formatScore(aggregate.total_score)}</strong><p>SEL 总分为五个维度正式得分的均值，量表范围为 0–2。</p></div></section>
      <section><h2>五维能力画像</h2><div class="report-profile">${radar(aggregate.dimension_scores)}<div class="report-dimension-list">${Object.entries(aggregate.dimension_scores).map(([key, value]) => `<article><div><h3>${labels[key]}</h3><strong>${formatScore(value)}</strong></div><p>${explanations[key]}</p></article>`).join('')}</div></div></section>
      <section class="report-two-column"><article><h2>相对优势</h2>${strengths.map(([key, value]) => `<h3>${labels[key]} · ${formatScore(value)}</h3><p>这是儿童在本次五维任务中的相对较高表现，可在日常学习和互动中继续提供运用机会。</p>`).join('')}</article><article><h2>需要支持的能力</h2>${support.map(([key, value]) => `<h3>${labels[key]} · ${formatScore(value)}</h3><p>这是儿童在本次任务中相对需要更多支持的方向，建议通过稳定、具体且可重复的情境练习逐步巩固。</p>`).join('')}</article></section>
      <section><h2>教育支持建议</h2><div class="report-advice">${support.map(([key]) => `<article><h3>${labels[key]}</h3><p>${advice[key]}</p></article>`).join('')}</div></section>
      <footer><button id="report-print">打印 / 保存报告</button><p>结果仅反映本次测评任务中的表现，不用于医学或心理诊断。</p></footer>`;
    host.querySelector('#report-print').onclick = () => window.print();
    return true;
  }
  window.SELReportV1 = { render };
})();
