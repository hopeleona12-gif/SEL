(() => {
  'use strict';

  const TASK_ID = 'T06';
  const STORAGE_KEY = 'sel_assessment_T06_records';
  const TEST_MODE = new URLSearchParams(location.search).has('test');
  const video = document.querySelector('#video');
  const frame = document.querySelector('#questionFrame');
  const audio = document.querySelector('#promptAudio');
  const hotspots = document.querySelector('#hotspots');
  const startButton = document.querySelector('#startButton');
  const status = document.querySelector('#status');

  const steps = [
    { id: 'T06-00', kind: 'video', src: 'assets/video/T06-00.mp4' },
    { id: 'T06-A-0102', kind: 'video', src: 'assets/video/T06-A-0102.mp4' },
    {
      id: 'T06-A-03', kind: 'question', scenario: 'A', questionType: 'need',
      image: 'assets/frames/T06-A-03.png',
      options: ['一起玩', '拿回画纸', '换一盒彩笔', '休息一下'],
      evidence: ['none', 'full', 'none', 'none'],
      audioSequence: [
        { src: 'assets/audio/T06-A-03-question.mp3', highlight: null },
        { src: 'assets/audio/T06-A-03-option-1.mp3', highlight: 0 },
        { src: 'assets/audio/T06-A-03-option-2.mp3', highlight: 1 },
        { src: 'assets/audio/T06-A-03-option-3.mp3', highlight: 2 },
        { src: 'assets/audio/T06-A-03-option-4.mp3', highlight: 3 }
      ]
    },
    {
      id: 'T06-A-04', kind: 'question', scenario: 'A', questionType: 'action',
      image: 'assets/frames/T06-A-04.png', prompt: 'assets/audio/T06-A-04.mp3',
      options: ['走到桌后捡起画纸交给小兔', '只指着画纸说“在那里”', '把画纸拿走自己看', '转身离开'],
      evidence: ['full', 'partial', 'none', 'none']
    },
    { id: 'T06-A-05', kind: 'video', src: 'assets/video/T06-A-05.mp4' },
    {
      id: 'T06-B-0102', kind: 'video',
      src: 'assets/video/T06-B-0102.mp4',
      audioSrc: 'assets/audio/T06-B-0102.mp3'
    },
    {
      id: 'T06-B-03', kind: 'question', scenario: 'B', questionType: 'need',
      image: 'assets/frames/T06-B-03.png', prompt: 'assets/audio/T06-B-03.mp3',
      options: ['有人支持并让它有机会加入', '送它一个无关玩具', '让它去休息', '给它一张纸'],
      evidence: ['full', 'none', 'none', 'none']
    },
    {
      id: 'T06-B-04', kind: 'question', scenario: 'B', questionType: 'action',
      image: 'assets/frames/T06-B-04.png',
      options: ['告诉老师帮忙', '装作没看见', '邀请它一起玩', '给它零食但不让加入'],
      evidence: ['full', 'none', 'full', 'partial'],
      audioSequence: [
        { src: 'assets/audio/T06-B-04-question.mp3', highlight: null },
        { src: 'assets/audio/T06-B-04-option-1.mp3', highlight: 0 },
        { src: 'assets/audio/T06-B-04-option-2.mp3', highlight: 1 },
        { src: 'assets/audio/T06-B-04-option-3.mp3', highlight: 2 },
        { src: 'assets/audio/T06-B-04-option-4.mp3', highlight: 3 }
      ]
    },
    { id: 'T06-B-05', kind: 'video', src: 'assets/video/T06-B-05.mp4' }
  ];

  let stepIndex = 0;
  let questionStartedAt = 0;
  let activeAudioSequence = null;
  let activeAudioIndex = -1;
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  function readRecords() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }

  function scoreScenario(records, scenario) {
    const items = records.filter((record) => record.scenario === scenario);
    const need = items.find((record) => record.question_type === 'need');
    const action = items.find((record) => record.question_type === 'action');
    if (!need || !action) return null;
    const levels = [need.evidence_level, action.evidence_level];
    if (levels.some((level) => !['full', 'partial', 'none'].includes(level))) return null;
    if (levels.every((level) => level === 'full')) return 2;
    if (levels.some((level) => level === 'full' || level === 'partial')) return 1;
    return 0;
  }

  function completeResult() {
    const records = readRecords();
    const a = scoreScenario(records, 'A');
    const b = scoreScenario(records, 'B');
    const valid = [a, b].filter((score) => typeof score === 'number');
    const score = valid.length ? Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2)) : null;
    return { task_id: TASK_ID, T06A_score: a, T06B_score: b, T06_score: score, score, records };
  }

  async function persist(record) {
    const records = readRecords();
    records.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    document.documentElement.dataset.recordCount = String(records.length);
    document.documentElement.dataset.lastSaved = `${record.scenario}:${record.question_id}:${record.option_selected}`;
    window.dispatchEvent(new CustomEvent('t06-response-saved', { detail: record }));
    if (window.T06_ENDPOINT) {
      try {
        await fetch(window.T06_ENDPOINT, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record), keepalive: true
        });
      } catch { /* 本地记录保留，等待宿主系统后续同步 */ }
    }
  }

  function clearReadingHighlight() {
    [...hotspots.children].forEach((button) => button.classList.remove('reading'));
  }

  function resetLayer() {
    video.pause(); audio.pause();
    activeAudioSequence = null; activeAudioIndex = -1;
    video.style.display = 'none'; frame.style.display = 'none'; hotspots.style.display = 'none';
    hotspots.className = 'hotspots'; hotspots.replaceChildren(); status.style.display = 'none';
  }

  function showStep() {
    resetLayer();
    if (stepIndex >= steps.length) {
      status.textContent = '测评已完成'; status.style.display = 'block';
      document.documentElement.dataset.completed = 'true';
      const result = completeResult();
      window.parent.postMessage({ source: 'sel-task', type: 'TASK_COMPLETE', taskId: TASK_ID, result }, '*');
      return;
    }
    const step = steps[stepIndex];
    document.documentElement.dataset.step = step.id;
    if (step.kind === 'video') {
      video.src = step.src; video.style.display = 'block';
      video.playbackRate = TEST_MODE ? 16 : 1;
      video.muted = Boolean(step.audioSrc);
      const mediaStarts = [video.play()];
      if (step.audioSrc) {
        audio.src = step.audioSrc;
        audio.playbackRate = TEST_MODE ? 16 : 1;
        mediaStarts.push(audio.play());
      }
      Promise.all(mediaStarts).catch(() => { startButton.hidden = false; });
      return;
    }

    frame.src = step.image; frame.alt = step.id;
    frame.style.display = 'block'; hotspots.style.display = 'grid';
    const layoutClass = step.id === 'T06-B-04'
      ? 'layout-action-compact'
      : (step.questionType === 'need' ? 'layout-need' : 'layout-action');
    hotspots.classList.add(layoutClass);
    step.options.forEach((label, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'hotspot'; button.dataset.option = String(index + 1);
      button.setAttribute('aria-label', `选项${index + 1}：${label}`);
      button.addEventListener('click', () => choose(step, index, button), { once: true });
      hotspots.append(button);
    });
    prepareZoomTiles(step);
    questionStartedAt = performance.now();
    playQuestionAudio(step);
  }

  function prepareZoomTiles(step) {
    requestAnimationFrame(() => {
      const stageRect = document.querySelector('#stage').getBoundingClientRect();
      [...hotspots.children].forEach((button) => {
        const rect = button.getBoundingClientRect();
        const crop = document.createElement('img');
        crop.className = 'zoom-crop'; crop.alt = ''; crop.draggable = false; crop.src = step.image;
        crop.style.width = `${stageRect.width}px`; crop.style.height = `${stageRect.height}px`;
        crop.style.left = `${stageRect.left - rect.left}px`; crop.style.top = `${stageRect.top - rect.top}px`;
        button.append(crop);
      });
    });
  }

  function playQuestionAudio(step) {
    clearReadingHighlight();
    if (step.audioSequence) {
      activeAudioSequence = step.audioSequence;
      playAudioPart(0);
      return;
    }
    activeAudioSequence = null; activeAudioIndex = -1;
    audio.src = step.prompt; audio.play().catch(() => {});
  }

  function playAudioPart(index) {
    if (!activeAudioSequence || index >= activeAudioSequence.length) {
      clearReadingHighlight(); activeAudioSequence = null; activeAudioIndex = -1;
      return;
    }
    activeAudioIndex = index;
    const part = activeAudioSequence[index];
    [...hotspots.children].forEach((button, optionIndex) => {
      button.classList.toggle('reading', optionIndex === part.highlight);
    });
    audio.src = part.src;
    audio.play().catch(() => {});
  }

  function updateCombinedAudioHighlight() {
    const step = steps[stepIndex];
    if (activeAudioSequence || !step || step.kind !== 'question' || !Number.isFinite(audio.duration)) return;
    const leadSeconds = 2.6;
    const optionDuration = Math.max(0, audio.duration - leadSeconds) / 4;
    const active = audio.currentTime < leadSeconds ? -1 : Math.min(3, Math.floor((audio.currentTime - leadSeconds) / optionDuration));
    [...hotspots.children].forEach((button, index) => button.classList.toggle('reading', index === active));
  }

  async function choose(step, index, button) {
    if (hotspots.classList.contains('locked')) return;
    hotspots.classList.add('locked'); button.classList.add('selected');
    audio.pause(); activeAudioSequence = null; activeAudioIndex = -1; clearReadingHighlight();
    const record = {
      task_id: TASK_ID,
      session_id: sessionId,
      scenario: step.scenario,
      question_id: step.id,
      question_type: step.questionType,
      option_selected: index + 1,
      option_label: step.options[index],
      response_time: Math.round(performance.now() - questionStartedAt),
      completed: true,
      evidence_level: step.evidence[index],
      score_field: step.questionType === 'need' ? 'need_identification_evidence' : 'action_selection_evidence',
      scoring_deferred: true,
      recorded_at: new Date().toISOString()
    };
    await persist(record);
    setTimeout(() => { stepIndex += 1; showStep(); }, 450);
  }

  video.addEventListener('ended', () => {
    audio.pause();
    stepIndex += 1;
    showStep();
  });
  audio.addEventListener('timeupdate', updateCombinedAudioHighlight);
  audio.addEventListener('ended', () => {
    if (activeAudioSequence) playAudioPart(activeAudioIndex + 1);
    else clearReadingHighlight();
  });
  video.addEventListener('error', () => {
    status.textContent = '素材加载失败，请刷新后重试'; status.style.display = 'block';
  });
  startButton.addEventListener('click', () => { startButton.hidden = true; showStep(); });

  window.T06Assessment = {
    getRecords: () => structuredClone(readRecords()),
    clearRecords: () => localStorage.removeItem(STORAGE_KEY),
    exportRecords: () => {
      const blob = new Blob([JSON.stringify(readRecords(), null, 2)], { type: 'application/json' });
      const link = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), download: `T06-${sessionId}.json`
      });
      link.click(); URL.revokeObjectURL(link.href);
    }
  };
})();
