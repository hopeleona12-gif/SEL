const AS = 'assets/';
const A = 'T09-A\u89c6\u9891\u97f3\u9891\u9996\u5c3e\u5e27/';
const B = 'T09-B\u89c6\u9891\u97f3\u9891\u9996\u5c3e\u5e27/';
const stage = document.querySelector('#stage');
const downloadBtn = document.querySelector('#downloadBtn');

const result = {
  task: 'T09',
  scenarios: {
    A: { understanding_check: null, action_choice: null, reason_choice: null, reaction_time: {}, hint_used: false },
    B: { understanding_check: { quantity: null, waiting: null }, action_choice: null, reason_choice: null, reaction_time: {}, hint_used: false }
  },
  startedAt: null,
  completedAt: null
};

const asset = file => AS + file;
let currentScenario = 'A';
let responseStart = 0;
let videoDeck = null;
let videoLayers = [];
let activeVideo = 0;
let audioContext = null;
const audioSegmentCache = new Map();

const CROP_3 = [
  { x: 2.0, y: 14.0, w: 31.6, h: 83.0 },
  { x: 34.2, y: 14.0, w: 31.6, h: 83.0 },
  { x: 66.4, y: 14.0, w: 31.6, h: 83.0 }
];
const CROP_4 = [
  { x: 4.7, y: 10.3, w: 44.1, h: 41.9 },
  { x: 51.1, y: 10.3, w: 44.1, h: 41.9 },
  { x: 4.7, y: 53.2, w: 44.1, h: 42.1 },
  { x: 51.1, y: 53.2, w: 44.1, h: 42.1 }
];

function createVideoDeck() {
  stage.className = 'stage';
  stage.innerHTML = '<div class="video-deck"><video class="story-video active" playsinline></video><video class="story-video" playsinline></video><div class="pen-pointer" style="left:67%;top:56%">&#9756;</div></div>';
  videoDeck = stage.querySelector('.video-deck');
  videoLayers = [...stage.querySelectorAll('.story-video')];
  activeVideo = 0;
}

function playVideo(file, onEnd, options = {}) {
  if (!videoDeck || !stage.contains(videoDeck)) createVideoDeck();
  const nextIndex = activeVideo === 0 ? 1 : 0;
  const previous = videoLayers[activeVideo];
  const next = videoLayers[nextIndex];
  const pointer = stage.querySelector('.pen-pointer');
  pointer.classList.remove('visible');
  next.classList.remove('active');
  next.src = asset(file);
  next.currentTime = 0;
  next.onended = null;
  const reveal = () => {
    next.removeEventListener('canplay', reveal);
    next.classList.add('active');
    previous.classList.remove('active');
    next.play().then(() => {
      if (options.pointAtPen) window.setTimeout(() => pointer.classList.add('visible'), 550);
    }).catch(() => next.setAttribute('controls', ''));
    activeVideo = nextIndex;
    window.setTimeout(() => { previous.pause(); previous.removeAttribute('src'); previous.load(); }, 320);
  };
  next.addEventListener('canplay', reveal, { once: true });
  next.onended = () => { pointer.classList.remove('visible'); onEnd(); };
  next.load();
}

async function getAudioSegments(file, count) {
  const cacheKey = `${file}:${count}`;
  if (audioSegmentCache.has(cacheKey)) return audioSegmentCache.get(cacheKey);
  const response = await fetch(asset(file));
  const bytes = await response.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(bytes);
  const samples = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(buffer.sampleRate * 0.02));
  const active = [];
  for (let offset = 0; offset < samples.length; offset += block) {
    let energy = 0;
    const end = Math.min(samples.length, offset + block);
    for (let i = offset; i < end; i += 1) energy += samples[i] * samples[i];
    active.push(Math.sqrt(energy / (end - offset)) > 0.012);
  }
  const regions = [];
  let start = -1;
  for (let i = 0; i <= active.length; i += 1) {
    if (active[i] && start < 0) start = i;
    if ((!active[i] || i === active.length) && start >= 0) {
      if ((i - start) * 0.02 >= 0.18) regions.push({ start: start * 0.02, end: i * 0.02 });
      start = -1;
    }
  }
  const merged = [];
  for (const region of regions) {
    const previous = merged[merged.length - 1];
    if (previous && region.start - previous.end < 0.28) previous.end = region.end;
    else merged.push({ ...region });
  }
  let segments;
  if (merged.length >= count) {
    const gaps = merged.slice(0, -1).map((region, i) => ({ size: merged[i + 1].start - region.end, at: (region.end + merged[i + 1].start) / 2 }));
    const cuts = gaps.sort((a, b) => b.size - a.size).slice(0, count - 1).map(gap => gap.at).sort((a, b) => a - b);
    const edges = [Math.max(0, merged[0].start - 0.08), ...cuts, Math.min(buffer.duration, merged[merged.length - 1].end + 0.1)];
    segments = Array.from({ length: count }, (_, i) => ({ start: edges[i], end: edges[i + 1] }));
  } else if (merged.length) {
    segments = merged.map(region => ({ start: Math.max(0, region.start - 0.08), end: Math.min(buffer.duration, region.end + 0.1) }));
  } else {
    segments = [{ start: 0, end: buffer.duration }];
  }
  const value = { buffer, segments };
  audioSegmentCache.set(cacheKey, value);
  return value;
}

