(function () {
  'use strict';
  let started = false;
  const send = (type) => window.parent.postMessage({
    type, task_id: 'T02', scene_id: 'T02-B-clue',
    task_viewport: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
  }, '*');
  const observe = () => {
    const image = document.querySelector('#sceneImage');
    const mic = document.querySelector('#micBtn');
    const bScene = image && /T02_B01_windmill_interaction_base/i.test(image.src);
    if (bScene && !started) { started = true; window.parent.postMessage({type:'EYE_TRACKING_AOI', task_id:'T02', regions:[{name:'missing_part',x:.40,y:.29,width:.08,height:.16},{name:'windmill',x:.25,y:.12,width:.23,height:.55},{name:'material_area',x:.54,y:.47,width:.22,height:.25}]},'*'); send('EYE_TRACKING_START'); }
    if (started && mic && mic.classList.contains('recording')) { send('EYE_TRACKING_STOP'); started = false; }
  };
  document.addEventListener('click', (event) => {
    if (started && event.target.closest && event.target.closest('#cards .card')) {
      send('EYE_TRACKING_STOP'); started = false;
    }
  }, true);
  new MutationObserver(observe).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['src', 'class'] });
  setInterval(observe, 100);
})();
