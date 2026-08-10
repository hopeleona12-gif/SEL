/**
 * T03 PNG + audio visual prototype.
 *
 * The state functions are intentionally independent so future T04-T10
 * prototypes can reuse the same flow controller, response window and
 * presentation helpers without copying page-level timing code.
 */

const ASSETS = {
  classroomQuiet: "./assets/classroom_quiet.png",
  classroomClean: "./assets/classroom_clean.png",
  practiceIdle: "./assets/practice_idle.png",
  practiceActive: "./assets/practice_active.png",
  testIdle: "./assets/test_idle.png",
  testActive: "./assets/test_active.png",
  starIdle: "./assets/star_idle.png",
  starActive: "./assets/star_active.png",
  monkeyWalkStart: "./assets/monkey_walk_start.png",
  monkeyWalkEnd: "./assets/monkey_walk_end.png",
  monkeyWaveStart: "./assets/monkey_wave_start.png",
  monkeyWaveEnd: "./assets/monkey_wave_end.png",
  dong: "./assets/dong.mp3",
  ding: "./assets/ding.mp3",
  ruleVoice: "./assets/rule_voice.mp3",
  enterQuiet: "./assets/enter_quiet.mp3",
  enterDistractor: "./assets/enter_distractor.mp3",
  taskEnd: "./assets/task_end.mp3",
};

const SETTINGS = {
  responseWindowMs: 3000,
  clickFeedbackMs: 500,
  preStimulusMs: 480,
  interTrialMs: 620,
  distractorLeadMs: 420,
};

const PRACTICE_TRIALS = [
  { sound: "dong", correctResponse: "click" },
  { sound: "ding", correctResponse: "no_click" },
  { sound: "dong", correctResponse: "click" },
  { sound: "ding", correctResponse: "no_click" },
];

const BLOCK_A_TRIALS = [
  { sound: "dong", correctResponse: "click" },
  { sound: "ding", correctResponse: "no_click" },
  { sound: "dong", correctResponse: "click" },
  { sound: "dong", correctResponse: "click" },
  { sound: "ding", correctResponse: "no_click" },
  { sound: "dong", correctResponse: "click" },
];

const BLOCK_B_TRIALS = BLOCK_A_TRIALS.map((trial) => ({ ...trial }));

const elements = {
  sceneImage: document.querySelector("#scene-image"),
  characterImage: document.querySelector("#character-image"),
  taskChip: document.querySelector("#task-chip"),
  progressDots: document.querySelector("#progress-dots"),
  stateCard: document.querySelector("#state-card"),
  cardEyebrow: document.querySelector("#card-eyebrow"),
  cardTitle: document.querySelector("#card-title"),
  cardText: document.querySelector("#card-text"),
  cardButton: document.querySelector("#card-button"),
  promptKicker: document.querySelector("#prompt-kicker"),
  promptText: document.querySelector("#prompt-text"),
  actionButton: document.querySelector("#action-button"),
  starStage: document.querySelector("#star-stage"),
  starButton: document.querySelector("#star-button"),
  starImage: document.querySelector("#star-image"),
  distractor: document.querySelector("#distractor"),
  distractorStart: document.querySelector("#distractor-start"),
  distractorEnd: document.querySelector("#distractor-end"),
};

const audio = {
  dong: new Audio(ASSETS.dong),
  ding: new Audio(ASSETS.ding),
  ruleVoice: new Audio(ASSETS.ruleVoice),
  enterQuiet: new Audio(ASSETS.enterQuiet),
  enterDistractor: new Audio(ASSETS.enterDistractor),
  taskEnd: new Audio(ASSETS.taskEnd),
};

Object.values(audio).forEach((track) => {
  track.preload = "auto";
});

let state = "welcome";
let trialLocked = true;
let activeTrial = null;
let responseStartedAt = 0;
let responseTimer = null;
let responseResolver = null;
let narrationTrack = null;

initializePrototype();

function initializePrototype() {
  preloadAssets();
  elements.cardButton.addEventListener("click", handleCardAction);
  elements.actionButton.addEventListener("click", handleActionButton);
  elements.starButton.addEventListener("click", handleStarClick);
  showWelcomeState();
}

async function preloadAssets() {
  const imageSources = Object.entries(ASSETS)
    .filter(([, source]) => source.endsWith(".png"))
    .map(([, source]) => source);

  await Promise.allSettled(
    imageSources.map((source) => new Promise((resolve) => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = source;
    })),
  );
  Object.values(audio).forEach((track) => track.load());
}