function playHtmlAudioRange(file, start, end, onStart = () => {}) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(asset(file));
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      audio.pause();
      audio.removeAttribute('src');
      resolve();
    };
    audio.preload = 'auto';
    audio.onerror = () => { if (!finished) { finished = true; reject(new Error(`Unable to play ${file}`)); } };
    audio.onloadedmetadata = () => {
      audio.onplaying = onStart;
      audio.ontimeupdate = () => { if (Number.isFinite(end) && audio.currentTime >= end) done(); };
      audio.onended = done;
      const begin = () => audio.play().catch(reject);
      const offset = Math.max(0, start || 0);
      if (offset > 0.01) {
        audio.onseeked = () => { audio.onseeked = null; begin(); };
        audio.currentTime = offset;
      } else begin();
    };
    audio.load();
    window.setTimeout(done, 12000);
  });
}

async function playOptionSegment(file, index, count, onStart = () => {}, role = 'option', manualRange = null) {
  if (manualRange && Number.isFinite(manualRange.start) && Number.isFinite(manualRange.end)) {
    return playHtmlAudioRange(file, manualRange.start, manualRange.end, onStart);
  }
  let decoded;
  try {
    decoded = await getAudioSegments(file, count);
  } catch (error) {
    return playHtmlAudioRange(file, 0, null, onStart);
  }
  const { buffer, segments } = decoded;
  let segment;
  if (manualRange) {
    const detected = segments[segments.length - 1];
    segment = {
      start: manualRange.detectStart ? detected.start : manualRange.start,
      end: manualRange.detectEnd ? detected.end : manualRange.end
    };
  }
  else if (segments.length === count) segment = segments[index];
  else if (role === 'question') segment = segments[0];
  else segment = segments[segments.length - 1];
  return new Promise(resolve => {
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(audioContext.destination);
    const duration = Math.max(0.1, segment.end - segment.start);
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.025);
    gain.gain.setValueAtTime(1, now + Math.max(0.03, duration - 0.035));
    gain.gain.linearRampToValueAtTime(0, now + duration);
    source.onended = resolve;
    source.start(0, segment.start, duration);
    onStart();
  });
}

function applyCrop(focus, image, crop) {
  focus.style.left = `${crop.x}%`;
  focus.style.top = `${crop.y}%`;
  focus.style.width = `${crop.w}%`;
  focus.style.height = `${crop.h}%`;
  focus.innerHTML = `<img src="${asset(image)}" alt="">`;
  const img = focus.querySelector('img');
  img.style.width = `${10000 / crop.w}%`;
  img.style.height = `${10000 / crop.h}%`;
  img.style.left = `${-crop.x * 100 / crop.w}%`;
  img.style.top = `${-crop.y * 100 / crop.h}%`;
}

async function narrateOptions(focus, crops, image, audios, hasQuestionAudio, manualRanges, individualAudio) {
  const segmentCount = crops.length + (hasQuestionAudio ? 1 : 0);
  const segmentOffset = hasQuestionAudio ? 1 : 0;
  for (let i = 0; i < crops.length; i += 1) {
    applyCrop(focus, image, crops[i]);
    if (individualAudio) await playHtmlAudioRange(audios[i], 0, null, () => focus.classList.add('visible'));
    else await playOptionSegment(audios[i], i + segmentOffset, segmentCount, () => focus.classList.add('visible'), 'option', manualRanges[i]);
    focus.classList.remove('visible');
    await new Promise(resolve => window.setTimeout(resolve, 180));
  }
}

