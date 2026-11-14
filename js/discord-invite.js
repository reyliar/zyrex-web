// Keeps every invite link on the page pointing at the invite the API currently serves.
// Static anchors are already rewritten by the site gate; this catches the ones pages
// build after load (scenepack actions, the download-pass modal, chat bubbles).
(function () {
    'use strict';

    var ENDPOINT = '/api/discord/invite';
    var PATTERN = /^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,64}\/?$/i;
    var THROTTLE_MS = 500;
    var url = '';
    var queued = false;
    var lastRun = 0;

    function isInvite(href) {
        return Boolean(href) && PATTERN.test(String(href).trim());
    }

    function apply() {
        queued = false;
        if (!url) return;
        lastRun = Date.now();
        var links = document.querySelectorAll('a[href]');
        for (var i = 0; i < links.length; i++) {
            var href = links[i].getAttribute('href');
            if (href !== url && isInvite(href)) links[i].setAttribute('href', url);
        }
    }

    // Feeds mutate constantly, so the observer runs at most twice a second.
    function schedule() {
        if (queued) return;
        queued = true;
        setTimeout(apply, Math.max(0, THROTTLE_MS - (Date.now() - lastRun)));
    }

    function watch() {
        apply();
        if (typeof MutationObserver !== 'function') return;
        new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    }

    function load() {
        if (typeof fetch !== 'function') return;
        fetch(ENDPOINT, { credentials: 'omit', cache: 'no-store' })
            .then(function (response) { return response.ok ? response.json() : null; })
            .then(function (data) {
                if (!data || !isInvite(data.url)) return;
                url = String(data.url).trim();
                watch();
            })
            .catch(function () {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load, { once: true });
    } else {
        load();
    }
})();
