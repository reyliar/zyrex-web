/**
 * Scenepacks browse page: trending / popular / new rails, "Top by category",
 * search suggestions and an expandable "See all" grid per rail.
 */
(function (window, document) {
    'use strict';
    var SP = window.Scenepacks;
    if (!SP) return;

    var home = null;
    var els = {};
    var searching = false;
    var filterState = { type: '', sort: 'recent' };

    function el(id) { return document.getElementById(id); }

    function tile(card) {
        var title = card.title || 'Scenepack';
        var img = card.poster
            ? '<img src="' + SP.escapeAttr(card.poster) + '" alt="" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
            : '';
        return '<a class="sp-tile" href="' + SP.escapeAttr(SP.titleHref(card.key)) + '" title="' + SP.escapeAttr(title + ' — ' + card.pack_count + ' scenepacks') + '">'
            + '<span class="sp-tile-fallback">' + SP.escapeHtml(title) + '</span>'
            + img
            + (card.pack_count > 1 ? '<span class="sp-tile-badge">' + card.pack_count + '</span>' : '')
            + '</a>';
    }

    function emptyRail(message) {
        return '<div class="sp-empty-rail"><i class="fas fa-film" aria-hidden="true"></i><span>'
            + SP.escapeHtml(message) + '</span></div>';
    }

    function renderRail(host, cards) {
        if (!host) return;
        host.classList.toggle('is-empty', !cards.length);
        host.innerHTML = cards.length ? cards.map(tile).join('') : emptyRail('Nothing here yet.');
        var seeAll = host.parentNode.querySelector('.sp-rail-head .see-all');
        if (seeAll) seeAll.style.display = cards.length ? '' : 'none';
    }

    function renderCats(categories) {
        var host = el('spCats');
        if (!host) return;
        if (!categories || !categories.length) {
            host.innerHTML = '';
            return;
        }
        host.innerHTML = categories.map(function (group) {
            var rows = group.items.length
                ? group.items.map(function (card) {
                    var img = card.poster ? '<img src="' + SP.escapeAttr(card.poster) + '" alt="" loading="lazy">' : '';
                    return '<a class="sp-cat-item" href="' + SP.escapeAttr(SP.titleHref(card.key)) + '">'
                        + '<span class="sp-cat-thumb"><span class="sp-tile-fallback">' + SP.escapeHtml(card.title) + '</span>' + img + '</span>'
                        + '<span class="sp-cat-body">'
                        + '<span class="sp-cat-title">' + SP.escapeHtml(card.title) + '</span>'
                        + '<span class="sp-cat-meta">'
                        + '<span><i class="fas fa-download" aria-hidden="true"></i> ' + SP.formatCount(card.downloads) + '</span>'
                        + '<span>' + card.pack_count + ' scenepack' + (card.pack_count === 1 ? '' : 's') + '</span>'
                        + '</span></span></a>';
                }).join('')
                : '<p class="sp-cat-meta" style="padding:12px 0;margin:0">No scenepacks yet.</p>';
            return '<div class="sp-cat-col">'
                + '<div class="sp-cat-head"><h3>' + SP.escapeHtml(group.label) + '</h3>'
                + '<a href="/scenepacks?type=' + SP.escapeAttr(group.type) + '">See all <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div>'
                + rows
                + '</div>';
        }).join('');
    }

    function railHead(name, sort) {
        return '<div class="sp-rail-head"><h2>' + name + '</h2>'
            + '<button type="button" class="see-all" data-see-all="' + sort + '">See all <i class="fas fa-arrow-right" aria-hidden="true"></i></button>'
            + '</div>';
    }

    function bindSeeAll() {
        document.addEventListener('click', function (event) {
            var button = event.target.closest('[data-see-all]');
            if (!button) return;
            var track = button.closest('.sp-rail').querySelector('.sp-rail-track');
            if (!track) return;
            var expanded = track.classList.toggle('is-expanded');
            if (expanded) button.innerHTML = 'Show less <i class="fas fa-arrow-up" aria-hidden="true"></i>';
            else button.innerHTML = 'See all <i class="fas fa-arrow-right" aria-hidden="true"></i>';
        });
    }

    async function loadHome() {
        try {
            home = await SP.api('/api/scenepacks/home');
        } catch (error) {
            var message = error.message || 'The catalogue is unavailable.';
            ['spTrending', 'spPopular', 'spNew'].forEach(function (id) {
                var host = el(id);
                if (host) host.innerHTML = emptyRail(message);
            });
            renderCats([]);
            return;
        }
        renderRail(el('spTrending'), home.rails.trending || []);
        renderRail(el('spPopular'), home.rails.popular || []);
        renderRail(el('spNew'), home.rails.new || []);
        renderCats(home.categories || []);
    }

    /* ── Search ───────────────────────────────────────────────────────────── */

    function setRailsVisible(visible) {
        ['spTrending', 'spPopular', 'spNew'].forEach(function (id) {
            var host = el(id);
            if (host && host.parentNode) host.parentNode.style.display = visible ? '' : 'none';
        });
        var cats = el('spCatsSection');
        if (cats) cats.style.display = visible ? '' : 'none';
        var results = el('spResultsSection');
        if (results) results.style.display = visible ? 'none' : '';
    }

    function renderResults(items, query) {
        var host = el('spResults');
        if (!host) return;
        var cards = SP.groupByOrigin(items);
        var label = el('spResultsLabel');
        if (label) {
            label.textContent = query
                ? 'Results for “' + query + '”'
                : (filterState.type ? filterState.type.charAt(0).toUpperCase() + filterState.type.slice(1) + ' scenepacks' : 'All scenepacks');
        }
        if (!cards.length) {
            host.classList.remove('is-expanded');
            host.classList.add('is-empty');
            host.innerHTML = '<div class="sp-empty-rail"><i class="fas fa-magnifying-glass" aria-hidden="true"></i><span>'
                + (query ? 'No scenepacks match that search.' : 'No scenepacks published yet.') + '</span></div>';
            return;
        }
        host.classList.remove('is-empty');
        host.classList.add('is-expanded');
        var seeAll = el('spResultsSeeAll');
        if (seeAll) seeAll.style.display = 'none';
    }

    async function runSearch() {
        var input = el('spSearch');
        var query = input ? input.value.trim() : '';
        var params = new URLSearchParams();
        if (query) params.set('q', query);
        if (filterState.type) params.set('type', filterState.type);
        if (filterState.sort) params.set('sort', filterState.sort);
        params.set('limit', '60');

        var active = Boolean(query || filterState.type || filterState.sort !== 'recent');
        searching = active;
        setRailsVisible(!active);
        hideSuggest();
        if (!active) return;

        var results = el('spResults');
        if (results) results.innerHTML = '<div class="sp-empty-rail"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Searching…</span></div>';
        try {
            var data = await SP.api('/api/scenepacks?' + params.toString());
            renderResults(data.items || [], query);
        } catch (error) {
            if (results) results.innerHTML = '<div class="sp-empty-rail"><i class="fas fa-plug-circle-xmark" aria-hidden="true"></i><span>' + SP.escapeHtml(error.message) + '</span></div>';
        }
    }

    /* ── Suggestions ──────────────────────────────────────────────────────── */

    function hideSuggest() {
        var box = el('spSuggest');
        if (box) {
            box.hidden = true;
            box.innerHTML = '';
        }
    }

    function showSuggest(cards, query) {
        var box = el('spSuggest');
        if (!box) return;
        if (!cards.length) {
            box.hidden = false;
            box.innerHTML = '<div class="sp-suggest-item"><span><b>No title matches “' + SP.escapeHtml(query) + '”</b>'
                + '<small>Try another spelling or paste an exact title.</small></span></div>';
            return;
        }
        box.hidden = false;
        box.innerHTML = cards.slice(0, 6).map(function (card) {
            var img = card.poster ? '<img src="' + SP.escapeAttr(card.poster) + '" alt="" loading="lazy">' : '<img alt="">';
            return '<a class="sp-suggest-item" href="' + SP.escapeAttr(SP.titleHref(card.key)) + '">'
                + img
                + '<span><b>' + SP.escapeHtml(card.title) + '</b><small>' + SP.escapeHtml(card.year || '') + ' · ' + card.pack_count + ' scenepack' + (card.pack_count === 1 ? '' : 's') + '</small></span>'
                + '</a>';
        }).join('');
    }

    var suggestQuery = SP.debounce(async function (value) {
        if (!value) { hideSuggest(); return; }
        try {
            var data = await SP.api('/api/scenepacks?q=' + encodeURIComponent(value) + '&limit=24');
            showSuggest(SP.groupByOrigin(data.items || []), value);
        } catch (_) {
            hideSuggest();
        }
    }, 260);

    /* ── Wiring ───────────────────────────────────────────────────────────── */

    function bindSearch() {
        var input = el('spSearch');
        if (!input) return;
        var submit = SP.debounce(runSearch, 380);
        input.addEventListener('input', function () {
            suggestQuery(input.value.trim());
            submit();
        });
        input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                hideSuggest();
                runSearch();
            }
            if (event.key === 'Escape') hideSuggest();
        });
        document.addEventListener('click', function (event) {
            if (!event.target.closest('.sp-suggest')) hideSuggest();
        });
        document.addEventListener('keydown', function (event) {
            var key = String(event.key || '').toLowerCase();
            if ((event.ctrlKey || event.metaKey) && key === 'k') {
                event.preventDefault();
                input.focus();
                input.select();
            }
        });
    }

    function bindFilters() {
        var toggle = el('spFiltersBtn');
        var panel = el('spFilterPanel');
        if (toggle && panel) {
            toggle.addEventListener('click', function () {
                var open = panel.hasAttribute('hidden');
                if (open) panel.removeAttribute('hidden');
                else panel.setAttribute('hidden', '');
                toggle.classList.toggle('is-on', open);
            });
        }

        Array.prototype.forEach.call(document.querySelectorAll('[data-type-filter]'), function (button) {
            button.addEventListener('click', function () {
                var value = button.getAttribute('data-type-filter') || '';
                filterState.type = filterState.type === value ? '' : value;
                Array.prototype.forEach.call(document.querySelectorAll('[data-type-filter]'), function (other) {
                    other.classList.toggle('is-on', (other.getAttribute('data-type-filter') || '') === filterState.type && filterState.type !== '');
                });
                runSearch();
            });
        });

        var sort = el('spFilterSort');
        if (sort) {
            sort.addEventListener('change', function () {
                filterState.sort = sort.value || 'recent';
                runSearch();
            });
        }
    }

    function start() {
        if (!el('spTrending')) return;
        els.trending = el('spTrending');
        var urlType = SP.queryParam('type');
        if (urlType) {
            filterState.type = urlType;
            Array.prototype.forEach.call(document.querySelectorAll('[data-type-filter]'), function (button) {
                button.classList.toggle('is-on', (button.getAttribute('data-type-filter') || '') === urlType);
            });
        }
        bindSearch();
        bindFilters();
        bindSeeAll();
        loadHome().then(function () {
            if (filterState.type) runSearch();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})(window, document);
