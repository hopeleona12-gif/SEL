(() => {
  const apply = () => document.querySelectorAll('iframe').forEach((frame) => {
    frame.setAttribute('allow', 'microphone; autoplay');
    frame.setAttribute('allowusermedia', '');
  });
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();
