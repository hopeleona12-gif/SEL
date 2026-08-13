(function (global) {
  'use strict';
  const DB = 'sel-eye-tracking';
  const STORE = 'gaze-sessions';
  const state = {
    calibrationStatus: localStorage.getItem('sel.eye.calibration_status') || 'not_started',
    initialized: false, initializing: null, webgazerRunning: false, cameraStatus: 'not_started',
    sessionId: null, taskId: null, sceneId: null, startedAt: null, collecting: false,
    timer: null, samples: [], last: null, saved: false, eyeTrackingStatus: 'not_started',
    aoiRegions: [], taskViewport: null
  };

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'session_id' }); };
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
  const viewport = () => ({ x: 0, y: 0, width: global.innerWidth, height: global.innerHeight });
  const screenSize = () => `${global.innerWidth}x${global.innerHeight}`;
  function aoiAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const node = el?.closest?.('[data-gaze-aoi]');
    if (node) return node.getAttribute('data-gaze-aoi');
    const v = state.taskViewport || viewport();
    const nx = (x - v.x) / v.width, ny = (y - v.y) / v.height;
    return state.aoiRegions.find(r => nx >= r.x && nx <= r.x + r.width && ny >= r.y && ny <= r.y + r.height)?.name || 'other';
  }
  function takeSample() {
    if (!state.collecting || !state.webgazerRunning) return;
    const p = state.last;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    const v = state.taskViewport || viewport();
    state.samples.push({
      timestamp: new Date().toISOString(), gaze_x: p.x, gaze_y: p.y,
      x_norm: Math.max(0, Math.min(1, (p.x - v.x) / v.width)),
      y_norm: Math.max(0, Math.min(1, (p.y - v.y) / v.height)),
      task_viewport: v, AOI: aoiAt(p.x, p.y), validity: 'valid',
      task_id: state.taskId, scene_id: state.sceneId, screen_size: screenSize(),
      calibration_status: state.calibrationStatus
    });
  }
  function waitForFirstGaze(timeoutMs = 15000) {
    if (state.last) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const id = setInterval(() => {
        if (state.last) { clearInterval(id); resolve(); }
        else if (Date.now() - started >= timeoutMs) { clearInterval(id); reject(new Error('webgazer_no_prediction')); }
      }, 100);
    });
  }

  const api = {
    async init({ taskId = '', participantId = '' } = {}) {
      state.taskId = taskId; state.participantId = participantId;
      if (state.initialized && state.webgazerRunning) return api.status();
      if (state.initializing) return state.initializing;
      state.initializing = (async () => {
        if (!global.isSecureContext) throw new Error('camera_requires_secure_context');
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera_api_unavailable');
        if (!global.webgazer) throw new Error('webgazer_not_loaded');
        state.cameraStatus = 'requesting'; state.eyeTrackingStatus = 'initializing'; state.last = null;
        const permissionStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        const live = permissionStream.getVideoTracks().some(track => track.readyState === 'live');
        permissionStream.getTracks().forEach(track => track.stop());
        if (!live) throw new Error('camera_not_live');
        state.cameraStatus = 'granted';
        global.webgazer.setRegressionModel('ridge').setGazeListener(data => {
          if (data && Number.isFinite(Number(data.x)) && Number.isFinite(Number(data.y))) {
            state.last = { x: Number(data.x), y: Number(data.y), timestamp: new Date().toISOString() };
          }
        });
        await global.webgazer.begin();
        global.webgazer.showVideoPreview(true).showPredictionPoints(true).showFaceOverlay(false);
        state.webgazerRunning = true;
        await waitForFirstGaze();
        state.initialized = true; state.eyeTrackingStatus = 'ready';
        return api.status();
      })().catch(error => {
        state.initialized = false; state.webgazerRunning = false; state.cameraStatus = 'failed';
        state.eyeTrackingStatus = 'failed'; throw error;
      }).finally(() => { state.initializing = null; });
      return state.initializing;
    },
    setCalibrationStatus(status) { state.calibrationStatus = status; localStorage.setItem('sel.eye.calibration_status', status); },
    async startWindow({ taskId = state.taskId, sceneId = '', task_viewport = null } = {}) {
      if (!state.initialized || !state.webgazerRunning || !state.last) throw new Error('eye_tracking_not_ready');
      if (state.collecting) return state.sessionId;
      state.taskId = taskId; state.sceneId = sceneId; state.taskViewport = task_viewport || viewport();
      state.sessionId = `${taskId}-${sceneId}-${Date.now()}`; state.startedAt = new Date().toISOString();
      state.samples = []; state.saved = false; state.collecting = true; state.eyeTrackingStatus = 'collecting';
      takeSample(); state.timer = setInterval(takeSample, 100);
      return state.sessionId;
    },
    async stopWindow() {
      if (!state.collecting) {
        state.eyeTrackingStatus = state.initialized ? 'not_started' : 'failed';
        return { eye_tracking_status: state.eyeTrackingStatus, saved: false, samples: [] };
      }
      clearInterval(state.timer); state.timer = null; takeSample(); state.collecting = false;
      const endedAt = new Date().toISOString();
      const ok = state.samples.length > 0;
      const session = {
        session_id: state.sessionId, task_id: state.taskId, scene_id: state.sceneId,
        started_at: state.startedAt, ended_at: endedAt, calibration_status: state.calibrationStatus,
        eye_tracking_status: ok ? 'captured' : 'failed_no_samples', screen_size: screenSize(), samples: state.samples.slice()
      };
      if (!ok) { state.eyeTrackingStatus = 'failed_no_samples'; state.saved = false; return session; }
      try { await save(session); state.saved = true; state.eyeTrackingStatus = 'saved'; }
      catch (error) { state.saved = false; state.eyeTrackingStatus = 'save_failed'; session.eye_tracking_status = 'save_failed'; throw error; }
      state.lastSession = session; return session;
    },
    setAOIRegions(regions) { state.aoiRegions = Array.isArray(regions) ? regions : []; },
    status() {
      return { calibrationStatus: state.calibrationStatus, cameraStatus: state.cameraStatus,
        initialized: state.initialized, webgazerRunning: state.webgazerRunning,
        eyeTrackingStatus: state.eyeTrackingStatus, collecting: state.collecting,
        sampleCount: state.samples.length, savedIndexedDB: state.saved, currentGaze: state.last,
        currentAOI: state.last ? aoiAt(state.last.x, state.last.y) : null };
    },
    async listSessions() { const db = await openDb(); return new Promise((resolve, reject) => { const r = db.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); },
    async exportJson() { const text = JSON.stringify(await api.listSessions(), null, 2); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'eye-tracking-sessions.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  };
  global.EyeTracking = api;
})(window);
