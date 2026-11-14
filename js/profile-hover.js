/* Shared, lightweight profile preview for feed authors and leak contributors. */
(function () {
    'use strict';
    if (window.ZyrexProfileHover) return;

    var cache = new Map();
    var active = null;
    var closeTimer = 0;
    var loadTimer = 0;
    var generation = 0;
    var panel = document.createElement('div');
    panel.className = 'zr-profile-preview';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Profile preview');
    document.body.appendChild(panel);

    function esc(value) {
        return String(value || '').replace(/[&<>"']/g, function (character) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
        });
    }

    function profileId(anchor) {
        var id = String(anchor.getAttribute('data-profile-id') || '').trim();
        if (/^\d{15,25}$/.test(id)) return id;
        try {
            var url = new URL(anchor.getAttribute('data-profile-href') || anchor.href || '', location.origin);
            id = String(url.searchParams.get('id') || '').trim();
            if (/^\d{15,25}$/.test(id)) return id;
            var handle = url.pathname.match(/^\/@([a-z0-9._-]{2,32})$/i);
            if (handle) return 'handle:' + handle[1];
        } catch (_) {}
        return '';
    }

    function position(anchor) {
        var rect = anchor.getBoundingClientRect();
        var width = Math.min(340, window.innerWidth - 24);
        var left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
        var top = rect.bottom + 10;
        if (top + panel.offsetHeight > window.innerHeight - 12 && rect.top > panel.offsetHeight + 16) top = rect.top - panel.offsetHeight - 10;
        panel.style.left = left + 'px';
        panel.style.top = Math.max(12, top) + 'px';
    }

    function render(profile, anchor) {
        if (!profile || !active || active.anchor !== anchor) return;
        var url = profile.url || anchor.getAttribute('data-profile-href') || anchor.href || ('/profile?id=' + encodeURIComponent(profile.id || ''));
        var avatar = profile.avatar || '/assets/default-avatar.png';
        panel.innerHTML = '<a class="zr-profile-preview-link" href="' + esc(url) + '">' +
            '<span class="zr-profile-preview-avatar"><img src="' + esc(avatar) + '" alt="" loading="lazy" onerror="this.src=\'/assets/default-avatar.png\'"></span>' +
            '<span class="zr-profile-preview-copy"><strong>' + esc(profile.name || 'Zyrex member') + (profile.is_admin ? ' <i class="fas fa-circle-check" aria-label="Verified"></i>' : '') + '</strong>' +
            (profile.handle ? '<small>@' + esc(profile.handle) + '</small>' : '') +
            '<span class="zr-profile-preview-tier">' + esc(profile.private ? 'Private profile' : (profile.tier_label || 'Zyrex member')) + '</span>' +
            (!profile.private && profile.bio ? '<span class="zr-profile-preview-bio">' + esc(profile.bio) + '</span>' : '') +
            '<span class="zr-profile-preview-action"><span data-i18n="View profile">View profile</span><i class="fas fa-arrow-up-right-from-square"></i></span></span></a>';
        panel.hidden = false;
        panel.classList.add('is-ready');
        position(anchor);
    }

    function load(id) {
        if (cache.has(id)) return Promise.resolve(cache.get(id));
        var endpoint = id.indexOf('handle:') === 0
            ? '/api/profile/preview?handle=' + encodeURIComponent(id.slice(7))
            : '/api/profile/preview?id=' + encodeURIComponent(id);
        return fetch(endpoint, { credentials: 'include', cache: 'no-store' }).then(function (response) {
            if (!response.ok) throw new Error('profile');
            return response.json();
        }).then(function (data) {
            if (!data || !data.success || !data.profile) throw new Error('profile');
            cache.set(id, data.profile);
            return data.profile;
        });
    }

    function closeSoon() {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(function () {
            panel.hidden = true;
            panel.classList.remove('is-ready');
            active = null;
        }, 180);
    }

    function open(anchor) {
        if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
        var id = profileId(anchor);
        if (!id) return;
        clearTimeout(closeTimer);
        clearTimeout(loadTimer);
        var token = ++generation;
        active = { anchor: anchor, id: id };
        loadTimer = setTimeout(function () {
            panel.classList.remove('is-ready');
            panel.innerHTML = '<div class="zr-profile-preview-loading"><span class="zr-profile-preview-spinner"></span><span>Loading profile…</span></div>';
            panel.hidden = false;
            position(anchor);
            load(id).then(function (profile) {
                if (token === generation) render(profile, anchor);
            }).catch(function () {
                if (token !== generation) return;
                panel.innerHTML = '<a class="zr-profile-preview-fallback" href="' + esc(anchor.href) + '">View profile <i class="fas fa-arrow-up-right-from-square"></i></a>';
                panel.hidden = false;
                position(anchor);
            });
        }, 320);
    }

    document.addEventListener('pointerover', function (event) {
        if (event.pointerType === 'touch') return;
        var anchor = event.target.closest && event.target.closest('[data-profile-preview]');
        if (anchor && !anchor.contains(event.relatedTarget)) open(anchor);
    }, true);
    document.addEventListener('pointerout', function (event) {
        var anchor = event.target.closest && event.target.closest('[data-profile-preview]');
        if (anchor && !anchor.contains(event.relatedTarget)) closeSoon();
    }, true);
    document.addEventListener('focusin', function (event) {
        var anchor = event.target.closest && event.target.closest('[data-profile-preview]');
        if (anchor) open(anchor);
    }, true);
    document.addEventListener('focusout', function (event) {
        if (event.target.closest && event.target.closest('[data-profile-preview]')) closeSoon();
    }, true);
    panel.addEventListener('pointerenter', function () { clearTimeout(closeTimer); });
    panel.addEventListener('pointerleave', closeSoon);
    panel.addEventListener('click', function (event) {
        var link = event.target.closest('a');
        if (link) window.location.href = link.href;
    });
    document.addEventListener('click', function (event) {
        var target = event.target.closest && event.target.closest('[data-profile-preview]');
        if (!target || target.tagName === 'A') return;
        var id = profileId(target);
        if (!id) return;
        event.preventDefault();
        window.location.href = target.getAttribute('data-profile-href') || (id.indexOf('handle:') === 0 ? '/@' + encodeURIComponent(id.slice(7)) : '/profile?id=' + encodeURIComponent(id));
    });
    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        var target = event.target.closest && event.target.closest('[data-profile-preview][role="link"]');
        if (!target) return;
        event.preventDefault();
        target.click();
    });
    window.addEventListener('resize', function () { if (active && !panel.hidden) position(active.anchor); }, { passive: true });
    window.addEventListener('scroll', function () { if (active && !panel.hidden) position(active.anchor); }, { passive: true });
    window.ZyrexProfileHover = { open: open, close: closeSoon };
})();