/* State 1: welcome */
function showWelcomeState() {
  state = "welcome";
  setHeader("听声音找星星");
  setScene(ASSETS.classroomQuiet);
  setCharacter(ASSETS.practiceIdle, true);
  hideStar();
  hideDistractor();
  renderProgress(0, 0);
  showStateCard({
    eyebrow: "安静课堂",
    title: "听到“咚”再点击",
    text: "小朋友，我们来玩一个听声音找星星的游戏。",
    button: "开始游戏",
    centered: false,
  });
  setPrompt("准备好了吗？", "坐舒服，仔细听声音。");
}

async function handleCardAction() {
  if (state !== "welcome") return;
  elements.cardButton.disabled = true;
  await speakPrompt("小朋友，我们来玩一个听声音找星星的游戏。");
  await showRuleTeachingState();
}

/* State 2: spoken rule teaching + same-DOM star feedback */
async function showRuleTeachingState() {
  state = "rule-teaching";
  await hideStateCard();
  setHeader("先听一听规则");
  setCharacter(ASSETS.practiceIdle, true);
  showStar();
  setPrompt("记住两个声音", "先听规则，再听声音。");

  await playNarration(
    "ruleVoice",
    "听到咚的时候，请点击星星。听到叮的时候，不要点击星星。",
  );

  setPrompt("听到“咚”", "请点击中间的星星。");
  await wait(350);
  await runSingleTrial({
    trialId: "teaching_dong",
    condition: "teaching",
    sound: "dong",
    correctResponse: "click",
    logResult: false,
  });

  setPrompt("听到“叮”", "这一次，不要点击星星。");
  await wait(520);
  await runSingleTrial({
    trialId: "teaching_ding",
    condition: "teaching",
    sound: "ding",
    correctResponse: "no_click",
    logResult: false,
  });

  state = "practice-ready";
  setPrompt("规则记住了吗？", "我们来练习四次。");
  showActionButton("开始练习");
}

/* State 3: four unscored practice trials */
async function showPracticeState() {
  state = "practice";
  hideActionButton();
  await hideStateCard();
  hideDistractor();
  setHeader("练习时间");
  setCharacter(ASSETS.practiceIdle, false);
  await changeScene(ASSETS.classroomClean);
  showStar();
  await runTrialSeries({
    condition: "practice",
    prefix: "P",
    trials: PRACTICE_TRIALS,
    distractor: false,
  });
  await showPracticeCompleteState();
}

/* State 4: independent practice-complete page */
async function showPracticeCompleteState() {
  state = "practice-complete";
  renderProgress(0, 0);
  hideStar();
  hideDistractor();
  setCharacter(ASSETS.practiceActive, true);
  setHeader("练习完成");
  showStateCard({
    eyebrow: "做得真认真",
    title: "你已经学会啦！",
    text: "现在开始正式游戏。",
    button: "开始正式测试",
    centered: true,
  });
  setPrompt("休息一下", "准备好后，点击按钮继续。");
  elements.cardButton.disabled = true;
  await playNarration("enterQuiet", "你已经学会啦！现在开始正式游戏。");
  elements.cardButton.disabled = false;
}

async function handleActionButton() {
  if (state === "practice-ready") {
    await showPracticeState();
    return;
  }
  if (state === "block-b-ready") {
    await runBlockB();
  }
}

/* State 5A: formal quiet block */
async function startFormalTest() {
  state = "block-a";
  stopNarration();
  await hideStateCard();
  setCharacter(ASSETS.testIdle, false);
  await changeScene(ASSETS.classroomClean);
  hideDistractor();
  showStar();
  setHeader("安静课堂");
  setPrompt("正式游戏开始", "只听声音，按照规则来做。");
  await runTrialSeries({
    condition: "quiet",
    prefix: "A",
    trials: BLOCK_A_TRIALS,
    distractor: false,
  });
  await showBlockBTransition();
}

/* State 5B transition: single button, spoken key instruction */
async function showBlockBTransition() {
  state = "block-b-ready";
  renderProgress(0, 0);
  hideStar();
  hideDistractor();
  setCharacter(ASSETS.testIdle, true);
  setHeader("下一段游戏");
  showStateCard({
    eyebrow: "规则不变",
    title: "教室里会有小伙伴经过",
    text: "不要看它，只听“咚”和“叮”。",
    button: "",
    centered: true,
  });
  setPrompt("还是原来的规则", "准备好后继续游戏。");
  await playNarration(
    "enterDistractor",
    "接下来教室里会有小伙伴经过。规则不变，只听声音。",
  );
  await hideStateCard();
  showActionButton("继续游戏");
}

