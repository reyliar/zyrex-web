/**
 * Scenepack Control — the admin panel that manages the whole scenepack system.
 *
 * Two panes: every pack with its moderation state, and every curated title page
 * with its "in production" flag. All calls go through the admin scenepack routes.
 */
(function (window, document) {
    'use strict';

    var SP = window.Scenepacks;
    if (!SP) return;

    var state = {
        tab: 'packs',
        packs: { q: '', status: 'all', page: 1, pages: 1, total: 0, items: [] },
        titles: { q: '', page: 1, pages: 1, total: 0, items: [] },
        overview: null
    };

    function el(id) { return document.getElementById(id); }
    var esc = SP.escapeHtml;
    var attr = SP.escapeAttr;

    function note(message, kind) {
        var host = el('spcNote');
        if (!host) return;
        if (!message) {
            host.style.display = 'none';
            host.textContent = '';
            return;
        }
        host.className = 'spc-note' + (kind ? ' is-' + kind : '');
        host.style.display = 'flex';
        host.innerHTML = '<i class="fas ' + (kind === 'err' ? 'fa-circle-exclamation' : kind === 'ok' ? 'fa-circle-check' : 'fa-circle-info')
            + '" aria-hidden="true"></i><span>' + esc(message) + '</span>';
    }

    function num(value) { return Number(value || 0).toLocaleString('en-US'); }

    /* ── Overview ─────────────────────────────────────────────────────────── */

    function renderStats() {
        var host = el('spcStats');
        if (!host) return;
        var data = state.overview;
        if (!data) {
            host.innerHTML = '';
            return;
        }
        var cards = [
            { label: 'Scenepacks', value: num(data.packs.total), icon: 'fa-box', hint: num(data.packs.published) + ' published' },
            { label: 'Drafts', value: num(data.packs.draft + data.packs.pending), icon: 'fa-pen-ruler', hint: num(data.packs.pending) + ' pending review' },
            { label: 'Title pages', value: num(data.titles.total), icon: 'fa-clapperboard', hint: num(data.titles.in_production) + ' in production' },
            { label: 'Downloads', value: num(data.packs.downloads), icon: 'fa-download', hint: num(data.packs.views) + ' views' }
        ];
        host.innerHTML = cards.map(function (card) {
            return '<article class="spc-stat">'
                + '<i class="fas ' + card.icon + '" aria-hidden="true"></i>'
                + '<div><span>' + esc(card.label) + '</span><b>' + esc(card.value) + '</b>'
                + '<small>' + esc(card.hint) + '</small></div>'
                + '</article>';
        }).join('');
    }

    async function loadOverview() {
        try {
            state.overview = await SP.api('/api/scenepacks/admin/overview');
            renderStats();
        } catch (error) {
            if (error.code === 'ADMIN_REQUIRED') note('This panel is limited to staff accounts.', 'err');
        }
    }

    /* ── Packs ────────────────────────────────────────────────────────────── */

    function statusClass(status) {
        return ['published', 'draft', 'pending', 'rejected'].indexOf(status) >= 0 ? status : 'draft';
    }

    function packRow(pack) {
        var storage = (pack.downloads || []).map(function (entry) { return entry.provider; }).filter(Boolean)[0] || 'No file';
        var poster = pack.thumbnail || (pack.movie && pack.movie.poster) || '';
        var meta = [pack.movie && pack.movie.title, pack.character, pack.quality, pack.encoding].filter(Boolean).join(' · ');
        var published = pack.status === 'published';
        return '<article class="spc-row" data-pack="' + attr(pack.id) + '">'
            + '<div class="spc-thumb">' + (poster ? '<img src="' + attr(poster) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '') + '</div>'
            + '<div class="spc-row-main">'
            + '<div class="spc-row-title">' + esc(pack.title)
            + '<span class="spc-pill is-' + statusClass(pack.status) + '">' + esc(pack.status || 'draft') + '</span>'
            + (pack.featured ? '<span class="spc-pill is-featured">Featured</span>' : '')
            + '</div>'
            + '<small>' + esc(meta || '—') + '</small>'
            + '<div class="spc-row-tags">'
            + '<span><i class="fas fa-database" aria-hidden="true"></i>' + esc(storage) + '</span>'
            + (pack.format ? '<span><i class="fas fa-file-video" aria-hidden="true"></i>' + esc(pack.format) + '</span>' : '')
            + '<span><i class="fas fa-download" aria-hidden="true"></i>' + num(pack.downloads_count) + '</span>'
            + '<span><i class="fas fa-eye" aria-hidden="true"></i>' + num(pack.views) + '</span>'
            + '</div></div>'
            + '<div class="spc-row-actions">'
            + '<a class="spc-btn" href="/upload-scenepack?id=' + encodeURIComponent(pack.id) + '" title="Edit"><i class="fas fa-pen" aria-hidden="true"></i></a>'
            + '<button type="button" class="spc-btn' + (published ? '' : ' is-on') + '" data-status="' + (published ? 'draft' : 'published') + '" title="' + (published ? 'Unpublish' : 'Publish') + '">'
            + '<i class="fas ' + (published ? 'fa-eye-slash' : 'fa-check') + '" aria-hidden="true"></i></button>'
            + '<button type="button" class="spc-btn' + (pack.featured ? ' is-on' : '') + '" data-featured="' + (pack.featured ? '0' : '1') + '" title="Feature">'
            + '<i class="fas fa-star" aria-hidden="true"></i></button>'
            + (pack.title_key ? '<a class="spc-btn" href="/scenepack?key=' + encodeURIComponent(pack.title_key) + '" target="_blank" rel="noopener" title="Open page"><i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></a>' : '')
            + '<button type="button" class="spc-btn is-danger" data-delete="' + attr(pack.id) + '" title="Delete"><i class="fas fa-trash" aria-hidden="true"></i></button>'
            + '</div>'
            + '</article>';
    }

    function renderPacks() {
        var host = el('spcPackList');
        if (!host) return;
        var data = state.packs;
        host.innerHTML = data.items.length
            ? data.items.map(packRow).join('')
            : '<div class="spc-empty"><i class="fas fa-box-open" aria-hidden="true"></i>Nothing matches this filter.</div>';
        var count = el('spcPackCount');
        if (count) count.textContent = data.total ? data.total + ' pack' + (data.total === 1 ? '' : 's') : '';
        pager(el('spcPackPager'), data.page, data.pages, loadPacks);
    }

    async function loadPacks(page) {
        var data = state.packs;
        data.page = Math.max(1, Number(page) || 1);
        var host = el('spcPackList');
        if (host) host.innerHTML = '<div class="spc-empty"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i>Loading…</div>';
        var params = new URLSearchParams({ page: String(data.page), limit: '20', status: data.status });
        if (data.q) params.set('q', data.q);
        try {
            var result = await SP.api('/api/scenepacks/admin/packs?' + params.toString());
            data.items = result.items || [];
            data.pages = result.pages || 1;
            data.total = result.total || 0;
            renderPacks();
        } catch (error) {
            if (host) host.innerHTML = '<div class="spc-empty">' + esc(error.message) + '</div>';
            if (error.code === 'ADMIN_REQUIRED') note('This panel is limited to staff accounts.', 'err');
        }
    }

    async function updatePack(id, patch, button) {
        if (button) button.disabled = true;
        try {
            await SP.api('/api/scenepacks/admin/packs/' + encodeURIComponent(id), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(patch)
            });
            note('Scenepack updated.', 'ok');
            await Promise.all([loadPacks(state.packs.page), loadOverview()]);
        } catch (error) {
            note(error.message, 'err');
            if (button) button.disabled = false;
        }
    }

    async function deletePack(id) {
        if (!window.confirm('Delete this scenepack? This cannot be undone.')) return;
        try {
            await SP.api('/api/scenepacks/' + encodeURIComponent(id), { method: 'DELETE' });
            note('Scenepack deleted.', 'ok');
            await Promise.all([loadPacks(state.packs.page), loadOverview()]);
        } catch (error) {
            note(error.message, 'err');
        }
    }

    /* ── Title pages ──────────────────────────────────────────────────────── */

    function titleRow(title) {
        var poster = title.poster || title.backdrop || '';
        var meta = [title.year, title.type === 'series' ? 'Series' : title.type === 'game' ? 'Game' : 'Movie',
            title.pack_count + ' pack' + (title.pack_count === 1 ? '' : 's')].filter(Boolean).join(' · ');
        return '<article class="spc-row" data-title="' + attr(title.key) + '">'
            + '<div class="spc-thumb">' + (poster ? '<img src="' + attr(poster) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '') + '</div>'
            + '<div class="spc-row-main">'
            + '<div class="spc-row-title">' + esc(title.name)
            + (title.in_production ? '<span class="spc-pill is-production">In production</span>' : '')
            + '</div>'
            + '<small>' + esc(meta) + '</small>'
            + '</div>'
            + '<div class="spc-row-actions">'
            + '<button type="button" class="spc-btn" data-scrape="' + attr(title.key) + '" title="Scrape IMDb"><i class="fas fa-rotate" aria-hidden="true"></i></button>'
            + '<label class="spc-switch" title="Mark as in production">'
            + '<input type="checkbox" data-production="' + attr(title.key) + '"' + (title.in_production ? ' checked' : '') + '>'
            + '<span></span></label>'
            + '<a class="spc-btn" href="/scenepack?key=' + encodeURIComponent(title.key) + '" target="_blank" rel="noopener" title="Open page"><i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></a>'
            + '<button type="button" class="spc-btn is-danger" data-title-delete="' + attr(title.key) + '" title="Delete title page"><i class="fas fa-trash" aria-hidden="true"></i></button>'
            + '</div>'
            + '</article>';
    }

    function renderTitles() {
        var host = el('spcTitleList');
        if (!host) return;
        var data = state.titles;
        host.innerHTML = data.items.length
            ? data.items.map(titleRow).join('')
            : '<div class="spc-empty"><i class="fas fa-clapperboard" aria-hidden="true"></i>No title pages yet — create one in the studio.</div>';
        var count = el('spcTitleCount');
        if (count) count.textContent = data.total ? data.total + ' title page' + (data.total === 1 ? '' : 's') : '';
        pager(el('spcTitlePager'), data.page, data.pages, loadTitles);
    }

    async function loadTitles(page) {
        var data = state.titles;
        data.page = Math.max(1, Number(page) || 1);
        var host = el('spcTitleList');
        if (host) host.innerHTML = '<div class="spc-empty"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i>Loading…</div>';
        var params = new URLSearchParams({ page: String(data.page), limit: '20' });
        if (data.q) params.set('q', data.q);
        try {
            var result = await SP.api('/api/scenepacks/admin/titles?' + params.toString());
            data.items = result.items || [];
            data.pages = result.pages || 1;
            data.total = result.total || 0;
            renderTitles();
        } catch (error) {
            if (host) host.innerHTML = '<div class="spc-empty">' + esc(error.message) + '</div>';
        }
    }

    async function setProduction(key, wanted, input) {
        if (input) input.disabled = true;
        try {
            await SP.api('/api/scenepacks/admin/titles/' + encodeURIComponent(key), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ in_production: wanted })
            });
            note(wanted ? 'Marked as in production.' : 'Production flag removed.', 'ok');
            await Promise.all([loadTitles(state.titles.page), loadOverview()]);
        } catch (error) {
            if (input) {
                input.checked = !wanted;
                input.disabled = false;
            }
            note(error.message, 'err');
        }
    }

    // Manual scrape from the title row: refills the page and every pack on it.
    async function scrapeTitle(key, button) {
        if (!key) return;
        if (button) button.disabled = true;
        try {
            var result = await SP.api('/api/scenepacks/admin/titles/' + encodeURIComponent(key), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ scrape: true })
            });
            note('Scraped '
                + ((result.title && result.title.scraped_from) === 'rawg' ? 'RAWG' : 'IMDb')
                + (result.packs_updated ? ' · ' + result.packs_updated + ' pack refreshed' : '') + '.', 'ok');
            await Promise.all([loadTitles(state.titles.page), loadOverview()]);
        } catch (error) {
            note(error.message, 'err');
            if (button) button.disabled = false;
        }
    }

    async function deleteTitle(key) {        if (!window.confirm('Delete this title page? Packs stay in the catalogue.')) return;
        try {
            await SP.api('/api/scenepacks/admin/titles/' + encodeURIComponent(key), { method: 'DELETE' });
            note('Title page deleted.', 'ok');
            await Promise.all([loadTitles(state.titles.page), loadOverview()]);
        } catch (error) {
            note(error.message, 'err');
        }
    }

    /* ── Shared controls ──────────────────────────────────────────────────── */

    function pager(host, page, pages, go) {
        if (!host) return;
        if (pages <= 1) {
            host.innerHTML = '';
            return;
        }
        host.innerHTML = '<button type="button" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>'
            + '<i class="fas fa-chevron-left" aria-hidden="true"></i></button>'
            + '<span>' + page + ' / ' + pages + '</span>'
            + '<button type="button" data-page="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>'
            + '<i class="fas fa-chevron-right" aria-hidden="true"></i></button>';
        host.onclick = function (event) {
            var target = event.target.closest('[data-page]');
            if (!target || target.disabled) return;
            go(Number(target.getAttribute('data-page')));
        };
    }

    function switchTab(name) {
        state.tab = name;
        document.querySelectorAll('[data-spc-tab]').forEach(function (tab) {
            tab.classList.toggle('is-on', tab.getAttribute('data-spc-tab') === name);
        });
        document.querySelectorAll('[data-spc-pane]').forEach(function (pane) {
            pane.hidden = pane.getAttribute('data-spc-pane') !== name;
        });
        if (name === 'packs' && !state.packs.items.length) loadPacks(1);
        if (name === 'titles' && !state.titles.items.length) loadTitles(1);
    }

    function bind() {
        document.querySelectorAll('[data-spc-tab]').forEach(function (tab) {
            tab.addEventListener('click', function () { switchTab(tab.getAttribute('data-spc-tab')); });
        });

        var query = el('spcPackQuery');
        if (query) {
            query.addEventListener('input', SP.debounce(function () {
                state.packs.q = query.value.trim();
                loadPacks(1);
            }, 240));
        }
        var status = el('spcPackStatus');
        if (status) {
            status.addEventListener('change', function () {
                state.packs.status = status.value;
                loadPacks(1);
            });
        }
        var titleQuery = el('spcTitleQuery');
        if (titleQuery) {
            titleQuery.addEventListener('input', SP.debounce(function () {
                state.titles.q = titleQuery.value.trim();
                loadTitles(1);
            }, 240));
        }
        var refresh = el('spcRefresh');
        if (refresh) {
            refresh.addEventListener('click', function () {
                note('Refreshing…');
                Promise.all([
                    loadOverview(),
                    state.tab === 'titles' ? loadTitles(state.titles.page) : loadPacks(state.packs.page)
                ]).then(function () { note(''); });
            });
        }

        var packList = el('spcPackList');
        if (packList) {
            packList.addEventListener('click', function (event) {
                var row = event.target.closest('[data-pack]');
                if (!row) return;
                var id = row.getAttribute('data-pack');
                var statusButton = event.target.closest('[data-status]');
                if (statusButton) return updatePack(id, { status: statusButton.getAttribute('data-status') }, statusButton);
                var featuredButton = event.target.closest('[data-featured]');
                if (featuredButton) return updatePack(id, { featured: featuredButton.getAttribute('data-featured') === '1' }, featuredButton);
                var deleteButton = event.target.closest('[data-delete]');
                if (deleteButton) return deletePack(id);
            });
        }

        var titleList = el('spcTitleList');
        if (titleList) {
            titleList.addEventListener('change', function (event) {
                var toggle = event.target.closest('[data-production]');
                if (!toggle) return;
                setProduction(toggle.getAttribute('data-production'), toggle.checked, toggle);
            });
            titleList.addEventListener('click', function (event) {
                var scrapeButton = event.target.closest('[data-scrape]');
                if (scrapeButton) scrapeTitle(scrapeButton.getAttribute('data-scrape'), scrapeButton);
                var deleteButton = event.target.closest('[data-title-delete]');
                if (deleteButton) deleteTitle(deleteButton.getAttribute('data-title-delete'));
            });
        }
    }

    function start() {
        if (!el('spcPackList')) return;
        bind();
        loadOverview();
        loadPacks(1);
        loadTitles(1);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})(window, document);
