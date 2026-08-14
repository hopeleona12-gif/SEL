(function installSELMediaResolver(global) {
  'use strict';

  if (global.SELMedia) return;

  const CDN_ORIGIN = 'https://media.seltest2026.xyz';
  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
  const MEDIA_EXTENSION = /\.(?:png|jpe?g|webp|gif|mp4|mp3|wav|m4a|webm|ogg)(?:$|[?#])/i;
  const EXCLUDED_PATH = /(?:^|\/)(?:api|data\/audio)(?:\/|$)/i;
  const fallbackState = new WeakMap();
  const nativeImageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const nativeMediaSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');

  const enabled = !LOCAL_HOSTS.has(global.location.hostname)
    && global.__SEL_MEDIA_CDN_ENABLED__ !== false;

  function sameOriginUrl(value) {
    if (typeof value !== 'string' || !value || /^(?:blob:|data:|mediastream:)/i.test(value)) return null;
    let parsed;
    try {
      parsed = new URL(value, global.location.href);
    } catch {
      return null;
    }
    if (parsed.origin !== global.location.origin) return null;
    if (!MEDIA_EXTENSION.test(parsed.pathname) || EXCLUDED_PATH.test(parsed.pathname)) return null;
    return parsed;
  }

  function canonicalMediaPath(pathname) {
    if (pathname.startsWith('/task/T02/')) return `/tasks/T02/${pathname.slice('/task/T02/'.length)}`;
    if (pathname.startsWith('/task/T08/')) return `/tasks/T08/${pathname.slice('/task/T08/'.length)}`;
    if (pathname.startsWith('/assets/T07/')) return `/tasks/T07/dist/assets/T07/${pathname.slice('/assets/T07/'.length)}`;
    return pathname;
  }

  function describe(value) {
    const local = sameOriginUrl(value);
    if (!enabled || !local) return { primary: value, fallback: null };
    const cdn = new URL(CDN_ORIGIN);
    cdn.pathname = canonicalMediaPath(local.pathname);
    cdn.search = local.search;
    return { primary: cdn.href, fallback: local.href };
  }

  function armFallback(element, fallback) {
    if (!fallback) {
      fallbackState.delete(element);
      return;
    }
    const state = { fallback, used: false };
    fallbackState.set(element, state);
    if (element.__selMediaFallbackBound) return;
    element.__selMediaFallbackBound = true;
    element.addEventListener('error', () => {
      const current = fallbackState.get(element);
      if (!current || current.used) return;
      current.used = true;
      const descriptor = element instanceof HTMLImageElement ? nativeImageSrc : nativeMediaSrc;
      descriptor?.set?.call(element, current.fallback);
      if (element instanceof HTMLMediaElement) element.load();
      global.dispatchEvent(new CustomEvent('SEL_MEDIA_FALLBACK', {
        detail: { cdn_url: element.currentSrc || element.src, fallback_url: current.fallback },
      }));
    });
  }

  function patchSrcSetter(prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'src');
    if (!descriptor?.get || !descriptor?.set || descriptor.set.__selMediaPatched) return;
    const patchedSet = function setMediaSrc(value) {
      const resolved = describe(String(value));
      armFallback(this, resolved.fallback);
      descriptor.set.call(this, resolved.primary);
    };
    patchedSet.__selMediaPatched = true;
    Object.defineProperty(prototype, 'src', { ...descriptor, set: patchedSet });
  }

  patchSrcSetter(HTMLImageElement.prototype);
  patchSrcSetter(HTMLMediaElement.prototype);

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function setAttribute(name, value) {
    if (String(name).toLowerCase() === 'src'
      && (this instanceof HTMLImageElement || this instanceof HTMLMediaElement)) {
      const resolved = describe(String(value));
      armFallback(this, resolved.fallback);
      return nativeSetAttribute.call(this, name, resolved.primary);
    }
    return nativeSetAttribute.call(this, name, value);
  };

  const nativeFetch = global.fetch.bind(global);
  global.fetch = async function mediaAwareFetch(input, init) {
    const original = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    const resolved = describe(original);
    if (!resolved.fallback) return nativeFetch(input, init);
    try {
      const response = await nativeFetch(resolved.primary, init);
      if (response.ok) return response;
    } catch {
      // CDN CORS or network failure falls through to the original same-origin URL.
    }
    return nativeFetch(input, init);
  };

  global.SELMedia = Object.freeze({
    cdnOrigin: CDN_ORIGIN,
    enabled,
    resolve(value) { return describe(value).primary; },
    fallback(value) { return describe(value).fallback; },
  });
})(window);