async function runBlockB() {
  state = "block-b";
  stopNarration();
  hideActionButton();
  setCharacter(ASSETS.testIdle, false);
  await changeScene(ASSETS.classroomClean);
  setHeader("干扰课堂");
  setPrompt("记住原来的规则", "小伙伴出现时，继续仔细听声音。");
  showStar();
  await runTrialSeries({
    condition: "distractor",
    prefix: "B",
    trials: BLOCK_B_TRIALS,
    distractor: true,
  });
  await showCompleteState();
}

async function showCompleteState() {
  state = "complete";
  renderProgress(0, 0);
  hideStar();
  hideDistractor();
  setCharacter(ASSETS.testActive, true);
  setHeader("游戏完成");
  showStateCard({
    eyebrow: "全部完成",
    title: "你完成了星星游戏！",
    text: "谢谢你一直认真听声音。",
    button: "再玩一次",
    centered: true,
  });
  setPrompt("谢谢你", "可以休息一下啦。");
  await playNarration("taskEnd", "游戏完成，谢谢你。");
}

async function runTrialSeries({ condition, prefix, trials, distractor }) {
  renderProgress(trials.length, 0);

  for (let index = 0; index < trials.length; index += 1) {
    setStarState("idle");
    elements.starStage.classList.add("is-entering");
    renderProgress(trials.length, index);
    setPrompt("仔细听声音", "星星准备好了……");

    if (distractor) {
      showDistractor(index);
      await wait(SETTINGS.distractorLeadMs);
    } else {
      hideDistractor();
    }

    await wait(SETTINGS.preStimulusMs);
    elements.starStage.classList.remove("is-entering");

    const result = await runSingleTrial({
      ...trials[index],
      trialId: `${prefix}${index + 1}`,
      condition,
      logResult: true,
    });

    console.log("[T03 trial]", JSON.stringify(result));
    renderProgress(trials.length, index + 1);
    setPrompt("继续听", "下一颗星星马上出现。");
    await wait(SETTINGS.interTrialMs);
  }
}

function runSingleTrial(trial) {
  activeTrial = trial;
  trialLocked = true;
  setStarState("idle");
  elements.starButton.disabled = true;

  return new Promise(async (resolve) => {
    responseResolver = resolve;
    const stimulus = audio[trial.sound];
    stimulus.pause();
    stimulus.currentTime = 0;
    let started = false;

    const beginResponseWindow = () => {
      if (started) return;
      started = true;
      responseStartedAt = performance.now();
      trialLocked = false;
      elements.starButton.disabled = false;
      elements.starImage.classList.add("is-listening");
      setPrompt("现在听声音", "按照刚才学会的规则来做。");
      responseTimer = window.setTimeout(
        () => finishResponse("no_click", null),
        SETTINGS.responseWindowMs,
      );
    };

    stimulus.addEventListener("playing", beginResponseWindow, { once: true });
    try {
      await stimulus.play();
    } catch {
      beginResponseWindow();
    }
  });
}

function handleStarClick() {
  if (trialLocked || !activeTrial) return;
  const reactionTime = Math.round(performance.now() - responseStartedAt);
  finishResponse("click", reactionTime);
}

async function finishResponse(response, reactionTime) {
  if (trialLocked || !activeTrial) return;
  trialLocked = true;
  elements.starButton.disabled = true;
  elements.starImage.classList.remove("is-listening");
  window.clearTimeout(responseTimer);

  const trial = activeTrial;
  const result = {
    trial_id: trial.trialId,
    condition: trial.condition,
    sound: trial.sound,
    response,
    reaction_time: reactionTime,
    accuracy: response === trial.correctResponse,
  };

  if (response === "click") {
    setStarState("active");
    await wait(SETTINGS.clickFeedbackMs);
    setStarState("idle");
  } else {
    await wait(220);
  }

  const resolve = responseResolver;
  activeTrial = null;
  responseResolver = null;
  resolve(result);
}

