/**
 * Zyrex page atmosphere
 * - diagonal entrance sweep + staggered reveal (top-left → right)
 * - cloud parallax
 * - idle chunk prefetch / on-demand data chunks
 *
 * Standalone: safe on pages that do not load script.js.
 */
(function (window, document) {
    'use strict';

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var body = document.body;
    if (!body) return;

    /* ---------------------------------------------------------------- sweep */
    function runSweep() {
        if (reduceMotion) return;
        body.classList.add('zr-sweeping', 'zr-entering');
        window.setTimeout(function () {
            body.classList.remove('zr-sweeping');
        }, 900);
        window.setTimeout(function () {
            body.classList.remove('zr-entering');
        }, 1400);
    }

    /* ------------------------------------------------- stagger hero content */
    var STAGGER_TARGETS = [
        '.hero-content', '.hero', '.heroModern', '.hero-helix', '.hero-brand',
        '.lp-hero', '.vf-topbar', '.page-header', '.st-hero', '.access-page', '.verify-card',
        'body > section', 'main > section', 'main > div', 'main > header'
    ];

    function firstPaintReveal() {
        if (reduceMotion) return;
        var seen = [];
        var nodes = [];

        STAGGER_TARGETS.forEach(function (selector) {
            var found = document.querySelectorAll(selector);
            for (var i = 0; i < found.length && nodes.length < 7; i++) {
                var el = found[i];
                if (el.closest('.zr-sweep, .lq-veil, .bg-aura')) continue;
                if (el.closest('.nav-links, .auth-dropdown, .footer, .site-footer')) continue;
                // The requests board owns its own motion; a staggered intro must never be
                // the reason its heading or cards are invisible on a slow device.
                if (el.closest('.requests-page, .request-dashboard, .request-explorer, #requestsGrid')) continue;
                if (seen.indexOf(el) !== -1) continue;
                // Skip blocks that start below the viewport: the scroll observer
                // handles those, otherwise they would animate while invisible.
                if (el.getBoundingClientRect().top > window.innerHeight * 0.95) continue;
                seen.push(el);
                nodes.push(el);
            }
        });

        nodes.forEach(function (el, index) {
            var delay = Math.min(index * 75, 450);
            el.style.setProperty('--zr-delay', delay + 'ms');
            el.classList.add('zr-in');

            // Drop the class once the intro finishes so nothing keeps overriding
            // the element's own transform/opacity afterwards.
            var done = function () {
                el.classList.remove('zr-in');
                el.style.removeProperty('--zr-delay');
            };
            el.addEventListener('animationend', function onEnd(event) {
                if (event.animationName !== 'zrSweepIn') return;
                el.removeEventListener('animationend', onEnd);
                done();
            });
            // The animation may be throttled or skipped entirely (background tab,
            // reduced motion, interrupted load). Never let the intro decide
            // whether the page is readable.
            window.setTimeout(done, delay + 1200);
        });
    }

    /* ------------------------------------------------------ scroll reveals */
    function setupScrollReveal() {
        if (reduceMotion || typeof window.IntersectionObserver !== 'function') return;

        // The requests board renders its own cards with their own entrance animation, and
        // its list is rebuilt whenever the member filters or a refresh lands. Tracking
        // those cards here used to leave a rebuilt board hidden behind .zr-reveal on slow
        // devices, so the whole page is left to its own motion.
        if (document.querySelector('.requests-page, #requestsGrid')) return;

        var candidates = document.querySelectorAll([
            'main section', '.section-padding', '.resource-card', '.stats-card', '.team-card',
            '.brand-showcase', '.about-intro-card', '.lp-sec', '.lp-card', '.lp-note',
            '.vf-card', '.access-card', '.bm-card', '.pf-card'
        ].join(','));

        var tracked = [];
        var queued = 0;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('zr-visible');
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

        Array.prototype.forEach.call(candidates, function (el) {
            if (el.classList.contains('zr-in')) return;
            // Only animate blocks that start below the fold; above-the-fold
            // content is already handled by the first-paint stagger.
            if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
            if (queued > 60) return;
            queued++;
            el.classList.add('zr-reveal');
            el.style.setProperty('--zr-delay', (queued % 4) * 60 + 'ms');
            tracked.push(el);
            observer.observe(el);
        });

        if (!tracked.length) return;

        // Fast scrolls, anchor jumps and restored scroll positions can move an
        // element past the viewport before the observer ever sees it, which
        // would leave the block invisible. Anything already above the fold is
        // flushed on scroll, and a timer guarantees nothing stays hidden.
        function flushPassed() {
            for (var i = tracked.length - 1; i >= 0; i--) {
                var el = tracked[i];
                if (el.getBoundingClientRect().top < window.innerHeight) {
                    el.classList.add('zr-visible');
                    observer.unobserve(el);
                    tracked.splice(i, 1);
                }
            }
        }

        var flushTimer = 0;
        window.addEventListener('scroll', function () {
            if (flushTimer) return;
            // Debounced: a scroll position that skipped past a block is only
            // interesting once the gesture settles, and measuring every frame
            // forces layout for every tracked block.
            flushTimer = window.setTimeout(function () {
                flushTimer = 0;
                flushPassed();
            }, 120);
        }, { passive: true });

        window.setTimeout(function () {
            tracked.forEach(function (el) {
                el.classList.add('zr-visible');
                observer.unobserve(el);
            });
            tracked.length = 0;
        }, 6000);
    }

    /* ------------------------------------------------------ chunk prefetch */
    var prefetched = false;

    function prefetchChunks() {
        if (prefetched) return;
        prefetched = true;

        // Only warm chunks this page can actually render, otherwise every page
        // downloads the comment thread viewer it will never open.
        var usesComments = document.getElementById('commentsSection') ||
            document.getElementById('presetRoot') ||
            document.querySelector('.preset-comments-deck, #commentsTreeContainer');
        if (!usesComments) return;

        var href = '/js/chunks/comments.chunk.js?v=6';
        if (document.querySelector('script[src="' + href + '"], link[href="' + href + '"]')) return;

        var link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'script';
        link.href = href;
        document.head.appendChild(link);
    }

    /**
     * Load a data/script chunk only when it is actually needed.
     * Used to keep large data files (plugins catalogue) off the critical path.
     */
    function loadChunk(src, done) {
        if (window.ZyrexChunkStore && window.ZyrexChunkStore.loadScriptChunk) {
            window.ZyrexChunkStore.loadScriptChunk(src).then(done || function () {}, function () {});
            return;
        }
        var existing = document.querySelector('script[src="' + src + '"]');
        if (existing) {
            existing.addEventListener('load', done || function () {});
            return;
        }
        var script = document.createElement('script');
        script.src = src;
        script.async = true;
        if (done) script.addEventListener('load', done);
        document.head.appendChild(script);
    }

    /* ------------------------------------------------------------- boot up */
    function boot() {
        runSweep();
        firstPaintReveal();

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(function () {
                setupScrollReveal();
                prefetchChunks();
            }, { timeout: 1600 });
        } else {
            window.setTimeout(function () {
                setupScrollReveal();
                prefetchChunks();
            }, 260);
        }

        // Large data chunks declared with data-zr-chunk are loaded on idle and
        // re-trigger any dependent refresh hook once available.
        var deferred = document.querySelectorAll('script[data-zr-chunk]');
        Array.prototype.forEach.call(deferred, function (node) {
            var src = node.getAttribute('data-zr-chunk');
            if (!src) return;
            var run = function () {
                loadChunk(src, function () {
                    if (typeof window.zrOnChunkReady === 'function') {
                        try { window.zrOnChunkReady(src); } catch (e) {}
                    }
                });
            };
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(run, { timeout: 2500 });
            } else {
                window.setTimeout(run, 900);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    window.ZyrexAtmosphere = {
        loadChunk: loadChunk,
        reduceMotion: reduceMotion
    };
})(window, document);
