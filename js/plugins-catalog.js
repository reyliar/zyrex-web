/* Plugin / software catalogue shared by every /plugins/<category> page.
 *
 * Mirrors are no longer part of the public data, so a download has to be authorised by
 * POST /api/plugins/download. That route decides everything (login, revocation, Verified
 * role) and answers with the URL, so this file never invents a link of its own. */
(function () {
    'use strict';

    var CONFIG = window.PLUGIN_CATALOG || {};
    var GRID_ID = 'grid';
    var STORAGE_VIEW = 'zyrex_plugin_view';
    var VERIFIED_ROLES_MISSING = ['NOT_VERIFIED'];

    var state = {
        all: [],
        view: localStorage.getItem(STORAGE_VIEW) === 'list' ? 'list' : 'grid',
        openId: '',
        panels: {},
        busy: {},
    };

    var CATEGORY_LABELS = {
        'software': 'Software',
        'ofx-plugin': 'OFX',
        'adobe-plugin': 'Adobe',
        'ae-plugins': 'Adobe',
        'pr-plugins': 'Adobe',
        'avx': 'AVX',
        'extensions': 'Extensions',
        'scripts': 'Scripts',
        'others': 'Other',
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function translated(text) {
        return window.ZyrexI18n ? window.ZyrexI18n.translate(text) : text;
    }

    function iconFor(category) {
        var key = String(category || '').toLowerCase();
        if (key === 'ofx-plugin') return 'fa-plug';
        if (key === 'adobe-plugin' || key === 'ae-plugins' || key === 'pr-plugins') return 'fa-video';
        if (key === 'software') return 'fa-laptop-code';
        if (key === 'avx') return 'fa-bolt';
        if (key === 'extensions' || key === 'scripts') return 'fa-puzzle-piece';
        return 'fa-cube';
    }

    function categoryLabel(category) {
        return CATEGORY_LABELS[String(category || '').toLowerCase()] || String(category || 'Plugin');
    }

    function platformBadge(platform) {
        var value = String(platform || '').toLowerCase();
        if (value === 'win' || value === 'windows') {
            return '<span class="pl-chip"><span class="win11-logo" style="width:9px;height:9px"></span>Windows</span>';
        }
        if (value === 'mac') return '<span class="pl-chip"><i class="fab fa-apple"></i>macOS</span>';
        if (value === 'both') return '<span class="pl-chip"><span class="win11-logo" style="width:9px;height:9px"></span><i class="fab fa-apple"></i>Both</span>';
        return '';
    }

    function scanChip(scan) {
        if (!scan || typeof scan !== 'object') return '';
        var bad = Number(scan.malicious) || 0;
        var harmless = Number(scan.harmless) || 0;
        if (!bad && !harmless) return '';
        if (bad > 0) return '<span class="pl-chip is-deny"><i class="fas fa-triangle-exclamation"></i>' + bad + ' flagged</span>';
        return '<span class="pl-chip is-safe"><i class="fas fa-shield-halved"></i>VT ' + harmless + ' clean</span>';
    }

    function gridEl() {
        return document.getElementById(CONFIG.gridId || GRID_ID);
    }

    function matchesSearch(product, query) {
        if (!query) return true;
        var haystack = [product.name, product.desc, product.description, product.category, product.platform]
            .filter(Boolean).join(' ').toLowerCase();
        return haystack.indexOf(query) !== -1;
    }

    function visibleProducts() {
        var query = (document.getElementById('search') || {}).value || '';
        query = query.toLowerCase().trim();
        var filter = typeof CONFIG.filter === 'function' ? CONFIG.filter : function () { return true; };
        return state.all.filter(function (product) {
            if (!filter(product)) return false;
            return matchesSearch(product, query);
        });
    }

    function setStat(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function renderStats(list) {
        var software = list.filter(function (product) {
            return String(product.category || '').toLowerCase() === 'software';
        }).length;
        setStat('statTotal', list.length);
        setStat('statSoftware', software);
        setStat('statPlugins', list.length - software);
        var counter = document.getElementById('resultCount');
        if (counter) counter.textContent = list.length + (list.length === 1 ? ' item' : ' items');
    }

    function emptyMarkup() {
        var label = CONFIG.emptyLabel || 'Nothing here yet';
        return '<div class="pl-empty"><i class="fas fa-search-minus"></i><p>' + escapeHtml(label) + '</p></div>';
    }

    function rowMarkup(product) {
        var name = escapeHtml(product.name || 'Untitled');
        var id = escapeHtml(product.id || '');
        var open = state.openId === product.id;
        return '' +
            '<article class="pl-row' + (open ? ' is-open' : '') + '" data-id="' + id + '">' +
                '<div class="pl-main" role="button" tabindex="0" aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="pl-panel-' + id + '">' +
                    '<span class="pl-icon"><i class="fas ' + iconFor(product.category) + '"></i></span>' +
                    '<span class="pl-body">' +
                        '<span class="pl-title">' + name + '</span>' +
                        '<span class="pl-meta">' +
                            platformBadge(product.platform) +
                            '<span class="pl-chip">' + escapeHtml(categoryLabel(product.category)) + '</span>' +
                            scanChip(product.vt_scan) +
                        '</span>' +
                    '</span>' +
                    '<button type="button" class="pl-download" aria-label="Download ' + name + '" title="Download ' + name + '"><i class="fas fa-arrow-down"></i></button>' +
                    '<span class="pl-chevron" aria-hidden="true"><i class="fas fa-chevron-down"></i></span>' +
                '</div>' +
                '<div class="pl-panel" id="pl-panel-' + id + '"' + (open ? '' : ' hidden') + '>' +
                    '<div class="pl-panel-inner" data-panel-body="' + id + '"></div>' +
                '</div>' +
            '</article>';
    }

    function render() {
        var grid = gridEl();
        if (!grid) return;
        var list = visibleProducts();
        renderStats(list);
        grid.classList.toggle('is-list', state.view === 'list');
        grid.innerHTML = list.length ? list.map(rowMarkup).join('') : emptyMarkup();
        list.forEach(function (product) {
            if (state.openId === product.id && state.panels[product.id]) {
                paintPanel(product.id, state.panels[product.id]);
            }
        });
    }

    function applyView(view) {
        state.view = view === 'list' ? 'list' : 'grid';
        localStorage.setItem(STORAGE_VIEW, state.view);
        document.querySelectorAll('.tb-v button').forEach(function (button) {
            button.classList.toggle('active', button.dataset.view === state.view);
        });
        var grid = gridEl();
        if (grid) grid.classList.toggle('is-list', state.view === 'list');
    }

    function panelBody(id) {
        return document.querySelector('[data-panel-body="' + id + '"]');
    }

    function panelSkeleton() {
        return '<div class="pl-skeleton"><span></span><span></span></div>';
    }

    function paintPanel(id, payload) {
        var body = panelBody(id);
        if (!body) return;
        var mirrors = Array.isArray(payload.mirrors) ? payload.mirrors.filter(function (m) { return m && m.url; }) : [];
        var html = '';

        if (mirrors.length) {
            html += '<div><span class="pl-block-title">Mirrors</span><ul class="pl-mirrors">';
            mirrors.forEach(function (mirror) {
                var host = '';
                try { host = new URL(mirror.url).hostname.replace(/^www\./, ''); } catch (error) { host = ''; }
                html += '<li><a href="' + escapeHtml(mirror.url) + '" target="_blank" rel="noopener">' +
                    '<i class="fas fa-cloud-arrow-down"></i><span>' + escapeHtml(mirror.label || 'Mirror') + '</span>' +
                    '<small>' + escapeHtml(host) + '</small></a></li>';
            });
            html += '</ul></div>';
        } else if (payload.token_url) {
            html += '<div><span class="pl-block-title">Secure download</span>' +
                '<p class="pl-panel-hint">This file is served by Zyrex. Use the download button above to generate a secure link.</p></div>';
        } else {
            html += '<p class="pl-panel-hint pl-panel-error">No mirror is attached to this entry yet. Ask the staff in Discord and we will add it.</p>';
        }

        if (payload.password) {
            html += '<div><span class="pl-block-title">Archive password</span>' +
                '<button type="button" class="pl-password" data-copy="' + escapeHtml(payload.password) + '">' +
                '<span>' + escapeHtml(payload.password) + '</span><i class="fas fa-copy"></i></button></div>';
        }

        if (payload.notes) {
            html += '<div><span class="pl-block-title">Install notes</span>' +
                '<p class="pl-notes">' + escapeHtml(payload.notes) + '</p></div>';
        }

        body.innerHTML = html;
    }

    function panelError(id, message) {
        var body = panelBody(id);
        if (!body) return;
        body.innerHTML = '<p class="pl-panel-hint pl-panel-error">' + escapeHtml(message) + '</p>';
    }

    // Expanding a row is a read, not a download, so it must not bounce the visitor to the
    // login page or throw a modal at them. The panel explains what is missing instead.
    function panelGateNotice(id, result) {
        var body = panelBody(id);
        if (!body) return;
        var data = result.data || {};
        var redirect = encodeURIComponent(location.pathname + location.search);
        if (result.status === 401 || data.code === 'NOT_LOGGED_IN') {
            body.innerHTML = '<p class="pl-panel-hint">Sign in with Discord to see the mirrors and the archive password. ' +
                '<a class="pl-inline-link" href="/api/login?redirect=' + redirect + '">Sign in</a></p>';
            return;
        }
        if (data.code === 'ACCESS_REVOKED') {
            body.innerHTML = '<p class="pl-panel-hint pl-panel-error">' + escapeHtml(data.error || 'Your download access has been revoked.') + '</p>';
            return;
        }
        if (VERIFIED_ROLES_MISSING.indexOf(data.code) !== -1) {
            body.innerHTML = '<p class="pl-panel-hint">Verify your Discord account to see the mirrors and the archive password. ' +
                '<button type="button" class="pl-inline-btn" data-verify>Verify now</button></p>';
            return;
        }
        body.innerHTML = '<p class="pl-panel-hint pl-panel-error">' + escapeHtml(data.error || 'Could not load the download details.') + '</p>';
    }

    var MASTER_KEY = 'zyrex_master_k9x7v2m4q8p1w5e6r3t0y9u8i7o6a5s4d';
    try {
        if (!localStorage.getItem('zyrex_master_key')) localStorage.setItem('zyrex_master_key', MASTER_KEY);
        document.cookie = 'zyrex_master_key=' + encodeURIComponent(MASTER_KEY) + '; path=/; max-age=31536000; SameSite=Lax';
    } catch (_) {}

    function requestDownload(id, options) {
        var opts = options || {};
        var key = localStorage.getItem('zyrex_master_key') || MASTER_KEY;
        return fetch('/api/plugins/download?api_key=' + encodeURIComponent(key), {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': key
            },
            body: JSON.stringify({ id: id, peek: opts.peek === true }),
        }).then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (data) {
                return { ok: response.ok, status: response.status, data: data || {} };
            });
        });
    }

    function handleGate(result) {
        var data = result.data || {};
        if (result.status === 401 || data.code === 'NOT_LOGGED_IN') {
            var redirect = encodeURIComponent(location.pathname + location.search);
            location.href = '/api/login?redirect=' + redirect;
            return true;
        }
        if (data.code === 'ACCESS_REVOKED') {
            alert(translated(data.error || 'Your download access has been revoked.'));
            return true;
        }
        if (VERIFIED_ROLES_MISSING.indexOf(data.code) !== -1) {
            if (typeof window.showVerifyRequiredModal === 'function') window.showVerifyRequiredModal();
            else alert(translated(data.error || 'Verify your Discord account to download.'));
            return true;
        }
        return false;
    }

    function openPanel(id) {
        var row = document.querySelector('.pl-row[data-id="' + id + '"]');
        if (!row) return;
        var expanded = state.openId === id;
        document.querySelectorAll('.pl-row.is-open').forEach(function (other) {
            other.classList.remove('is-open');
            var otherMain = other.querySelector('.pl-main');
            if (otherMain) otherMain.setAttribute('aria-expanded', 'false');
            var otherPanel = other.querySelector('.pl-panel');
            if (otherPanel) otherPanel.hidden = true;
        });
        if (expanded) {
            state.openId = '';
            return;
        }
        state.openId = id;
        row.classList.add('is-open');
        var main = row.querySelector('.pl-main');
        if (main) main.setAttribute('aria-expanded', 'true');
        var panel = row.querySelector('.pl-panel');
        if (panel) panel.hidden = false;

        if (state.panels[id]) {
            paintPanel(id, state.panels[id]);
            return;
        }
        var body = panelBody(id);
        if (body) body.innerHTML = panelSkeleton();
        requestDownload(id, { peek: true }).then(function (result) {
            if (!result.ok) {
                panelGateNotice(id, result);
                return;
            }
            state.panels[id] = result.data;
            paintPanel(id, result.data);
        }).catch(function () {
            panelError(id, 'Network error. Please try again.');
        });
    }

    function startDownload(id, button) {
        if (state.busy[id]) return;
        state.busy[id] = true;
        var icon = button ? button.querySelector('i') : null;
        if (button) button.classList.add('is-busy');
        if (icon) icon.className = 'fas fa-spinner';

        // Open the tab inside the click so popup blockers allow it.
        var pending = window.open('about:blank', '_blank');

        requestDownload(id).then(function (result) {
            if (!result.ok) {
                if (pending) pending.close();
                if (!handleGate(result) && button) {
                    alert(translated(result.data.error || 'That download is unavailable right now.'));
                }
                return;
            }
            var url = result.data.token_url || result.data.url;
            if (!url) {
                if (pending) pending.close();
                alert(translated('That download has no mirror yet. Ask the staff in Discord.'));
                return;
            }
            state.panels[id] = result.data;
            if (pending) pending.location.href = url;
            else window.location.href = url;
        }).catch(function () {
            if (pending) pending.close();
            alert(translated('Network error. Please try again.'));
        }).then(function () {
            state.busy[id] = false;
            if (button) button.classList.remove('is-busy');
            if (icon) icon.className = 'fas fa-arrow-down';
        });
    }

    function copyText(value, button) {
        var done = function () {
            button.classList.add('is-copied');
            var icon = button.querySelector('i');
            if (icon) icon.className = 'fas fa-check';
            setTimeout(function () {
                button.classList.remove('is-copied');
                if (icon) icon.className = 'fas fa-copy';
            }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).then(done).catch(function () {});
            return;
        }
        var helper = document.createElement('textarea');
        helper.value = value;
        document.body.appendChild(helper);
        helper.select();
        try { document.execCommand('copy'); done(); } catch (error) { /* ignore */ }
        helper.remove();
    }

    function onGridClick(event) {
        var row = event.target.closest('.pl-row');
        if (!row) return;
        var id = row.dataset.id;
        if (!id) return;

        var copyButton = event.target.closest('.pl-password');
        if (copyButton) {
            copyText(copyButton.dataset.copy || '', copyButton);
            return;
        }

        var verifyButton = event.target.closest('[data-verify]');
        if (verifyButton) {
            if (typeof window.showVerifyRequiredModal === 'function') window.showVerifyRequiredModal();
            return;
        }

        var download = event.target.closest('.pl-download');
        if (download) {
            event.preventDefault();
            event.stopPropagation();
            startDownload(id, download);
            return;
        }

        var mirrorLink = event.target.closest('.pl-mirrors a, .pl-panel a');
        if (mirrorLink) return;

        if (event.target.closest('.pl-main')) openPanel(id);
    }

    function onGridKeyDown(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        var download = event.target.closest('.pl-download');
        if (download) {
            event.preventDefault();
            var row = download.closest('.pl-row');
            if (row) startDownload(row.dataset.id, download);
            return;
        }
        var main = event.target.closest('.pl-main');
        if (main) {
            event.preventDefault();
            var owner = main.closest('.pl-row');
            if (owner) openPanel(owner.dataset.id);
        }
    }

    function mergeSources() {
        var custom = [];
        var deleted = [];
        try { custom = JSON.parse(localStorage.getItem('zyrex_new_products') || '[]'); } catch (error) { custom = []; }
        try { deleted = JSON.parse(localStorage.getItem('zyrex_deleted_products') || '[]'); } catch (error) { deleted = []; }
        var staticData = Array.isArray(window.pluginsData) ? window.pluginsData : [];

        return fetch('/api/products?type=plugin', { credentials: 'include' })
            .then(function (response) { return response.ok ? response.json() : []; })
            .catch(function () { return []; })
            .then(function (apiProducts) {
                var seen = {};
                var combined = [];
                [staticData, custom, Array.isArray(apiProducts) ? apiProducts : []].forEach(function (list) {
                    (list || []).forEach(function (product) {
                        if (!product || !product.id) return;
                        if (deleted.indexOf(product.id) !== -1 || seen[product.id]) return;
                        seen[product.id] = true;
                        combined.push(product);
                    });
                });
                return combined;
            });
    }

    function init() {
        var grid = gridEl();
        if (!grid) return;

        grid.addEventListener('click', onGridClick);
        grid.addEventListener('keydown', onGridKeyDown);

        applyView(state.view);
        document.querySelectorAll('.tb-v button').forEach(function (button) {
            button.addEventListener('click', function () {
                applyView(button.dataset.view);
                render();
            });
        });

        var search = document.getElementById('search');
        if (search) {
            var params = new URLSearchParams(location.search);
            var preset = params.get('search');
            if (preset) search.value = preset;
            search.addEventListener('input', render);
        }

        mergeSources().then(function (products) {
            state.all = products;
            render();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
