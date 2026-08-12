(() => {
  const install = () => {
    const shell = document.querySelector('.task-shell');
    const meta = shell?.querySelector('.task-meta');
    if (!shell || !meta || meta.querySelector('[data-fullscreen]')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.fullscreen = '1'; button.textContent = '全屏';
    button.onclick = async () => {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.requestFullscreen(); }
      catch { try { await shell.querySelector('iframe')?.requestFullscreen(); } catch {} }
    };
    meta.append(button);
  };
  new MutationObserver(install).observe(document.body, {childList:true, subtree:true});
  install();
})();
