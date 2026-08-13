(function (global) {
  'use strict';
  const DB = 'sel-eye-tracking';
  const STORE = 'gaze-sessions';
  const state = { calibrationStatus: localStorage.getItem('sel.eye.calibration_status') || 'not_started', sessionId: null, taskId: null, sceneId: null, collecting: false, timer: null, samples: [], last: null, saved: false, aoiRegions: [], taskViewport: null };

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'session_id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function save(session) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(session);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  function viewport() { return { x: 0, y: 0, width: global.innerWidth, height: global.innerHeight }; }
  function screenSize() { return `${global.innerWidth}x${global.innerHeight}`; }
  function aoiAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const node = el && el.closest ? el.closest('[data-gaze-aoi]') : null;
    if (node) return node.getAttribute('data-gaze-aoi');
    const v = state.taskViewport || viewport(), nx = (x - v.x) / v.width, ny = (y - v.y) / v.height;
    return state.aoiRegions.find(r => nx >= r.x && nx <= r.x + r.width && ny >= r.y && ny <= r.y + r.height)?.name || 'other';
  }
  function sample() {
    if (!state.collecting || !global.webgazer) return;
    const p = state.last;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    const v = state.taskViewport || viewport();
    state.samples.push({ timestamp: new Date().toISOString(), gaze_x: p.x, gaze_y: p.y,
      x_norm: Math.max(0, Math.min(1, (p.x - v.x) / v.width)), y_norm: Math.max(0, Math.min(1, (p.y - v.y) / v.height)), task_viewport: v,
      AOI: aoiAt(p.x, p.y), validity: 'valid', task_id: state.taskId, scene_id: state.sceneId,
      screen_size: screenSize(), calibration_status: state.calibrationStatus });
  }
  const api = {
    async init({ taskId = '', participantId = '' } = {}) {
      state.taskId = taskId; state.participantId = participantId;
      if (!global.webgazer) throw new Error('WebGazer.js 未加载');
      await global.webgazer.setRegressionModel('ridge').setGazeListener((data) => {
        if (data) state.last = { x: Number(data.x), y: Number(data.y) };
      }).begin();
      global.webgazer.showVideoPreview(false).showPredictionPoints(false).showFaceOverlay(false);
      state.calibrationStatus = 'ready';
      return api.status();
    },
    setCalibrationStatus(status) { state.calibrationStatus = status; localStorage.setItem('sel.eye.calibration_status', status); },
    startWindow({ taskId = state.taskId, sceneId = '', task_viewport = null } = {}) {
      if (state.collecting) api.stopWindow();
      state.taskId = taskId; state.sceneId = sceneId; state.taskViewport = task_viewport || viewport(); state.sessionId = `${taskId}-${sceneId}-${Date.now()}`;
      state.samples = []; state.collecting = true; state.timer = setInterval(sample, 100);
      return state.sessionId;
    },
    async stopWindow() {
      if (!state.collecting) return null;
      clearInterval(state.timer); state.timer = null; sample(); state.collecting = false;
      const session = { session_id: state.sessionId, task_id: state.taskId, scene_id: state.sceneId,
        started_at: state.samples[0]?.timestamp || new Date().toISOString(), ended_at: new Date().toISOString(),
        calibration_status: state.calibrationStatus, screen_size: screenSize(), samples: state.samples.slice() };
      try { await save(session); state.saved = true; } catch (error) { state.saved = false; session.eye_tracking_status = 'save_failed'; throw error; }
      state.lastSession = session; return session;
    },
    setAOIRegions(regions) { state.aoiRegions = Array.isArray(regions) ? regions : []; },
    status() { return { calibrationStatus: state.calibrationStatus, collecting: state.collecting, sampleCount: state.samples.length, savedIndexedDB: state.saved, currentGaze: state.last, currentAOI: state.last ? aoiAt(state.last.x, state.last.y) : null }; },
    async listSessions() { const db = await openDb(); return new Promise((resolve, reject) => { const r = db.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); },
    async exportJson() { const text = JSON.stringify(await api.listSessions(), null, 2); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'eye-tracking-sessions.json'; a.click(); }
  };
  global.EyeTracking = api;
})(window);
