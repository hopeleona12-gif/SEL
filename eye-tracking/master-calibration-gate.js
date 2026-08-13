(function () {
  'use strict';
  const calibration = localStorage.getItem('sel.eye.calibration_status');
  if (calibration === 'success' && window.EyeTracking) {
    EyeTracking.init({ taskId: 'MASTER' }).catch(error => console.warn('[MASTER] eye_tracking_status=init_failed', error));
  }
  document.addEventListener('click', function (event) {
    if (event.target.id !== 'start') return;
    if (['success', 'skipped'].includes(localStorage.getItem('sel.eye.calibration_status'))) return;
    event.preventDefault(); event.stopImmediatePropagation();
    location.href = 'eye-tracking/calibration.html?return=../index.html';
  }, true);
})();