async function showChoices(config) {
  const { image, audios, layout, key, correctIndex, scores, next, hasQuestionAudio = false, playQuestionAudio = hasQuestionAudio, manualRanges = [], questionAudio = null, individualAudio = false, crops: customCrops = null, imageRatio = 1672 / 941 } = config;
  const crops = customCrops || (layout === 3 ? CROP_3 : CROP_4);
  const hotspotHtml = crops.map(crop => `<button class="hotspot" disabled aria-label="option" style="left:${crop.x}%;top:${crop.y}%;width:${crop.w}%;height:${crop.h}%"></button>`).join('');
  stage.innerHTML = `<div class="choice-screen"><div class="choice-frame" style="background-image:url('${asset(image)}')"><div class="hotspots">${hotspotHtml}</div><div class="focus-card"></div></div></div>`;
  const frame = stage.querySelector('.choice-frame');
  const stageRatio = 16 / 9;
  if (imageRatio < stageRatio) {
    frame.style.height = '100%';
    frame.style.width = `${imageRatio / stageRatio * 100}%`;
  } else {
    frame.style.width = '100%';
    frame.style.height = `${stageRatio / imageRatio * 100}%`;
  }
  const buttons = [...stage.querySelectorAll('.hotspot')];
  const focus = stage.querySelector('.focus-card');
  try {
    if (questionAudio) await playHtmlAudioRange(questionAudio, 0, null);
    else if (hasQuestionAudio && playQuestionAudio) await playOptionSegment(audios[0], 0, crops.length + 1, () => {}, 'question');
    await narrateOptions(focus, crops, image, audios, hasQuestionAudio, manualRanges, individualAudio);
  } catch (error) {
    focus.classList.remove('visible');
    console.warn('Option narration failed; answers remain available.', error);
  }
  responseStart = performance.now();
  buttons.forEach((button, index) => {
    button.disabled = false;
    button.classList.add('ready');
    button.onclick = async () => {
      buttons.forEach(item => { item.disabled = true; item.classList.remove('ready'); });
      saveChoice(key, index, correctIndex, scores);
      applyCrop(focus, image, crops[index]);
      const segmentCount = crops.length + (hasQuestionAudio ? 1 : 0);
      const segmentIndex = index + (hasQuestionAudio ? 1 : 0);
      try {
        if (individualAudio) await playHtmlAudioRange(audios[index], 0, null, () => focus.classList.add('visible'));
        else await playOptionSegment(audios[index], segmentIndex, segmentCount, () => focus.classList.add('visible'), 'option', manualRanges[index]);
      } catch (error) {
        console.warn('Selected option audio failed; continuing task.', error);
      } finally {
        focus.classList.remove('visible');
        next();
      }
    };
  });
}

function saveChoice(key, index, correctIndex, scores) {
  const scenario = result.scenarios[currentScenario];
  scenario.reaction_time[key] = Math.round(performance.now() - responseStart);
  if (key === 'understanding_quantity') scenario.understanding_check.quantity = index === correctIndex;
  else if (key === 'understanding_waiting') scenario.understanding_check.waiting = index === correctIndex;
  else if (key === 'understanding_check') scenario.understanding_check = index === correctIndex;
  else scenario[key] = index;
  if (scores) scenario[`${key}_score`] = scores[index];
}

function startTask() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioContext.resume();
  result.startedAt = new Date().toISOString();
  currentScenario = 'A';
  playVideo(A + 'T09_00_task_instruction.mp4', () =>
    playVideo(A + 'T09_A01_task_intro.mp4', () =>
      playVideo(A + 'T09_A02_peer_inducement.mp4', () =>
        playVideo(A + 'T09_A03_ownership_question.mp4', ownershipCheck)), { pointAtPen: true }));
}

function ownershipCheck() {
  showChoices({
    image: A + 'T09_A03_owner_cards_all.png', layout: 3, key: 'understanding_check', correctIndex: 0,
    manualRanges: [{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }],
    audios: [A + 'T09_A03_option_rabbit.mp3', A + 'T09_A03_option_child.mp3', A + 'T09_A03_option_monkey.mp3'],
    next: actionA
  });
}

function actionA() {
  showChoices({
    image: A + 'T09_A04_action_choices_shuffled.jpg', imageRatio: 1448 / 1086, layout: 4, key: 'action_choice', scores: [1, 0, 0, 2], individualAudio: true,
    crops: [{ x: 2.6, y: 10.4, w: 46.1, h: 40.4 }, { x: 50.9, y: 10.4, w: 46.3, h: 40.4 }, { x: 2.6, y: 51.7, w: 46.1, h: 41.5 }, { x: 50.9, y: 51.7, w: 46.3, h: 41.5 }],
    questionAudio: A + 'T09_A04_question_split.mp3',
    audios: [A + 'T09_A04_option_01_split.mp3', A + 'T09_A04_option_02_split.mp3', A + 'T09_A04_option_03_split.mp3', A + 'T09_A04_option_04_split.mp3'],
    next: reasonA
  });
}

