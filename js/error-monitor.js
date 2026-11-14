/* Zyrex client error telemetry. Query strings, tokens, cookies and IPs are never sent. */
(function () {
  if (window.__zyrexErrorMonitorInstalled) return;
  window.__zyrexErrorMonitorInstalled = true;

  var endpoint = '/api/telemetry/client-error';
  var ownFetch = window.fetch.bind(window);
  var sent = new Set();
  // Every read this site issues is idempotent, so any dropped GET is replayed
  // before it is reported. A single packet loss must never page anyone.
  var READ_BACKOFF_MS = [300, 900];

  // A request that dies because the visitor is leaving the page, or because the
  // device itself lost its connection, is a client condition and not a site fault.
  var pageUnloading = false;
  window.addEventListener('pagehide', function () { pageUnloading = true; }, true);
  window.addEventListener('beforeunload', function () { pageUnloading = true; }, true);

  function clientSideNetworkCondition(error) {
    if (pageUnloading) return 'the page was being left';
    // Mobile browsers abort in-flight requests as soon as a tab is backgrounded.
    if (document.visibilityState === 'hidden') return 'the page was in the background';
    if (navigator.onLine === false) return 'the device was offline';
    var message = String((error && (error.message || error)) || '');
    if (/ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NETWORK_CHANGED|ERR_CONNECTION_RESET/i.test(message)) {
      return 'the device connection dropped';
    }
    return '';
  }
  function clean(value, max) {
    return String(value == null ? '' : value)
      .replace(/https?:\/\/[^\s?]+\?[^\s)]+/gi, '[url]')
      .replace(/\b(token|api[_-]?key|secret|authorization|cookie)=?[^\s&;,]*/gi, '$1=[redacted]')
      .replace(/[A-Za-z0-9_-]{48,}(?:\.[A-Za-z0-9_-]{20,})?/g, '[redacted]')
      .replace(/[\r\n\t]+/g, ' ')
      .slice(0, max || 400);
  }

  // A cross-origin script error is reduced to a bare "Script error." with no file, line
  // or message, so it can never be acted on. Third-party beacons (Cloudflare Web
  // Analytics, tag managers) raise these constantly and they must not page anyone.
  function isOpaqueScriptError(message, filename) {
    return !filename && /^Script error\.?(\s|$)/i.test(String(message || '').trim());
  }

  function report(event) {
    event = event || {};
    var page = location.pathname.slice(0, 180) || '/';
    var item = {
      source: 'browser',
      type: clean(event.type || 'client_error', 60),
      page: page,
      request_path: clean(event.request_path || '', 180).split('?')[0],
      method: clean(event.method || '', 12),
      status: Number(event.status) || 0,
      code: clean(event.code || '', 80),
      message: clean(event.message || 'Client error', 400),
      line: Number(event.line) || 0,
      column: Number(event.column) || 0
    };
    var key = [item.type, item.page, item.request_path, item.status, item.code, item.message].join('|');
    if (sent.has(key)) return;
    sent.add(key);
    if (sent.size > 50) sent.clear();

    var body = JSON.stringify(item);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))) return;
    } catch (_) {}
    ownFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      credentials: 'same-origin',
      keepalive: true
    }).catch(function () {});
  }

  // A failed element is re-checked before it is reported: an image or prefetch
  // cancelled by navigation raises the same event as a real outage.
  var assetProbeCache = new Map();
  function pageIsAway() {
    return pageUnloading || document.visibilityState === 'hidden';
  }
  function verifyAsset(href, callback) {
    var probe = assetProbeCache.get(href);
    if (!probe) {
      probe = ownFetch(href, { method: 'GET', credentials: 'same-origin', cache: 'no-store' })
        .then(function (response) { return !!response.ok; })
        .catch(function () { return false; });
      assetProbeCache.set(href, probe);
      window.setTimeout(function () { assetProbeCache.delete(href); }, 60000);
    }
    probe.then(callback);
  }

  window.addEventListener('error', function (event) {
    if (event.target && event.target !== window) {
      var target = event.target;
      // Players and speculative hints are re-fetched or dropped by the browser
      // itself; their error event says nothing about the site being broken.
      var tag = String(target.tagName || '').toUpperCase();
      if (tag === 'VIDEO' || tag === 'AUDIO' || tag === 'SOURCE' || tag === 'TRACK') return;
      if (tag === 'LINK' && /(?:^|\s)(?:prefetch|preconnect|dns-prefetch)(?:\s|$)/i.test(String(target.rel || ''))) return;
      if (!target.isConnected) return;
      // A page that installed its own fallback (an avatar falling back to the
      // default picture) already recovered, so there is nothing to alert on.
      if (tag === 'IMG' && target.hasAttribute('onerror')) return;
      var src = target.src || target.href || '';
      if (!src) return;
      var parsed;
      try { parsed = new URL(src, location.href); } catch (_) { return; }
      if (parsed.origin !== location.origin) return;
      if (pageIsAway() || navigator.onLine === false) return;
      verifyAsset(parsed.href, function (ok) {
        if (ok || pageIsAway()) return;
        report({ type: 'asset_load_error', request_path: parsed.pathname, message: (target.tagName || 'asset') + ' failed to load' });
      });
      return;
    }
    if (event.filename && /^(?:chrome|moz|safari|edge)-extension:\/\//i.test(event.filename)) return;
    if (isOpaqueScriptError(event.message, event.filename)) return;
    // Wallet and browser-extension scripts injected into the page report their
    // own failures here; they are not part of this site's code.
    if (/window\.ethereum|runtime\.sendMessage\(\)/i.test(String(event.message || ''))) return;
    var filePath = '';
    try { filePath = event.filename ? new URL(event.filename, location.href).pathname : ''; } catch (_) {}
    report({ type: 'javascript_error', message: event.message || event.error || 'Script error', request_path: filePath, line: event.lineno, column: event.colno });
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var rejectionMessage = reason && (reason.stack || reason.message) || reason || 'Unhandled promise rejection';
    if (/(?:chrome|moz|safari|edge)-extension:\/\//i.test(String(rejectionMessage))) return;
    report({ type: 'unhandled_rejection', message: rejectionMessage });
  });

  window.fetch = async function (input, init) {
    var rawUrl = typeof input === 'string' ? input : (input && input.url) || '';
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var parsed;
    try { parsed = new URL(rawUrl, location.href); } catch (_) { return ownFetch(input, init); }
    var isOwnApi = parsed.origin === location.origin && parsed.pathname.startsWith('/api/') && parsed.pathname !== endpoint;
    var canRetry = method === 'GET' && isOwnApi && !(init && init.signal && init.signal.aborted);

    async function retryRead() {
      await new Promise(function (resolve) { setTimeout(resolve, 300); });
      return ownFetch(input, init);
    }

    async function attemptReads() {
      var lastError;
      for (var attempt = 0; attempt <= READ_BACKOFF_MS.length; attempt++) {
        if (attempt > 0) {
          await new Promise(function (resolve) { setTimeout(resolve, READ_BACKOFF_MS[attempt - 1]); });
        }
        try {
          return await ownFetch(input, init);
        } catch (error) {
          if (error && error.name === 'AbortError') throw error;
          lastError = error;
        }
      }
      throw lastError;
    }

    async function reportServerError(response) {
      var details = { type: 'api_server_error', request_path: parsed.pathname, method: method, status: response.status, message: 'API request returned HTTP ' + response.status };
      try {
        var payload = await response.clone().json();
        details.code = payload.code || payload.error_code || '';
        // Without the server's own wording an alert such as "HTTP 500" says
        // nothing about the cause, so the real reason is carried through.
        var reason = payload.error || payload.message || payload.detail || '';
        if (reason) details.message = 'API request returned HTTP ' + response.status + ': ' + String(reason).slice(0, 220);
      } catch (_) {}
      report(details);
    }

    try {
      var response;
      if (canRetry) {
        response = await attemptReads();
      } else {
        response = await ownFetch(input, init);
      }

      if (isOwnApi && canRetry && response.status >= 500) {
        try { response = await retryRead(); } catch (_) {}
      }
      if (isOwnApi && response.status >= 500) await reportServerError(response);
      return response;
    } catch (error) {
      var requestAborted = (error && error.name === 'AbortError') || (init && init.signal && init.signal.aborted);
      if (isOwnApi && !requestAborted && !clientSideNetworkCondition(error)) {
        report({ type: 'api_network_error', request_path: parsed.pathname, method: method, message: error && (error.message || error) || 'Network request failed' });
      }
      throw error;
    }
  };
})();
