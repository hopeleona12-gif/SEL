(function () {
  'use strict';
  var originalFetch = window.fetch.bind(window);
  var inflight = new Map();
  var retryable = function (url) { return String(url).indexOf('/api/v1/') >= 0; };
  var wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url;
    if (!retryable(url)) return originalFetch(input, init);
    var method = (init && init.method) || (typeof input !== 'string' && input.method) || 'GET';
    var body = (init && init.body) || '';
    var key = method + ' ' + url + ' ' + body;
    if (method !== 'GET' && inflight.has(key)) return inflight.get(key).then(function (response) { return response.clone(); });
    var promise = (async function () {
      var started = performance.now(), lastError;
      for (var attempt = 1; attempt <= 4; attempt++) {
        try {
          var response = await originalFetch(input, init);
          console.info('[T03 API]', method, url, response.status, Math.round(performance.now() - started) + 'ms', 'attempt=' + attempt);
          if (response.status >= 500 && attempt < 4) { await wait(attempt * 700); continue; }
          return response;
        } catch (error) {
          lastError = error;
          console.warn('[T03 API retry]', method, url, String(error), 'attempt=' + attempt);
          if (attempt < 4) await wait(attempt * 700);
        }
      }
      throw lastError || new Error('T03 API unavailable');
    })();
    if (method !== 'GET') { inflight.set(key, promise); promise.finally(function () { inflight.delete(key); }); }
    return promise;
  };
}());
