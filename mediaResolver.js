(function installSELMediaResolver(global) {
  'use strict';

  if (global.SELMedia) return;

  const CDN_ORIGIN = 'https://media.seltest2026.xyz';
  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
  const MEDIA_EXTENSION = /\.(?:png|jpe?g|webp|gif|mp4|mp3|wav|m4a|webm|ogg)(?:$|[?#])/i;
  const EXCLUDED_PATH = /(?:^|\/)(?:api|data\/audio)(?:\/|$)/i;
  const fallbackState = new WeakMap();
  const successState = new WeakMap();
  const loggedUrls = new Set();
  const nativeImageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const nativeMediaSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');

  const forceEnabled = new URLSearchParams(global.location.search).get('mediaCdn') === '1';
  const enabled = (forceEnabled || !LOCAL_HOSTS.has(global.location.hostname))
    && global.__SEL_MEDIA_CDN_ENABLED__ !== false;

  function mediaLog(event, detail) {
    console.info(`[MEDIA] ${event}`, detail);
    global.dispatchEvent(new CustomEvent(event, { detail }));
  }

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
    if (pathname.startsWith('/assets/tasks/T03/')) return `/tasks/T03/frontend/dist/assets/tasks/T03/${pathname.slice('/assets/tasks/T03/'.length)}`;
    if (pathname.startsWith('/assets/T07/')) return `/tasks/T07/dist/assets/T07/${pathname.slice('/assets/T07/'.length)}`;
    return pathname;
  }

  function describe(value) {
    const local = sameOriginUrl(value);
    if (!enabled || !local) return { primary: value, fallback: null };
    const cdn = new URL(CDN_ORIGIN);
    cdn.pathname = canonicalMediaPath(local.pathname);
    cdn.search = local.search;
    if (!loggedUrls.has(cdn.href)) {
      loggedUrls.add(cdn.href);
      mediaLog('MEDIA_CDN_URL', { cdn_url: cdn.href, fallback_url: local.href });
    }
    return { primary: cdn.href, fallback: local.href };
  }

  function armFallback(element, fallback) {
    if (!fallback) {
      fallbackState.delete(element);
      return;
    }
    const state = { fallback, used: false, cdn: null };
    fallbackState.set(element, state);
    if (element.__selMediaFallbackBound) return;
    element.__selMediaFallbackBound = true;
    const successEvent = element instanceof HTMLImageElement ? 'load' : 'loadeddata';
    element.addEventListener(successEvent, () => {
      const current = fallbackState.get(element);
      if (!current || current.used || successState.get(element) === current.cdn) return;
      successState.set(element, current.cdn);
      mediaLog('MEDIA_CDN_SUCCESS', { cdn_url: current.cdn || element.currentSrc || element.src });
    });
    element.addEventListener('error', () => {
      const current = fallbackState.get(element);
      if (!current || current.used) return;
      current.used = true;
      const failedUrl = current.cdn || element.currentSrc || element.src;
      const mediaError = element instanceof HTMLMediaElement ? element.error : null;
      const fallbackReason = mediaError
        ? `media_error_${mediaError.code}${mediaError.message ? `: ${mediaError.message}` : ''}`
        : 'element_error';
      const descriptor = element instanceof HTMLImageElement ? nativeImageSrc : nativeMediaSrc;
      descriptor?.set?.call(element, current.fallback);
      if (element instanceof HTMLMediaElement) element.load();
      mediaLog('MEDIA_CDN_FALLBACK', {
        cdn_url: failedUrl,
        fallback_url: current.fallback,
        fallback_reason: fallbackReason,
      });
    });
  }

  function rememberCdn(element, primary, fallback) {
    armFallback(element, fallback);
    const state = fallbackState.get(element);
    if (state) state.cdn = primary;
  }

  function patchSrcSetter(prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'src');
    if (!descriptor?.get || !descriptor?.set || descriptor.set.__selMediaPatched) return;
    const patchedSet = function setMediaSrc(value) {
      const resolved = describe(String(value));
      rememberCdn(this, resolved.primary, resolved.fallback);
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
      rememberCdn(this, resolved.primary, resolved.fallback);
      return nativeSetAttribute.call(this, name, resolved.primary);
    }
    return nativeSetAttribute.call(this, name, value);
  };

  global.SELMedia = Object.freeze({
    cdnOrigin: CDN_ORIGIN,
    enabled,
    resolve(value) { return describe(value).primary; },
    fallback(value) { return describe(value).fallback; },
  });
})(window);
