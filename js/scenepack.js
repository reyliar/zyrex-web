/**
 * Scenepack title page: backdrop hero, poster sidebar, and the pack table
 * grouped by character with sortable columns and inline search.
 */
(function (window, document) {
    'use strict';
    var SP = window.Scenepacks;
    if (!SP) return;

    var data = null;
    var sort = { field: 'downloads', dir: -1 };
    var view = 'characters';
    var query = '';

    function el(id) { return document.getElementById(id); }

    function initials(name) {
        return String(name || '?').split(/\s+/).slice(0, 2).map(function (part) {
            return part.charAt(0).toUpperCase();
        }).join('');
    }

    function fail(message, notFound) {
        var loading = el('spLoading');
        if (loading) loading.style.display = 'none';
        var grid = el('spTitleGrid');
        if (grid) grid.style.display = 'none';
        var host = el('spFail');
        if (!host) return;
        host.style.display = 'block';
        host.innerHTML = '<div class="sp-table-empty">'
            + '<i class="fas fa-' + (notFound ? 'film-slash' : 'triangle-exclamation') + '" aria-hidden="true"></i>'
            + '<div style="font-size:1.05rem;font-weight:700;color:var(--sp-ink);margin-bottom:6px">'
            + (notFound ? 'Title not found' : 'Could not load this title') + '</div>'
            + '<div>' + SP.escapeHtml(message || '') + '</div>'
            + '<div style="margin-top:18px"><a class="sp-btn sp-btn-ghost" href="/scenepacks"><i class="fas fa-arrow-left" aria-hidden="true"></i> Browse scenepacks</a></div>'
            + '</div>';
    }

    function renderHero(title) {
        var bg = el('spHeroBg');
        if (!bg) return;
        var image = title.backdrop || title.avatar || title.poster || '';
        bg.innerHTML = image
            ? '<img src="' + SP.escapeAttr(image) + '" alt="" onerror="this.parentNode.style.background=\'#0a0a0c\';this.remove()">'
            : '';
        bg.style.display = image ? '' : 'none';
    }

    function renderSide(title) {
        var poster = el('spTitlePoster');
        if (poster) {
            var image = title.avatar || title.poster;
            poster.innerHTML = '<span class="sp-tile-fallback">' + SP.escapeHtml(title.name) + '</span>'
                + (image ? '<img src="' + SP.escapeAttr(image) + '" alt="' + SP.escapeAttr(title.name + ' poster') + '" onerror="this.style.display=\'none\'">' : '');
        }

        var imdb = el('spImdbRow');
        if (imdb) {
            if (title.rating) {
                imdb.hidden = false;
                imdb.href = title.imdb_id ? 'https://www.imdb.com/title/' + encodeURIComponent(title.imdb_id) + '/' : 'https://www.imdb.com/';
                imdb.target = '_blank';
                imdb.rel = 'noopener nofollow';
                imdb.innerHTML = '<span class="sp-imdb-tag">IMDb</span> ' + SP.escapeHtml(title.rating) + '/10'
                    + (title.votes ? '<span style="margin-left:auto;font-size:.74rem;color:var(--sp-muted);font-weight:400">' + SP.escapeHtml(title.votes) + ' votes</span>' : '');
            } else {
                imdb.hidden = true;
            }
        }

        var cast = el('spSideCast');
        if (cast) {
            cast.innerHTML = title.cast.length
                ? '<i class="fas fa-user-group" aria-hidden="true"></i><span>' + title.cast.map(function (name) {
                    return SP.escapeHtml(name);
                }).join(', ') + '</span>'
                : '';
            cast.style.display = title.cast.length ? '' : 'none';
        }

        var tagline = el('spSideTagline');
        if (tagline) {
            tagline.textContent = title.plot || '';
            tagline.style.display = title.plot ? '' : 'none';
        }
    }

    function renderHead(title) {
        var name = el('spTitleName');
        if (name) name.textContent = title.name;

        var status = el('spTitleStatus');
        if (status) {
            if (title.in_production === true) {
                status.hidden = false;
                status.innerHTML = '<i class="fas fa-hammer" aria-hidden="true"></i> In production';
            } else {
                status.hidden = true;
                status.innerHTML = '';
            }
        }

        var meta = el('spTitleMeta');
        if (meta) {
            var parts = [];
            if (title.year) parts.push(SP.escapeHtml(title.year));
            if (title.directors.length) {
                parts.push('Directed by ' + title.directors.map(function (director) {
                    return '<a href="https://www.imdb.com/find/?q=' + encodeURIComponent(director) + '&s=nm" target="_blank" rel="noopener nofollow">' + SP.escapeHtml(director) + '</a>';
                }).join(', '));
            }
            if (title.genres.length) parts.push(SP.escapeHtml(title.genres.join(', ')));
            if (title.type_label) parts.push(SP.escapeHtml(title.type_label));
            meta.innerHTML = parts.join(' · ');
        }

        var stats = el('spTitleStats');
        if (stats) {
            stats.innerHTML = '<b>' + data.stats.packs + '</b> scenepack' + (data.stats.packs === 1 ? '' : 's')
                + '<span class="sep"></span><b>' + Number(data.stats.downloads).toLocaleString('en-US') + '</b> downloads';
        }
    }

    function packChips(pack) {
        var chips = [];
        // The production the pack comes from leads the meta line; the character is
        // already the group heading, so repeating it here was noise.
        var production = (pack.movie && pack.movie.title) || '';
        if (production) chips.push('<span class="sp-mchip is-prod"><i class="fas fa-clapperboard" aria-hidden="true"></i>' + SP.escapeHtml(production) + '</span>');
        var container = (Array.isArray(pack.downloads) ? pack.downloads : []).map(function (version) { return version.format; }).filter(Boolean)[0] || pack.format;
        if (container) chips.push('<span class="sp-mchip is-format"><i class="fas fa-file-video" aria-hidden="true"></i>' + SP.escapeHtml(String(container).toUpperCase()) + '</span>');
        if (pack.quality) chips.push('<span class="sp-mchip is-quality"><i class="fas fa-layer-group" aria-hidden="true"></i>' + SP.escapeHtml(pack.quality) + '</span>');
        if (pack.encoding) chips.push('<span class="sp-mchip is-encoding"><i class="fas fa-microchip" aria-hidden="true"></i>' + SP.escapeHtml(pack.encoding) + '</span>');
        if (pack.actor) chips.push('<span class="sp-mchip is-actor"><i class="fas fa-user" aria-hidden="true"></i>' + SP.escapeHtml(pack.actor) + '</span>');
        if (pack.credit_name) chips.push('<span class="sp-mchip is-credit"><i class="fas fa-user-pen" aria-hidden="true"></i>' + SP.escapeHtml(pack.credit_name) + '</span>');
        return chips.length ? '<div class="sp-trow-chips">' + chips.join('') + '</div>' : '';
    }

    function packSize(pack) {
        var versions = Array.isArray(pack.downloads) ? pack.downloads : [];
        var withSize = versions.filter(function (version) { return version.size; })[0];
        return (withSize && withSize.size) || pack.file_size || '—';
    }

    /* ── Pack sheet ──────────────────────────────────────────────────────────
       Clicking a pack lists what can be downloaded. A single-file version shows
       one row, a Drive folder shows every clip, and each row streams through
       /api/scenepacks/:id/file so the cloud host never reaches the browser. */

    var sheetPack = null;

    function hasLink(pack) {
        var versions = Array.isArray(pack.downloads) ? pack.downloads : [];
        return versions.some(function (version) { return version.url || version.streamable || version.locked; });
    }

    function sheetHost() { return el('spSheet'); }

    function closeSheet() {
        var host = sheetHost();
        if (!host) return;
        host.hidden = true;
        host.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('sp-sheet-open');
        sheetPack = null;
    }

    function sheetChips(pack) {
        // Same order as the table: production first, then the technical details.
        var production = (pack.movie && pack.movie.title) || '';
        var parts = [production, pack.quality, pack.encoding, pack.credit_name].filter(Boolean);
        return parts.length
            ? parts.map(function (part) { return '<span>' + SP.escapeHtml(part) + '</span>'; }).join('')
            : '';
    }

    function fileIcon(format) {
        return ['MP4', 'M4V', 'WEBM', 'MOV', 'MKV'].indexOf(String(format || '').toUpperCase()) >= 0 ? 'fa-film' : 'fa-file';
    }

    function formatBytes(size) {
        var n = Number(size) || 0;
        if (!n) return '';
        if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
        if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
        if (n >= 1024) return Math.round(n / 1024) + ' KB';
        return n + ' B';
    }

    function fileRow(file) {
        var format = String(file.format || '').toUpperCase();
        var size = formatBytes(file.size);
        return '<div class="sp-file">'
            + '<i class="fas ' + fileIcon(format) + '" aria-hidden="true"></i>'
            + '<span class="sp-file-name" title="' + SP.escapeAttr(file.name) + '">' + SP.escapeHtml(file.name)
            + (file.parent ? '<small>' + SP.escapeHtml(file.parent) + '</small>' : '')
            + '</span>'
            + '<span class="sp-file-meta">'
            + (size ? '<span class="sp-file-size">' + SP.escapeHtml(size) + '</span>' : '')
            + (format ? '<span class="sp-file-ext">' + SP.escapeHtml(format) + '</span>' : '')
            + '</span>'
            + '<a class="sp-file-dl" href="' + SP.escapeAttr(file.url + '&dl=1') + '" download rel="noopener" aria-label="Download ' + SP.escapeAttr(file.name) + '">'
            + '<i class="fas fa-download" aria-hidden="true"></i></a>'
            + '</div>';
    }

    function sheetNote(message, kind, icon) {
        return '<div class="sp-sheet-note' + (kind ? ' is-' + kind : '') + '">'
            + '<i class="fas ' + (icon || 'fa-circle-info') + '" aria-hidden="true"></i>'
            + '<span>' + SP.escapeHtml(message) + '</span></div>';
    }

    async function openSheet(pack) {
        var host = sheetHost();
        if (!host) return;
        sheetPack = pack;
        host.hidden = false;
        host.setAttribute('aria-hidden', 'false');
        document.body.classList.add('sp-sheet-open');

        var titleNode = el('spSheetTitle');
        if (titleNode) titleNode.textContent = pack.title || 'Scenepack';
        var chips = el('spSheetChips');
        if (chips) chips.innerHTML = sheetChips(pack);
        var filesHost = el('spSheetFiles');
        var actions = el('spSheetActions');
        if (actions) actions.innerHTML = '';

        if (pack.locked) {
            if (filesHost) filesHost.innerHTML = sheetNote('Verified members can download this pack.', 'locked', 'fa-shield-halved');
            if (actions) {
                actions.innerHTML = '<a class="sp-btn sp-btn-primary" href="https://discord.gg/4J3tars4QS" target="_blank" rel="noopener">'
                    + '<i class="fab fa-discord" aria-hidden="true"></i> Get verified</a>';
            }
            return;
        }

        var versions = Array.isArray(pack.downloads) ? pack.downloads.filter(function (v) { return v.streamable || v.url; }) : [];
        var version = versions[0];
        if (!version) {
            if (filesHost) filesHost.innerHTML = sheetNote('No file has been attached to this pack yet.', '', 'fa-circle-minus');
            return;
        }

        if (filesHost) filesHost.innerHTML = sheetNote('Loading files…', '', 'fa-spinner fa-spin');

        try {
            var result = await SP.api('/api/scenepacks/' + encodeURIComponent(pack.id) + '/files?d=' + encodeURIComponent(version.id));
            var files = result.files || [];
            if (!files.length) {
                if (filesHost) filesHost.innerHTML = sheetNote('This storage link returned no files.', 'error', 'fa-triangle-exclamation');
                return;
            }
            if (filesHost) filesHost.innerHTML = files.map(fileRow).join('');
            if (actions) {
                // The storage provider is a backend detail; the modal only says how
                // many clips the pack contains.
                actions.innerHTML = result.directory && files.length > 1
                    ? '<span class="sp-sheet-meta">' + files.length + ' files</span>'
                    : '';
            }
        } catch (error) {
            if (filesHost) {
                filesHost.innerHTML = sheetNote(error.message || 'This file could not be prepared.', 'error', 'fa-triangle-exclamation');
            }
            if (error.code === 'NOT_VERIFIED' || error.code === 'LOGIN_REQUIRED' || error.code === 'ACCESS_REQUIRED') {
                if (actions) {
                    actions.innerHTML = '<a class="sp-btn sp-btn-primary" href="https://discord.gg/4J3tars4QS" target="_blank" rel="noopener">'
                        + '<i class="fab fa-discord" aria-hidden="true"></i> Get verified</a>';
                }
            }
        }
    }
    function bindSheet() {
        var host = sheetHost();
        if (!host) return;
        host.addEventListener('click', function (event) {
            if (event.target.closest('[data-sheet-close]')) closeSheet();
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && sheetPack) closeSheet();
        });
    }

    function row(pack, showSize) {
        var locked = pack.locked === true;
        var ready = hasLink(pack);
        return '<div class="sp-trow" role="button" tabindex="0" data-pack="' + SP.escapeAttr(pack.id) + '">'
            + '<div class="sp-trow-main">'
            + '<div class="sp-trow-title">' + SP.escapeHtml(pack.title)
            + (locked ? '<span class="sp-row-lock"><i class="fas fa-lock" aria-hidden="true"></i> Verified</span>' : '')
            + '</div>'
            + packChips(pack)
            + '</div>'
            + (showSize ? '<div class="sp-trow-size">' + SP.escapeHtml(packSize(pack)) + '</div>' : '')
            + '<div class="sp-trow-dls">' + Number(pack.downloads_count || 0).toLocaleString('en-US') + '</div>'
            + '<div class="sp-trow-go"><i class="fas ' + (ready ? 'fa-circle-arrow-down' : 'fa-circle-minus') + '" aria-hidden="true"></i></div>'
            + '</div>';
    }

    function sortedPacks() {
        var list = (data.packs || []).slice();
        var needle = query.toLowerCase();
        if (needle) {
            list = list.filter(function (pack) {
                return [pack.title, pack.character, pack.actor, pack.credit_name, pack.quality, pack.encoding]
                    .filter(Boolean).join(' ').toLowerCase().indexOf(needle) >= 0;
            });
        }
        list.sort(function (a, b) {
            if (sort.field === 'title') {
                return String(a.title).localeCompare(String(b.title)) * (sort.dir < 0 ? -1 : 1);
            }
            return ((Number(a.downloads_count) || 0) - (Number(b.downloads_count) || 0)) * (sort.dir < 0 ? -1 : 1);
        });
        return list;
    }

    function renderTable() {
        var host = el('spTable');
        if (!host) return;
        var list = sortedPacks();

        var titleSort = sort.field === 'title' ? (sort.dir < 0 ? 'fa-arrow-down' : 'fa-arrow-up') : 'fa-arrow-down-up-across-line';
        var dlSort = sort.field === 'downloads' ? (sort.dir < 0 ? 'fa-arrow-down' : 'fa-arrow-up') : 'fa-arrow-down-up-across-line';
        // A pack stored as a cloud folder has no single size, so the column is
        // dropped entirely instead of showing a dash for every row.
        var showSize = list.some(function (pack) {
            var size = packSize(pack);
            return Boolean(size) && size !== '—';
        });
        host.classList.toggle('sp-table-nosize', !showSize);

        var html = '<div class="sp-thead">'
            + '<button type="button" data-sort="title" class="' + (sort.field === 'title' ? 'is-sorted' : '') + '">Scenepack <i class="fas ' + titleSort + ' sort-icon" aria-hidden="true"></i></button>'
            + (showSize ? '<span class="num">Size</span>' : '')
            + '<button type="button" data-sort="downloads" class="num ' + (sort.field === 'downloads' ? 'is-sorted' : '') + '">Downloads <i class="fas ' + dlSort + ' sort-icon" aria-hidden="true"></i></button>'
            + '<span aria-hidden="true"></span>'
            + '</div>';

        if (!list.length) {
            html += '<div class="sp-table-empty"><i class="fas fa-box-open" aria-hidden="true"></i>'
                + (query ? 'No scenepack matches “' + SP.escapeHtml(query) + '”.' : 'No scenepacks published for this title yet.')
                + '</div>';
            host.innerHTML = html;
            return;
        }

        if (view === 'characters') {
            var groups = [];
            var index = {};
            list.forEach(function (pack) {
                var name = pack.character || 'Other scenepacks';
                if (!index[name]) {
                    index[name] = { name: name, actor: pack.actor || '', avatar: '', category: pack.character_category || '', packs: [] };
                    groups.push(index[name]);
                }
                if (!index[name].avatar && pack.character_avatar) index[name].avatar = pack.character_avatar;
                if (!index[name].category && pack.character_category) index[name].category = pack.character_category;
                index[name].packs.push(pack);
            });
            html += groups.map(function (group) {
                return '<div class="sp-group-head">'
                    + '<span class="sp-group-avatar">'
                    + (group.avatar
                        ? '<img src="' + SP.escapeAttr(group.avatar) + '" alt="" loading="lazy" onerror="this.remove()">'
                        : SP.escapeHtml(initials(group.name)))
                    + '</span>'
                    + '<div><b>' + SP.escapeHtml(group.name) + '</b>'
                    + (group.actor ? '<small>' + SP.escapeHtml(group.actor) + '</small>' : '')
                    + '</div>'
                    + (group.category
                        ? '<span class="sp-group-tag">' + SP.escapeHtml(group.category) + '</span>'
                        : '')
                    + '</div>'
                    + group.packs.map(function (pack) { return row(pack, showSize); }).join('');
            }).join('');
        } else {
            html += list.map(function (pack) { return row(pack, showSize); }).join('');
        }

        host.innerHTML = html;
    }

    function bindTable() {
        var host = el('spTable');
        if (!host) return;
        host.addEventListener('click', function (event) {
            var sortButton = event.target.closest('[data-sort]');
            if (sortButton) {
                var field = sortButton.getAttribute('data-sort');
                if (sort.field === field) sort.dir = sort.dir < 0 ? 1 : -1;
                else {
                    sort.field = field;
                    sort.dir = field === 'title' ? 1 : -1;
                }
                renderTable();
                return;
            }
            var rowNode = event.target.closest('[data-pack]');
            if (!rowNode) return;
            var pack = (data.packs || []).filter(function (entry) { return entry.id === rowNode.getAttribute('data-pack'); })[0];
            if (pack) openSheet(pack);
        });
        host.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            var rowNode = event.target.closest('[data-pack]');
            if (!rowNode) return;
            event.preventDefault();
            rowNode.click();
        });
    }

    function bindControls() {
        var search = el('spPackSearch');
        if (search) {
            search.addEventListener('input', SP.debounce(function () {
                query = search.value.trim();
                renderTable();
            }, 180));
        }
        Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (button) {
            button.addEventListener('click', function () {
                view = button.getAttribute('data-view');
                Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (other) {
                    other.classList.toggle('is-on', other === button);
                });
                renderTable();
            });
        });
    }

    async function load() {
        var key = SP.queryParam('key').trim();
        var packId = SP.queryParam('id').trim();
        try {
            if (!key && packId) {
                var single = await SP.api('/api/scenepacks/' + encodeURIComponent(packId));
                var movie = (single.item && single.item.movie) || {};
                key = movie.imdb_id ? 'imdb:' + String(movie.imdb_id).toLowerCase() : 'name:' + SP.slug(movie.title || single.item.title);
            }
            if (!key) {
                window.location.replace('/scenepacks');
                return;
            }
            data = await SP.api('/api/scenepacks/title?key=' + encodeURIComponent(key));
        } catch (error) {
            fail(error.status === 404 ? 'No scenepack has been published for this title.' : error.message, error.status === 404);
            return;
        }

        var title = data.title;
        document.title = title.name + ' | Zyrex Scenepacks';
        var crumb = el('spCrumbCurrent');
        if (crumb) crumb.textContent = title.name;
        renderHero(title);
        renderSide(title);
        renderHead(title);
        renderTable();

        var loading = el('spLoading');
        if (loading) loading.style.display = 'none';
        var grid = el('spTitleGrid');
        if (grid) grid.style.display = '';

        bindTable();
        bindControls();
        bindSheet();

        if (data.packs.length) {
            SP.api('/api/scenepacks/' + encodeURIComponent(data.packs[0].id) + '/view', { method: 'POST' }).catch(function () {});
        }
    }

    function start() {
        if (!el('spTitleGrid')) return;
        load();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})(window, document);
