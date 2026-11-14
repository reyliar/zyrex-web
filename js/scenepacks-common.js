/**
 * Shared helpers for the scenepack surfaces (browse, title page, upload).
 *
 * Scenepack values come from uploader input, so every string that reaches the
 * DOM goes through ZyrexEscape when that helper is present.
 */
(function (window, document) {
    'use strict';

    var FALLBACK_POSTER = '/assets/content.png';

    function escapeHtml(value) {
        if (window.ZyrexEscape && typeof window.ZyrexEscape.html === 'function') {
            return window.ZyrexEscape.html(value);
        }
        return String(value == null ? '' : value).replace(/[&<>"'`]/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[ch];
        });
    }

    function escapeAttr(value) {
        if (window.ZyrexEscape && typeof window.ZyrexEscape.attr === 'function') {
            return window.ZyrexEscape.attr(value);
        }
        return escapeHtml(value);
    }

    function formatCount(value) {
        var n = Number(value) || 0;
        if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M';
        if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
        return String(n);
    }

    function formatDate(value) {
        var date = new Date(String(value || ''));
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    async function api(path, init) {
        var options = Object.assign({ credentials: 'include', headers: { Accept: 'application/json' } }, init || {});
        var response = await fetch(path, options);
        var data = null;
        try { data = await response.json(); } catch (_) { data = null; }
        if (!response.ok) {
            var message = (data && (data.error || data.message)) || ('Request failed (' + response.status + ')');
            var error = new Error(message);
            error.status = response.status;
            error.code = data && data.code;
            error.data = data;
            throw error;
        }
        return data || {};
    }

    function toastsRoot() {
        var root = document.getElementById('spToasts');
        if (!root) {
            root = document.createElement('div');
            root.id = 'spToasts';
            root.className = 'sp-toasts';
            root.setAttribute('role', 'status');
            root.setAttribute('aria-live', 'polite');
            document.body.appendChild(root);
        }
        return root;
    }

    function toast(message, kind, timeout) {
        var root = toastsRoot();
        var icons = { ok: 'fa-circle-check', err: 'fa-circle-exclamation', info: 'fa-circle-info' };
        var type = icons[kind] ? kind : 'info';
        var node = document.createElement('div');
        node.className = 'sp-toast ' + type;
        node.innerHTML = '<i class="fas ' + icons[type] + '" aria-hidden="true"></i><span>' + escapeHtml(message) + '</span>';
        root.appendChild(node);
        var ttl = Number(timeout) || (type === 'err' ? 6000 : 4000);
        setTimeout(function () {
            node.style.opacity = '0';
            node.style.transform = 'translateY(8px)';
            setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
        }, ttl);
    }

    function debounce(fn, wait) {
        var timer = null;
        return function () {
            var args = arguments;
            var self = this;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(self, args); }, wait || 220);
        };
    }

    function posterMarkup(pack, options) {
        var opts = options || {};
        var movie = pack.movie || {};
        var title = pack.title || movie.title || 'Scenepack';
        var poster = pack.thumbnail || movie.poster || '';
        var year = String(movie.year || '').slice(0, 4);
        var rating = movie.rating || '';
        var badges = [];

        if (pack.quality) badges.push('<span class="sp-badge sp-badge-accent">' + escapeHtml(pack.quality) + '</span>');
        if (pack.access === 'pass') badges.push('<span class="sp-badge sp-badge-pass"><i class="fas fa-crown" aria-hidden="true"></i> Pass</span>');

        var count = Number(pack.pack_count) || 0;
        var countMarkup = count > 1 ? '<span class="sp-card-packcount">' + count + ' packs</span>' : '';

        var meta = [];
        if (year) meta.push('<span>' + escapeHtml(year) + '</span>');
        if (rating) {
            meta.push('<span class="imdb"><i class="fas fa-star" aria-hidden="true"></i>' + escapeHtml(rating) + '</span>');
        }
        if (pack.downloads_count) meta.push('<span><i class="fas fa-download" aria-hidden="true"></i> ' + formatCount(pack.downloads_count) + '</span>');
        else if (pack.clip_count) meta.push('<span>' + formatCount(pack.clip_count) + ' clips</span>');

        var href = '/scenepack?id=' + encodeURIComponent(pack.id || '');
        var fallback = '<span class="sp-card-fallback">' + escapeHtml(title) + '</span>';
        var posterInner = poster
            ? '<img src="' + escapeAttr(poster) + '" alt="' + escapeAttr(title) + ' scenepack poster" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
            : '';
        var interactive = opts.href !== false;

        return '<a class="sp-card' + (interactive ? '' : ' is-static') + '" ' + (interactive ? 'href="' + escapeAttr(href) + '"' : 'role="presentation"') + ' data-id="' + escapeAttr(pack.id || '') + '">'
            + '<div class="sp-card-poster">'
            + fallback
            + posterInner
            + '<div class="sp-card-shade"></div>'
            + '<div class="sp-card-badges"><div style="display:flex;gap:6px;flex-wrap:wrap">' + badges.join('') + '</div>'
            + (pack.type_label ? '<span class="sp-badge sp-badge-count">' + escapeHtml(pack.type_label) + '</span>' : '')
            + '</div>'
            + countMarkup
            + '<div class="sp-card-body">'
            + '<div class="sp-card-title">' + escapeHtml(title) + '</div>'
            + (meta.length ? '<div class="sp-card-meta">' + meta.join('') + '</div>' : '')
            + '</div>'
            + '</div>'
            + '</a>';
    }

    function currentUser() {
        return window.currentUser || window._currentUser || null;
    }

    function displayNameOf(user) {
        if (!user) return '';
        return user.global_name || user.globalName || user.displayName || user.display_name || user.username || '';
    }

    function avatarOf(user) {
        if (!user) return '';
        return user.avatar_url || user.avatarUrl || user.avatar || '';
    }

    // Titles are what the catalogue lists; packs are what it downloads. This folds
    // pack rows into one card per movie/show/game.
    function groupByOrigin(items) {
        var groups = [];
        var index = {};
        (Array.isArray(items) ? items : []).forEach(function (pack) {
            var movie = pack.movie || {};
            var key = movie.imdb_id ? 'imdb:' + String(movie.imdb_id).toLowerCase() : 'name:' + slug(movie.title || pack.title || '');
            var entry = index[key];
            if (!entry) {
                entry = {
                    key: key,
                    title: movie.title || pack.title || 'Scenepack',
                    year: String(movie.year || '').slice(0, 4),
                    poster: pack.thumbnail || movie.poster || '',
                    type: pack.type || '',
                    downloads: 0,
                    pack_count: 0
                };
                index[key] = entry;
                groups.push(entry);
            }
            entry.downloads += Number(pack.downloads_count) || 0;
            entry.pack_count += 1;
            if (!entry.poster) entry.poster = pack.thumbnail || movie.poster || '';
        });
        return groups;
    }

    function slug(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function titleHref(key) {
        return '/scenepack?key=' + encodeURIComponent(key || '');
    }

    // Scenepacks ship as video files (mp4/mov), so the container comes from the
    // file name rather than a hard-coded archive type.
    var VIDEO_TYPES = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'mpg', 'mpeg'];

    function fileExtension(name) {
        var base = String(name == null ? '' : name).split(/[?#]/)[0].split('/').pop() || '';
        var match = base.match(/\.([A-Za-z0-9]{1,8})$/);
        return match ? match[1].toLowerCase() : '';
    }

    function mediaFormat(name) {
        var ext = fileExtension(name);
        return VIDEO_TYPES.indexOf(ext) >= 0 ? ext.toUpperCase() : '';
    }

    function queryParam(name) {        try {
            return new URLSearchParams(window.location.search).get(name) || '';
        } catch (_) {
            return '';
        }
    }

    function setQuery(params, historyMode) {
        var search = new URLSearchParams(window.location.search);
        Object.keys(params).forEach(function (key) {
            var value = params[key];
            if (value === '' || value === null || value === undefined) search.delete(key);
            else search.set(key, value);
        });
        var next = window.location.pathname + (search.toString() ? '?' + search.toString() : '');
        if (historyMode === false) window.location.href = next;
        else window.history.replaceState({}, '', next);
    }

    window.Scenepacks = {
        FALLBACK_POSTER: FALLBACK_POSTER,
        api: api,
        escapeHtml: escapeHtml,
        escapeAttr: escapeAttr,
        formatCount: formatCount,
        formatDate: formatDate,
        toast: toast,
        debounce: debounce,
        posterMarkup: posterMarkup,
        groupByOrigin: groupByOrigin,
        slug: slug,
        titleHref: titleHref,
        fileExtension: fileExtension,
        mediaFormat: mediaFormat,
        currentUser: currentUser,
        displayNameOf: displayNameOf,
        avatarOf: avatarOf,
        queryParam: queryParam,
        setQuery: setQuery
    };
})(window, document);
