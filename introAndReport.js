(() => {
  const INTRO_VIDEO = '/tasks/intro/%E8%BF%9B%E5%85%A5%E6%B8%B8%E6%88%8F.mp4';
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
    panel.innerHTML = '<video controls playsinline preload="metadata"></video><button>继续测评</button><p class="intro-error" hidden>引入视频加载失败，可继续测评。</p>';
    const video = panel.querySelector('video');
    const button = panel.querySelector('button');
    const error = panel.querySelector('.intro-error');
    if (!video || !button || !error) return;

    video.src = INTRO_VIDEO;
    video.load();
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
    button.textContent = new URLSearchParams(location.search).get('debug') === '1' ? '跳过/继续测评' : '继续测评';
    button.addEventListener('click', go);
    video.addEventListener('ended', go);
    video.addEventListener('error', () => { error.hidden = false; });
    video.addEventListener('play', () => { video.controls = false; }, { once: true });
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