function reasonA() {
  showChoices({
    image: A + 'T09_A05_reason_choices_all.png', layout: 4, key: 'reason_choice', scores: [2, 1, 0, 0], individualAudio: true,
    questionAudio: A + 'T09_A05_question_split.mp3',
    audios: [A + 'T09_A05_option_01_split.mp3', A + 'T09_A05_option_02_split.mp3', A + 'T09_A05_option_03_split.mp3', A + 'T09_A05_option_04_split.mp3'],
    next: closeA
  });
}

function closeA() {
  playVideo(A + 'T09_A06_sceneA_close.mp4', () => {
    currentScenario = 'B';
    playVideo(B + 'T09_B01_B02A_fair_rule_conflict.mp4', () => playVideo(B + 'T09_B03_1_quantity_question.mp4', quantityCheck));
  });
}

function quantityCheck() {
  showChoices({
    image: B + 'T09_B03_1_quantity_choices_all.png', layout: 3, key: 'understanding_quantity', correctIndex: 0, individualAudio: true,
    audios: [B + 'T09_B03_1_option_01_split.mp3', B + 'T09_B03_1_option_02_split.mp3', B + 'T09_B03_1_option_03_split.mp3'],
    next: waitingQuestion
  });
}

function waitingQuestion() {
  waitingCheck();
}

function waitingCheck() {
  showChoices({
    image: B + 'T09_B03_2_waiting_child_choices_all.png', layout: 3, key: 'understanding_waiting', correctIndex: 1, individualAudio: true,
    questionAudio: B + 'T09_B03_2_question_split.mp3',
    audios: [B + 'T09_B03_2_option_01_split.mp3', B + 'T09_B03_2_option_02_split.mp3', B + 'T09_B03_2_option_03_split.mp3'],
    next: actionB
  });
}

function actionB() {
  showChoices({
    image: B + 'T09_B04_action_choices_all.png', layout: 4, key: 'action_choice', scores: [2, 0, 0, 0], individualAudio: true,
    questionAudio: B + 'T09_B04_question_split.mp3',
    audios: [B + 'T09_B04_option_01_split.mp3', B + 'T09_B04_option_02_split.mp3', B + 'T09_B04_option_03_split.mp3', B + 'T09_B04_option_04_split.mp3'],
    next: reasonB
  });
}

function reasonB() {
  showChoices({
    image: B + 'T09_B05_reason_choices_shuffled.png', layout: 4, key: 'reason_choice', scores: [0, 2, 0, 0], individualAudio: true,
    questionAudio: B + 'T09_B05_question_split.mp3',
    audios: [B + 'T09_B05_option_01_split.mp3', B + 'T09_B05_option_02_split.mp3', B + 'T09_B05_option_03_split.mp3', B + 'T09_B05_option_04_split.mp3'],
    next: () => playVideo(B + 'T09_B06_sceneB_close.mp4', finishTask)
  });
}

function finishTask() {
  result.completedAt = new Date().toISOString();
  for (const key of ['A', 'B']) {
    const scenario = result.scenarios[key];
    const invalid = key === 'A' ? !scenario.understanding_check : !(scenario.understanding_check.quantity && scenario.understanding_check.waiting);
    scenario.status = invalid ? 'INV' : 'VALID';
    scenario.score = invalid ? null : Number(((scenario.action_choice_score + scenario.reason_choice_score) / 2).toFixed(2));
  }
  result.total_score = result.scenarios.A.score === null || result.scenarios.B.score === null ? null : Number(((result.scenarios.A.score + result.scenarios.B.score) / 2).toFixed(2));
  window.parent.postMessage({source:'sel-task',type:'TASK_COMPLETE',taskId:'T09',result},'*');
  stage.innerHTML = '<div class="done-screen"><div class="done-card"><h1>&#x4EFB;&#x52A1;&#x5B8C;&#x6210;</h1><p>&#x672C;&#x6B21;&#x4F5C;&#x7B54;&#x5DF2;&#x8BB0;&#x5F55;</p></div></div>';
  downloadBtn.classList.remove('hidden');
}

document.querySelector('#startBtn').onclick = startTask;
downloadBtn.onclick = () => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
  link.download = 'T09_response_data.json';
  link.click();
};
