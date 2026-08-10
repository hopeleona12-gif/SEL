(() => {
  let shown = false;
  new MutationObserver(() => {
    const shell = document.querySelector('.task-shell'); const meta = shell?.querySelector('.task-meta strong');
    if (!shell || !meta || !meta.textContent.includes('T02') || shown) return;
    shown = true; const frame = shell.querySelector('iframe'); const original = frame.src; const panel = document.createElement('div'); panel.className = 'intro-panel'; panel.innerHTML = '<video controls playsinline preload="metadata"></video><button>继续测评</button><p class="intro-error" hidden>引入视频加载失败，可继续测评。</p>'; const video = panel.querySelector('video'); video.src = '/tasks/intro/进入游戏.mp4'; shell.insertBefore(panel, frame); frame.style.display = 'none'; const go = () => { panel.remove(); frame.style.display = ''; frame.src = original; }; panel.querySelector('button').onclick = go; video.onended = go; video.onerror = () => { panel.querySelector('.intro-error').hidden = false; }; video.onplay = () => { video.controls = false; }; if (new URLSearchParams(location.search).get('debug') === '1') panel.querySelector('button').textContent = '跳过/继续测评';
  }).observe(document.body, { childList: true, subtree: true });
})();