function showDistractor(index) {
  const waving = index % 2 === 1;
  elements.distractorStart.src = waving
    ? ASSETS.monkeyWaveStart
    : ASSETS.monkeyWalkStart;
  elements.distractorEnd.src = waving
    ? ASSETS.monkeyWaveEnd
    : ASSETS.monkeyWalkEnd;
  elements.distractor.classList.remove("is-hidden", "is-active");
  void elements.distractor.offsetWidth;
  elements.distractor.classList.add("is-active");
}

function hideDistractor() {
  elements.distractor.classList.remove("is-active");
  elements.distractor.classList.add("is-hidden");
}

function setStarState(mode) {
  const active = mode === "active";
  elements.starImage.src = active ? ASSETS.starActive : ASSETS.starIdle;
  elements.starImage.classList.toggle("is-received", active);
}

function showStar() {
  elements.starStage.classList.remove("is-hidden");
  elements.starStage.classList.add("stage-fade-in");
}

function hideStar() {
  trialLocked = true;
  elements.starButton.disabled = true;
  elements.starStage.classList.add("is-hidden");
}

async function changeScene(source) {
  if (elements.sceneImage.getAttribute("src") === source) return;
  elements.sceneImage.classList.add("is-changing");
  await wait(230);
  await loadInto(elements.sceneImage, source);
  elements.sceneImage.classList.remove("is-changing");
}

function setScene(source) {
  elements.sceneImage.src = source;
}

function setCharacter(source, visible) {
  if (elements.characterImage.getAttribute("src") !== source) {
    elements.characterImage.src = source;
  }
  elements.characterImage.classList.toggle("is-hidden-soft", !visible);
}

function showStateCard({ eyebrow, title, text, button, centered }) {
  elements.cardEyebrow.textContent = eyebrow;
  elements.cardTitle.textContent = title;
  elements.cardText.textContent = text;
  elements.cardButton.textContent = button;
  elements.cardButton.disabled = false;
  elements.cardButton.classList.toggle("is-hidden", !button);
  elements.stateCard.classList.toggle("is-centered", centered);
  elements.stateCard.classList.remove("is-hidden", "is-leaving");
}

async function hideStateCard() {
  elements.stateCard.classList.add("is-leaving");
  await wait(300);
  elements.stateCard.classList.add("is-hidden");
}

function showActionButton(label) {
  elements.actionButton.textContent = label;
  elements.actionButton.classList.remove("is-hidden");
}

function hideActionButton() {
  elements.actionButton.classList.add("is-hidden");
}

function setHeader(text) {
  elements.taskChip.textContent = text;
}

function setPrompt(kicker, text) {
  elements.promptText.classList.add("is-changing");
  window.setTimeout(() => {
    elements.promptKicker.textContent = kicker;
    elements.promptText.textContent = text;
    elements.promptText.classList.remove("is-changing");
  }, 170);
}

function renderProgress(total, completed) {
  if (!total) {
    elements.progressDots.replaceChildren();
    return;
  }
  elements.progressDots.replaceChildren(
    ...Array.from({ length: total }, (_, index) => {
      const dot = document.createElement("i");
      if (index < completed) dot.classList.add("is-done");
      return dot;
    }),
  );
}

async function playNarration(key, fallbackText) {
  stopNarration();
  const track = audio[key];
  if (!track) {
    await speakPrompt(fallbackText);
    return;
  }

  track.currentTime = 0;
  narrationTrack = track;
  try {
    await track.play();
    await Promise.race([
      once(track, "ended"),
      wait(15000),
    ]);
  } catch {
    await speakPrompt(fallbackText);
  } finally {
    narrationTrack = null;
  }
}

function stopNarration() {
  if (narrationTrack) {
    narrationTrack.pause();
    narrationTrack.currentTime = 0;
    narrationTrack = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speakPrompt(text) {
  if (!("speechSynthesis" in window)) return Promise.resolve();
  window.speechSynthesis.cancel();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.88;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    utterance.onend = resolve;
    utterance.onerror = resolve;
    window.speechSynthesis.speak(utterance);
    window.setTimeout(resolve, Math.max(2500, text.length * 260));
  });
}

function loadInto(image, source) {
  return new Promise((resolve) => {
    image.onload = resolve;
    image.onerror = resolve;
    image.src = source;
  });
}

function once(target, eventName) {
  return new Promise((resolve) => {
    target.addEventListener(eventName, resolve, { once: true });
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

/* The practice-complete card owns the formal-test button. */
elements.cardButton.addEventListener("click", () => {
  if (state === "practice-complete") startFormalTest();
  if (state === "complete") window.location.reload();
});
