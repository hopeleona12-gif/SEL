(() => {
  const INTRO_VIDEO = '/tasks/intro/%E8%BF%9B%E5%85%A5%E6%B8%B8%E6%88%8F.mp4';
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  let activeShell = null;
  let activePanel = null;
  let activeObserver = null;
  let cleanup = null;

  const isT02Shell = (shell) => {
    const label = shell?.querySelector('.task-meta strong')?.textContent || '';
    return label.includes('T02');
  };

  const clearIntro = () => {
    activeObserver?.disconnect();
    activeObserver = null;
    cleanup?.();
    cleanup = null;
    if (activePanel?.isConnected) activePanel.remove();
    if (activeShell?.isConnected) {
      const frame = activeShell.querySelector('iframe');
      if (frame) frame.style.display = '';
    }
    activePanel = null;
    activeShell = null;
  };

  const initIntro = (shell) => {
    if (!isT02Shell(shell) || shell === activeShell || shell.dataset.introCompleted === '1') return;
    clearIntro();
    const frame = shell.querySelector('iframe');
    if (!frame) return;

    activeShell = shell;
    const original = frame.src;
    const panel = document.createElement('div');
    panel.className = 'intro-panel';
    panel.innerHTML = '<video controls playsinline preload="metadata"></video><button>继续测评</button><p class="intro-error" hidden>引入视频加载失败，可继续测评。</p><pre class="intro-debug" hidden></pre>';
    const video = panel.querySelector('video');
    const button = panel.querySelector('button');
    const error = panel.querySelector('.intro-error');
    const debugBox = panel.querySelector('.intro-debug');
    if (!video || !button || !error || !debugBox) return;

    const trace = (event, extra = {}) => {
      const state = {
        event,
        src: video.getAttribute('src') || '',
        actual_src: video.src || '',
        currentSrc: video.currentSrc || '',
        readyState: video.readyState,
        networkState: video.networkState,
        video_error: video.error ? `${video.error.code}:${video.error.message || ''}` : '',
        ...extra
      };
      console.info('[INTRO_VIDEO]', state);
      if (debug) {
        debugBox.hidden = false;
        debugBox.textContent += `${JSON.stringify(state)}\n`;
      }
    };

    shell.insertBefore(panel, frame);
    frame.style.display = 'none';

    let finished = false;
    const go = () => {
      if (finished) return;
      finished = true;
      cleanup?.();
      panel.remove();
      frame.style.display = '';
      frame.src = original;
      shell.dataset.introCompleted = '1';
      activePanel = null;
      activeShell = null;
    };
    button.textContent = debug ? '跳过/继续测评' : '继续测评';
    button.addEventListener('click', go);
    video.addEventListener('ended', go);
    video.addEventListener('loadstart', () => trace('loadstart'));
    video.addEventListener('loadedmetadata', () => trace('loadedmetadata', { duration: video.duration }));
    video.addEventListener('canplay', () => trace('canplay', { duration: video.duration }));
    video.addEventListener('error', () => { trace('error'); error.hidden = false; });
    video.addEventListener('play', () => { video.controls = false; }, { once: true });

    trace('intro_created');
    video.src = INTRO_VIDEO;
    trace('src_assigned');
    video.load();
    trace('load_called');
    cleanup = () => {
      button.removeEventListener('click', go);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
    activePanel = panel;

    activeObserver = new MutationObserver(() => {
      if (!shell.isConnected || document.querySelector('.task-shell') !== shell) clearIntro();
    });
    activeObserver.observe(document.body, { childList: true, subtree: true });
  };

  const rootObserver = new MutationObserver(() => {
    const shell = document.querySelector('.task-shell');
    if (!shell) return clearIntro();
    initIntro(shell);
  });
  rootObserver.observe(document.body, { childList: true, subtree: true });
})();
