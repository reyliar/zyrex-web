/**
 * Scenepack Studio — the admin publishing panel inside /upload.
 *
 * Three panes:
 *   Discover   — IMDb/RAWG search with numbered pages; turn a result into a
 *                curated title page.
 *   Title pages— numbered pages of every curated title, with its character
 *                scenepacks stored on Zyrex Cloud (SFTPGo/S3) or Google Drive.
 *   Storage    — browse the SFTPGo/S3 prefixes so a pack can point at a file
 *                without ever exposing the path to a visitor.
 */
(function (window, document) {
    'use strict';

    var state = {
        user: null,
        tab: 'discover',
        discover: { provider: 'movie', q: '', page: 1, pages: 1, total: 0, items: [] },
        titles: { q: '', page: 1, pages: 1, total: 0, items: [] },
        openTitle: null,
        packs: [],
        storage: { path: '' },
        busy: false,
        pickedKey: '',
        autoScraped: {}
    };

    function el(id) { return document.getElementById(id); }

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function attr(value) { return esc(value); }

    function bytes(size) {
        var n = Number(size) || 0;
        if (!n) return '—';
        if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
        if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
        if (n >= 1024) return Math.round(n / 1024) + ' KB';
        return n + ' B';
    }

    // Scenepacks are video scenes (mp4/mov), so the container is read from the
    // stored file name instead of being assumed to be an archive.
    var VIDEO_TYPES = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'mpg', 'mpeg'];

    function fileExtension(name) {
        var base = String(name == null ? '' : name).split(/[?#]/)[0].split('/').pop() || '';
        var match = base.match(/\.([A-Za-z0-9]{1,8})$/);
        return match ? match[1].toLowerCase() : '';
    }

    function packFormat(name) {
        var ext = fileExtension(name);
        return VIDEO_TYPES.indexOf(ext) >= 0 ? ext.toUpperCase() : '';
    }

    function fileIcon(name) {
        var ext = fileExtension(name);
        if (VIDEO_TYPES.indexOf(ext) >= 0) return 'fa-film';
        if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'fa-file-zipper';
        return 'fa-file';
    }

    // Mirrors the worker's parser so the studio can tell a file link from a
    // folder link and reject anything Drive cannot resolve.
    function driveRef(value) {
        var url = String(value || '').trim();
        if (!url) return null;
        if (/^[A-Za-z0-9_-]{20,}$/.test(url)) return { kind: 'file', id: url };
        if (!/drive\.google\.com|docs\.google\.com/i.test(url)) return null;
        var folder = url.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || url.match(/[?&]folder_?id=([A-Za-z0-9_-]{10,})/i);
        if (folder) return { kind: 'folder', id: folder[1] };
        var file = url.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/) || url.match(/\/d\/([A-Za-z0-9_-]{10,})/);
        if (file) return { kind: 'file', id: file[1] };
        var param = url.match(/[?&](?:id|file_id)=([A-Za-z0-9_-]{10,})/i);
        return param ? { kind: 'file', id: param[1] } : null;
    }

    async function api(path, options) {
        var init = Object.assign({ credentials: 'include', headers: { Accept: 'application/json' } }, options || {});
        var response = await fetch(path, init);
        var data = null;
        try { data = await response.json(); } catch (_) { data = null; }
        if (!response.ok) {
            var error = new Error((data && (data.error || data.message)) || ('Request failed (' + response.status + ')'));
            error.code = data && data.code;
            error.status = response.status;
            throw error;
        }
        return data || {};
    }

    async function uploadImage(file) {
        var dataUrl = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || '')); };
            reader.onerror = function () { reject(new Error('Could not read the image.')); };
            reader.readAsDataURL(file);
        });
        var base64 = dataUrl.split(',')[1] || '';
        var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        var name = 'scenepack-' + Date.now().toString(36) + '.' + ext;
        var data = await api('/api/thumbnails/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ filename: name, data: base64 })
        });
        var url = (data && data.url) || '';
        if (!url) throw new Error('The image upload did not return a URL.');
        return url;
    }

    function bindImagePicker(pickId, fileId, inputId, onDone) {
        var pick = el(pickId);
        var file = el(fileId);
        if (!pick || !file) return;
        pick.addEventListener('click', function () { file.click(); });
        file.addEventListener('change', async function () {
            if (!file.files || !file.files[0]) return;
            pick.disabled = true;
            try {
                var url = await uploadImage(file.files[0]);
                var input = el(inputId);
                if (input) input.value = url;
                if (onDone) await onDone(url);
                else note('Photo uploaded.', 'ok');
            } catch (error) {
                note(error.message, 'err');
            } finally {
                pick.disabled = false;
                file.value = '';
            }
        });
    }

    // Forces a fresh IMDb/RAWG pull for the open title page and every pack on it.
    async function scrapeTitlePage(button) {
        var title = state.openTitle;
        if (!title) return;
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Scraping…';
        }
        note('Scraping metadata…');
        try {
            var result = await api('/api/scenepacks/admin/titles/' + encodeURIComponent(title.key), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ scrape: true })
            });
            state.openTitle = Object.assign({}, title, result.title || {});
            note('Scraped from ' + ((result.title && result.title.scraped_from) === 'rawg' ? 'RAWG' : 'IMDb')
                + (result.packs_updated ? ' — ' + result.packs_updated + ' pack' + (result.packs_updated === 1 ? '' : 's') + ' refreshed.' : '.'), 'ok');
            await openTitle(title.key);
            loadTitles(state.titles.page);
        } catch (error) {
            note(error.message, 'err');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-rotate" aria-hidden="true"></i> Scrape IMDb';
            }
        }
    }

    async function saveTitleAvatar(url) {        if (!state.openTitle) return;
        try {
            var result = await api('/api/scenepacks/admin/titles/' + encodeURIComponent(state.openTitle.key), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ avatar: url })
            });
            state.openTitle.avatar = (result.title && result.title.avatar) || '';
            note('Title photo saved.', 'ok');
        } catch (error) {
            note(error.message, 'err');
        }
    }

    function note(message, kind) {
        var host = el('spsNote');
        if (!host) return;
        if (!message) {
            host.style.display = 'none';
            return;
        }
        host.className = 'sps-note' + (kind ? ' is-' + kind : '');
        host.style.display = 'flex';
        host.innerHTML = '<i class="fas ' + (kind === 'err' ? 'fa-circle-exclamation' : kind === 'ok' ? 'fa-circle-check' : 'fa-circle-info')
            + '" aria-hidden="true"></i><span>' + esc(message) + '</span>';
    }

    /* ── Pagination ───────────────────────────────────────────────────────── */

    function pager(host, page, pages, onGo) {
        if (!host) return;
        if (pages <= 1) {
            host.innerHTML = '';
            return;
        }
        var buttons = ['<button type="button" class="sps-page" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + ' aria-label="Previous page"><i class="fas fa-chevron-left"></i></button>'];
        var windowStart = Math.max(1, page - 2);
        var windowEnd = Math.min(pages, windowStart + 4);
        windowStart = Math.max(1, windowEnd - 4);
        if (windowStart > 1) {
            buttons.push('<button type="button" class="sps-page" data-page="1">1</button>');
            if (windowStart > 2) buttons.push('<span class="sps-pager-label">…</span>');
        }
        for (var i = windowStart; i <= windowEnd; i += 1) {
            buttons.push('<button type="button" class="sps-page' + (i === page ? ' is-on' : '') + '" data-page="' + i + '">' + i + '</button>');
        }
        if (windowEnd < pages) {
            if (windowEnd < pages - 1) buttons.push('<span class="sps-pager-label">…</span>');
            buttons.push('<button type="button" class="sps-page" data-page="' + pages + '">' + pages + '</button>');
        }
        buttons.push('<button type="button" class="sps-page" data-page="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + ' aria-label="Next page"><i class="fas fa-chevron-right"></i></button>');
        host.innerHTML = buttons.join('');
        host.onclick = function (event) {
            var target = event.target.closest('[data-page]');
            if (!target || target.disabled) return;
            onGo(Number(target.getAttribute('data-page')) || 1);
        };
    }

    /* ── Discover ─────────────────────────────────────────────────────────── */

    function renderDiscover() {
        var host = el('spsDiscoverGrid');
        if (!host) return;
        var data = state.discover;
        if (!data.items.length) {
            host.innerHTML = '<div class="sps-empty">'
                + (data.provider === 'game'
                    ? 'No game matched that search.'
                    : 'Search IMDb to list movies or series.')
                + '</div>';
        } else {
            host.innerHTML = data.items.map(function (item, index) {
                var poster = item.poster || item.backdrop || '';
                var meta = [item.year, (item.genres || []).slice(0, 2).join(', '), item.rating ? '★ ' + item.rating : ''].filter(Boolean);
                return '<article class="sps-card">'
                    + '<div class="sps-card-media">'
                    + '<span class="sps-fallback">' + esc(item.name || 'Untitled') + '</span>'
                    + (poster ? '<img src="' + attr(poster) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '')
                    + '<span class="sps-card-kind">' + esc(item.type === 'series' ? 'Series' : item.type === 'game' ? 'Game' : 'Movie') + '</span>'
                    + '</div>'
                    + '<div class="sps-card-body">'
                    + '<div class="sps-card-title">' + esc(item.name) + '</div>'
                    + (meta.length ? '<div class="sps-card-meta">' + meta.map(function (part) { return '<span>' + esc(part) + '</span>'; }).join('') + '</div>' : '')
                    + '<div class="sps-card-actions">'
                    + '<button type="button" class="sps-btn sps-btn-primary" data-create="' + index + '"><i class="fas fa-plus" aria-hidden="true"></i> Title page</button>'
                    + '</div>'
                    + '</div>'
                    + '</article>';
            }).join('');
        }
        var label = el('spsDiscoverCount');
        if (label) {
            label.textContent = data.total
                ? data.total.toLocaleString('en-US') + ' results · page ' + data.page + ' of ' + data.pages
                : '';
        }
        pager(el('spsDiscoverPager'), data.page, data.pages, function (page) { loadDiscover(page); });
    }

    async function loadDiscover(page) {
        var data = state.discover;
        data.page = Math.max(1, Number(page) || 1);
        var grid = el('spsDiscoverGrid');
        if (grid) grid.innerHTML = '<div class="sps-empty"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Searching…</div>';
        var params = new URLSearchParams({
            provider: data.provider,
            q: data.q,
            page: String(data.page)
        });
        try {
            var result = await api('/api/scenepacks/discover?' + params.toString());
            data.items = result.items || [];
            data.pages = result.pages || 1;
            data.total = result.total || 0;
            renderDiscover();
        } catch (error) {
            if (grid) grid.innerHTML = '<div class="sps-empty">' + esc(error.message) + '</div>';
            note(error.code === 'ADMIN_REQUIRED' ? 'This studio is limited to staff accounts.' : error.message, 'err');
        }
    }

    async function createTitleFromDiscover(index) {
        var item = state.discover.items[index];
        if (!item) return;
        note('Creating the title page…');
        try {
            var result = await api('/api/scenepacks/admin/titles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(item)
            });
            note(result.updated ? 'Title page updated.' : 'Title page created.', 'ok');
            await loadTitles(1);
            switchTab('titles');
            openTitle(result.title.key);
        } catch (error) {
            note(error.message, 'err');
        }
    }

    /* ── Title pages ──────────────────────────────────────────────────────── */

    function renderTitles() {
        var host = el('spsTitlesGrid');
        if (!host) return;
        var data = state.titles;
        if (!data.items.length) {
            host.innerHTML = '<div class="sps-empty">No title pages yet — create one from the Discover tab.</div>';
        } else {
            host.innerHTML = data.items.map(function (item) {
                var poster = item.poster || item.backdrop || '';
                var meta = [item.year, item.pack_count + ' pack' + (item.pack_count === 1 ? '' : 's')].filter(Boolean);
                return '<article class="sps-card">'
                    + '<div class="sps-card-media">'
                    + '<span class="sps-fallback">' + esc(item.name) + '</span>'
                    + (poster ? '<img src="' + attr(poster) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '')
                    + '<span class="sps-card-kind">' + esc(item.type === 'series' ? 'Series' : item.type === 'game' ? 'Game' : 'Movie') + '</span>'
                    + '</div>'
                    + '<div class="sps-card-body">'
                    + '<div class="sps-card-title">' + esc(item.name) + '</div>'
                    + (item.in_production ? '<div class="sps-card-meta">' + titleBadge(item) + '</div>' : '')
                    + (meta.length ? '<div class="sps-card-meta">' + meta.map(function (part) { return '<span>' + esc(part) + '</span>'; }).join('') + '</div>' : '')
                    + '<div class="sps-card-actions">'
                    + '<button type="button" class="sps-btn sps-btn-ghost" data-open="' + attr(item.key) + '"><i class="fas fa-folder-open" aria-hidden="true"></i> Manage</button>'
                    + '<a class="sps-btn sps-btn-ghost" href="/scenepack?key=' + encodeURIComponent(item.key) + '" target="_blank" rel="noopener" title="Public page"><i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></a>'
                    + '</div>'
                    + '</div>'
                    + '</article>';
            }).join('');
        }
        var label = el('spsTitlesCount');
        if (label) {
            label.textContent = data.total
                ? data.total + ' title page' + (data.total === 1 ? '' : 's') + ' · page ' + data.page + ' of ' + data.pages
                : '';
        }
        pager(el('spsTitlesPager'), data.page, data.pages, function (page) { loadTitles(page); });
    }

    async function loadTitles(page) {
        var data = state.titles;
        data.page = Math.max(1, Number(page) || 1);
        var host = el('spsTitlesGrid');
        if (host && !data.items.length) host.innerHTML = '<div class="sps-empty"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading title pages…</div>';
        var params = new URLSearchParams({ page: String(data.page), limit: '12' });
        if (data.q) params.set('q', data.q);
        try {
            var result = await api('/api/scenepacks/admin/titles?' + params.toString());
            data.items = result.items || [];
            data.pages = result.pages || 1;
            data.total = result.total || 0;
            renderTitles();
        } catch (error) {
            if (host) host.innerHTML = '<div class="sps-empty">' + esc(error.message) + '</div>';
        }
    }

    function packChip(pack) {
        var entries = (pack.downloads || []);
        var kind = entries.map(function (entry) { return entry.storage_kind; }).filter(Boolean)[0] || '';
        var label = kind === 'gdrive' ? 'Google Drive' : kind === 'sftpgo' ? 'Zyrex Cloud' : kind === 'direct' ? 'Direct' : 'No file';
        var cls = kind === 'gdrive' ? ' is-gdrive' : kind === 'sftpgo' ? ' is-sftpgo' : '';
        var format = (entries[0] && entries[0].format) || '';
        var directory = entries.some(function (entry) { return entry.directory; });
        var chip = '<span class="sps-pack-chip' + cls + '">' + esc(label) + '</span>';
        if (pack.character_category) chip += ' <span class="sps-pack-chip">' + esc(pack.character_category) + '</span>';
        if (directory) chip += ' <span class="sps-pack-chip">Folder</span>';
        if (format) chip += ' <span class="sps-pack-chip">' + esc(String(format).toUpperCase()) + '</span>';
        return chip;
    }

    // Title cards carry the production flag so an unfinished page is obvious in
    // the studio without opening it.
    function titleBadge(title) {
        return title.in_production
            ? '<span class="sps-pack-chip is-production">In production</span>'
            : '';
    }

    function renderTitleDetail() {
        var host = el('spsDetail');
        var title = state.openTitle;
        if (!host) return;
        if (!title) {
            host.style.display = 'none';
            host.innerHTML = '';
            return;
        }
        host.style.display = '';
        var poster = title.poster || title.backdrop || '';
        var meta = [
            title.year,
            title.type === 'series' ? 'Series' : title.type === 'game' ? 'Game' : 'Movie',
            title.rating ? 'IMDb ' + title.rating : '',
            (title.genres || []).join(', ')
        ].filter(Boolean);
        var packs = state.packs.length
            ? state.packs.map(function (pack) {
                return '<div class="sps-pack">'
                    + '<div><b>' + esc(pack.title) + '</b>'
                    + '<small>' + esc([pack.character, pack.actor, pack.quality, pack.encoding].filter(Boolean).join(' · ')) + '</small></div>'
                    + '<div>' + packChip(pack) + '</div>'
                    + '<a class="sps-btn sps-btn-ghost" href="/upload-scenepack?id=' + encodeURIComponent(pack.id) + '" title="Edit pack"><i class="fas fa-pen" aria-hidden="true"></i></a>'
                    + '<button type="button" class="sps-btn sps-btn-danger" data-delete="' + attr(pack.id) + '" title="Delete pack"><i class="fas fa-trash" aria-hidden="true"></i></button>'
                    + '</div>';
            }).join('')
            : '<div class="sps-empty">No character scenepacks on this page yet.</div>';

        host.innerHTML = '<div class="sps-detail-head">'
            + '<div class="sps-detail-poster">' + (poster ? '<img src="' + attr(poster) + '" alt="">' : '') + '</div>'
            + '<div><h3>' + esc(title.name) + '</h3><p>' + esc(meta.join(' · ')) + '</p>'
            + '<p style="margin-top:5px"><a href="/scenepack?key=' + encodeURIComponent(title.key) + '" target="_blank" rel="noopener" style="color:var(--zr-accent-soft,#ff6b8b)">Open public page</a></p>'
            + '<div class="sps-title-photo">'
            + '<input class="sps-input" id="spsTitleAvatar" placeholder="Title photo URL" value="' + attr(title.avatar || '') + '">'
            + '<button type="button" class="sps-btn sps-btn-ghost" id="spsTitleAvatarPick" title="Upload a title photo"><i class="fas fa-image" aria-hidden="true"></i></button>'
            + '<input type="file" id="spsTitleAvatarFile" accept="image/*" hidden>'
            + '</div>'
            + '<div class="sps-detail-tools">'
            + '<button type="button" class="sps-btn sps-btn-ghost" id="spsScrapeTitle"><i class="fas fa-rotate" aria-hidden="true"></i> Scrape IMDb</button>'
            + (title.scraped_at ? '<small class="sps-scraped">Scraped ' + esc(String(title.scraped_at).slice(0, 10)) + (title.scraped_from ? ' · ' + esc(title.scraped_from) : '') + '</small>' : '')
            + '</div>'
            + '<label class="sps-toggle"><input type="checkbox" id="spsInProduction"' + (title.in_production ? ' checked' : '') + '>'
            + '<span>In production</span></label>'
            + '</div>'
            + '<button type="button" class="sps-btn sps-btn-ghost" id="spsCloseDetail"><i class="fas fa-times" aria-hidden="true"></i> Close</button>'
            + '</div>'
            + '<div class="sps-pack-list">' + packs + '</div>'
            + '<form class="sps-form" id="spsPackForm" autocomplete="off">'
            + '<div class="sps-field"><label for="spsPackCharacter">Character</label><input class="sps-input" id="spsPackCharacter" placeholder="Steve Harrington"></div>'
            + '<div class="sps-field"><label for="spsPackActor">Actor</label><input class="sps-input" id="spsPackActor" placeholder="Joe Keery"></div>'
            + '<div class="sps-field"><label for="spsPackCategory">Category</label>'
            + '<select class="sps-select" id="spsPackCategory">'
            + '<option value="main">Main cast</option>'
            + '<option value="supporting">Supporting</option>'
            + '<option value="guest">Guest</option>'
            + '<option value="">Unsorted</option>'
            + '</select></div>'
            + '<div class="sps-field"><label for="spsPackAvatar">Character photo <span class="opt">optional</span></label>'
            + '<div class="sps-row" style="margin:0"><input class="sps-input is-flex" id="spsPackAvatar" placeholder="https://… or upload">'
            + '<button type="button" class="sps-btn sps-btn-ghost" id="spsPackAvatarPick" title="Upload a photo"><i class="fas fa-image" aria-hidden="true"></i></button></div>'
            + '<input type="file" id="spsPackAvatarFile" accept="image/*" hidden></div>'
            + '<div class="sps-field"><label for="spsPackCredit">Credit <span class="opt">optional</span></label><input class="sps-input" id="spsPackCredit" placeholder="chaszq"></div>'
            + '<div class="sps-field"><label for="spsPackQuality">Quality</label><input class="sps-input" id="spsPackQuality" placeholder="2160p"></div>'
            + '<div class="sps-field"><label for="spsPackEncoding">Encoding</label><input class="sps-input" id="spsPackEncoding" placeholder="H.265"></div>'
            + '<div class="sps-field"><label for="spsPackSize">File size</label><input class="sps-input" id="spsPackSize" placeholder="3.59 GB"></div>'
            + '<div class="sps-field full"><label for="spsPackName">Pack name</label><input class="sps-input" id="spsPackName" placeholder="Steve Harrington — Season 2"></div>'
            + '<div class="sps-field"><label for="spsPackSource">Storage</label>'
            + '<select class="sps-select" id="spsPackSource">'
            + '<option value="sftpgo">Zyrex Cloud (SFTPGo / S3)</option>'
            + '<option value="gdrive">Google Drive link</option>'
            + '<option value="direct">Direct link</option>'
            + '</select></div>'
            + '<div class="sps-field full" id="spsSftpgoBox"><label for="spsPackKey">Production file</label>'
            + '<div class="sps-row" style="margin:0"><input class="sps-input is-flex" id="spsPackKey" placeholder="Publish a file from the Storage tab first" value="' + attr(state.pickedKey || '') + '">'
            + '<button type="button" class="sps-btn sps-btn-ghost" id="spsBrowseStorage"><i class="fas fa-folder-tree" aria-hidden="true"></i> My cloud</button></div></div>'
            + '<div class="sps-field full" id="spsGdriveBox" hidden><label for="spsPackDrive">Google Drive link</label>'
            + '<input class="sps-input" id="spsPackDrive" placeholder="https://drive.google.com/file/d/…/view or …/drive/folders/…">'
            + '<p class="sps-hint">A file link streams as one video. A folder link is listed as clips on the title page. The share must be set to “Anyone with the link”.</p></div>'
            + '<div class="sps-field full" id="spsDirectBox" hidden><label for="spsPackDirect">Direct URL</label>'
            + '<input class="sps-input" id="spsPackDirect" placeholder="https://cdn.example.com/steve-s2.mp4"></div>'
            + '<div class="sps-field full" style="align-content:end"><button type="submit" class="sps-btn sps-btn-primary" id="spsPackSubmit"><i class="fas fa-plus" aria-hidden="true"></i> Add scenepack</button></div>'
            + '</form>';

        bindDetail();
    }

    function bindDetail() {
        var close = el('spsCloseDetail');
        if (close) close.addEventListener('click', function () {
            state.openTitle = null;
            state.packs = [];
            renderTitleDetail();
        });

        var production = el('spsInProduction');
        if (production) {
            production.addEventListener('change', async function () {
                var wanted = production.checked;
                production.disabled = true;
                try {
                    var result = await api('/api/scenepacks/admin/titles/' + encodeURIComponent(state.openTitle.key), {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                        body: JSON.stringify({ in_production: wanted })
                    });
                    if (state.openTitle) state.openTitle.in_production = Boolean(result.title && result.title.in_production);
                    note(wanted ? 'Marked as in production — the public page shows the badge.' : 'Production flag removed.', 'ok');
                    loadTitles(state.titles.page);
                } catch (error) {
                    production.checked = !wanted;
                    note(error.message, 'err');
                } finally {
                    production.disabled = false;
                }
            });
        }

        var source = el('spsPackSource');
        if (source) {
            source.addEventListener('change', function () {
                var kind = source.value;
                el('spsSftpgoBox').hidden = kind !== 'sftpgo';
                el('spsGdriveBox').hidden = kind !== 'gdrive';
                el('spsDirectBox').hidden = kind !== 'direct';
            });
        }

        bindImagePicker('spsPackAvatarPick', 'spsPackAvatarFile', 'spsPackAvatar');
        bindImagePicker('spsTitleAvatarPick', 'spsTitleAvatarFile', 'spsTitleAvatar', saveTitleAvatar);
        var scrapeButton = el('spsScrapeTitle');
        if (scrapeButton) {
            scrapeButton.addEventListener('click', function () {
                scrapeTitlePage(scrapeButton);
            });
        }
        var titleAvatar = el('spsTitleAvatar');
        if (titleAvatar) {
            titleAvatar.addEventListener('change', function () {
                saveTitleAvatar(titleAvatar.value.trim());
            });
        }

        var browse = el('spsBrowseStorage');
        if (browse) browse.addEventListener('click', function () {
            switchTab('storage');
            note('Your Discord cloud folder is listed here — press Publish on the pack file to move it to production.');
        });

        document.querySelectorAll('[data-delete]').forEach(function (button) {
            button.addEventListener('click', async function () {
                var id = button.getAttribute('data-delete');
                if (!window.confirm('Delete this scenepack?')) return;
                try {
                    await api('/api/scenepacks/' + encodeURIComponent(id), { method: 'DELETE' });
                    note('Scenepack deleted.', 'ok');
                    await openTitle(state.openTitle.key);
                    loadTitles(state.titles.page);
                } catch (error) {
                    note(error.message, 'err');
                }
            });
        });

        var form = el('spsPackForm');
        if (form) form.addEventListener('submit', submitPack);
    }

    async function submitPack(event) {
        event.preventDefault();
        var title = state.openTitle;
        if (!title) return;
        var kind = (el('spsPackSource') || {}).value || 'sftpgo';
        var storage = { kind: kind };
        if (kind === 'sftpgo') storage.key = ((el('spsPackKey') || {}).value || '').trim();
        if (kind === 'gdrive') storage.url = ((el('spsPackDrive') || {}).value || '').trim();
        if (kind === 'direct') storage.url = ((el('spsPackDirect') || {}).value || '').trim();
        if (kind === 'sftpgo' && !storage.key) {
            note('Pick a stored file first — open the Storage tab and press Publish.', 'err');
            return;
        }
        if (kind !== 'sftpgo' && !storage.url) {
            note('Paste a link for this storage type.', 'err');
            return;
        }
        if (kind === 'gdrive') {
            var drive = driveRef(storage.url);
            if (!drive) {
                note('That Google Drive link could not be read. Paste a file link (…/file/d/…) or a folder link (…/drive/folders/…).', 'err');
                return;
            }
            if (drive.kind === 'folder') {
                storage.folder_id = drive.id;
            } else {
                storage.file_id = drive.id;
            }
        }

        var button = el('spsPackSubmit');
        if (button) button.disabled = true;
        note('Saving the scenepack…');
        var character = (el('spsPackCharacter') || {}).value || '';
        var name = (el('spsPackName') || {}).value || [character, title.name].filter(Boolean).join(' — ');
        try {
            await api('/api/scenepacks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    title: name,
                    type: title.type || 'movie',
                    character: character,
                    actor: (el('spsPackActor') || {}).value || '',
                    character_avatar: (el('spsPackAvatar') || {}).value || '',
                    character_category: (el('spsPackCategory') || {}).value || '',
                    credit_name: (el('spsPackCredit') || {}).value || '',
                    quality: (el('spsPackQuality') || {}).value || '',
                    encoding: (el('spsPackEncoding') || {}).value || '',
                    file_size: (el('spsPackSize') || {}).value || '',
                    title_key: title.key,
                    status: 'published',
                    downloads: [{
                        id: 'v1',
                        label: [character, (el('spsPackQuality') || {}).value].filter(Boolean).join(' · ') || 'Full pack',
                        quality: (el('spsPackQuality') || {}).value || '',
                        size: (el('spsPackSize') || {}).value || '',
                        format: packFormat(kind === 'sftpgo' ? storage.key : storage.url),
                        storage: storage
                    }],
                    movie: {
                        title: title.name,
                        imdb_id: title.imdb_id || '',
                        year: title.year || '',
                        genres: title.genres || [],
                        rating: title.rating || '',
                        runtime: title.runtime || '',
                        plot: title.plot || '',
                        director: title.director || '',
                        cast: title.cast || '',
                        poster: title.poster || '',
                        backdrop: title.backdrop || '',
                        imdb_type: title.type || ''
                    }
                })
            });
            note('Scenepack published.', 'ok');
            await openTitle(title.key);
            loadTitles(state.titles.page);
        } catch (error) {
            note(error.message, 'err');
            if (button) button.disabled = false;
        }
    }

    async function openTitle(key) {
        if (!key) return;
        try {
            var data = await api('/api/scenepacks/title?key=' + encodeURIComponent(key));
            state.openTitle = data.title;
            state.packs = data.packs || [];
            renderTitleDetail();
            if (el('spsDetail')) el('spsDetail').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            // Automatic scrape: an older title page opens with full metadata without
            // the admin pressing the button.
            if (data.title && !data.title.scraped_at && !state.autoScraped[key]) {
                state.autoScraped[key] = true;
                var button = el('spsScrapeTitle');
                if (button) scrapeTitlePage(button);
            }
        } catch (error) {
            note(error.message, 'err');
        }
    }

    /* ── Storage browser ──────────────────────────────────────────────────── */

    async function loadStorage(path) {
        state.storage.path = path || '';
        var host = el('spsStorageList');
        if (host) host.innerHTML = '<div class="sps-empty"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Listing your cloud folder…</div>';
        var crumbs = el('spsCrumbs');
        if (crumbs) {
            var parts = state.storage.path.split('/').filter(Boolean);
            var trail = ['<button type="button" data-path="">my cloud</button>'];
            var accumulated = '';
            parts.forEach(function (part) {
                accumulated += (accumulated ? '/' : '') + part;
                trail.push('<span>/</span><button type="button" data-path="' + attr(accumulated) + '">' + esc(part) + '</button>');
            });
            crumbs.innerHTML = trail.join(' ');
            crumbs.onclick = function (event) {
                var target = event.target.closest('[data-path]');
                if (!target) return;
                loadStorage(target.getAttribute('data-path'));
            };
        }
        try {
            var data = await api('/api/scenepacks/admin/storage?path=' + encodeURIComponent(state.storage.path));
            var scope = el('spsStorageScope');
            if (scope) {
                scope.textContent = data.discord_id
                    ? 'Showing the folder linked to your Discord ID ' + data.discord_id + '.'
                    : 'Showing your cloud folder.';
            }
            var rows = (data.folders || []).map(function (folder) {
                var name = folder.replace(/\/$/, '').split('/').pop();
                return '<div class="sps-storage-row is-folder" data-folder="' + attr(folder) + '">'
                    + '<i class="fas fa-folder" aria-hidden="true"></i>'
                    + '<span class="sps-storage-name">' + esc(name) + '</span>'
                    + '<span></span><span class="sps-storage-size"></span><span></span></div>';
            }).concat((data.files || []).map(function (file) {
                var ext = fileExtension(file.name);
                return '<div class="sps-storage-row is-file">'
                    + '<i class="fas ' + fileIcon(file.name) + '" aria-hidden="true"></i>'
                    + '<span class="sps-storage-name" title="' + attr(file.key) + '">' + esc(file.name) + '</span>'
                    + (ext ? '<span class="sps-storage-ext">' + esc(ext) + '</span>' : '<span></span>')
                    + '<span class="sps-storage-size">' + bytes(file.size) + '</span>'
                    + '<button type="button" class="sps-btn sps-btn-primary" data-publish="' + attr(file.key) + '">Publish</button>'
                    + '</div>';
            }));
            if (host) host.innerHTML = rows.length ? rows.join('') : '<div class="sps-empty">Nothing uploaded in this folder yet.</div>';
            if (host) {
                host.onclick = function (event) {
                    var folder = event.target.closest('[data-folder]');
                    if (folder) {
                        loadStorage(folder.getAttribute('data-folder'));
                        return;
                    }
                    var publish = event.target.closest('[data-publish]');
                    if (publish) publishToProduction(publish.getAttribute('data-publish'), publish);
                };
            }
        } catch (error) {
            if (host) host.innerHTML = '<div class="sps-empty">' + esc(error.message) + '</div>';
        }
    }

    // Moves the picked file from the uploader's own staging folder to production,
    // exactly like the leak uploader, then hands the production key to the form.
    async function publishToProduction(path, button) {
        if (!path) return;
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Moving…';
        }
        try {
            var result = await api('/api/scenepacks/admin/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ path: path })
            });
            state.pickedKey = result.key;
            var input = el('spsPackKey');
            if (input) input.value = result.key;
            note('Moved to production: ' + result.key + ' — finish the pack form to publish.', 'ok');
            switchTab('titles');
            if (!el('spsPackKey')) renderTitleDetail();
        } catch (error) {
            note(error.message, 'err');
            if (button) {
                button.disabled = false;
                button.innerHTML = 'Publish';
            }
        }
    }

    /* ── Tabs ─────────────────────────────────────────────────────────────── */

    function switchTab(name) {
        state.tab = name;
        document.querySelectorAll('[data-sp-tab]').forEach(function (tab) {
            tab.classList.toggle('is-on', tab.getAttribute('data-sp-tab') === name);
        });
        document.querySelectorAll('[data-sp-pane]').forEach(function (pane) {
            pane.hidden = pane.getAttribute('data-sp-pane') !== name;
        });
        if (name === 'titles' && !state.titles.items.length) loadTitles(1);
        if (name === 'storage' && !el('spsStorageList').children.length) loadStorage('');
    }

    /* ── Boot ─────────────────────────────────────────────────────────────── */

    function bind() {
        document.querySelectorAll('[data-sp-tab]').forEach(function (tab) {
            tab.addEventListener('click', function () { switchTab(tab.getAttribute('data-sp-tab')); });
        });

        var form = el('spsDiscoverForm');
        if (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                state.discover.q = (el('spsDiscoverQuery') || {}).value || '';
                state.discover.provider = (el('spsDiscoverProvider') || {}).value || 'movie';
                loadDiscover(1);
            });
        }

        var provider = el('spsDiscoverProvider');
        if (provider) provider.addEventListener('change', function () {
            state.discover.provider = provider.value;
            state.discover.q = (el('spsDiscoverQuery') || {}).value || '';
            loadDiscover(1);
        });

        var grid = el('spsDiscoverGrid');
        if (grid) grid.addEventListener('click', function (event) {
            var button = event.target.closest('[data-create]');
            if (button) createTitleFromDiscover(Number(button.getAttribute('data-create')));
        });

        var titlesGrid = el('spsTitlesGrid');
        if (titlesGrid) titlesGrid.addEventListener('click', function (event) {
            var button = event.target.closest('[data-open]');
            if (button) openTitle(button.getAttribute('data-open'));
        });

        var search = el('spsTitlesQuery');
        if (search) {
            var timer = null;
            search.addEventListener('input', function () {
                clearTimeout(timer);
                timer = setTimeout(function () {
                    state.titles.q = search.value.trim();
                    loadTitles(1);
                }, 280);
            });
        }
    }

    function mount(user) {
        state.user = user;
        var panel = el('spStudio');
        var sidebarItem = el('sidebarScenepacks');
        if (!panel || !user || !user.is_admin) {
            if (panel) panel.style.display = 'none';
            if (sidebarItem) sidebarItem.style.display = 'none';
            var controlHidden = el('sidebarScenepackControl');
            if (controlHidden) controlHidden.style.display = 'none';
            return;
        }
        if (sidebarItem) sidebarItem.style.display = '';
        var controlItem = el('sidebarScenepackControl');
        if (controlItem) controlItem.style.display = '';
        bind();
        loadDiscover(1);
    }

    window.ScenepackStudio = {
        mount: mount,
        open: function (event) {
            if (event) event.preventDefault();
            var panel = el('spStudio');
            var main = el('mainPanel');
            var stepper = el('stepper');
            if (!panel) return;
            if (panel.style.display === 'none') {
                panel.style.display = '';
                if (main) main.style.display = 'none';
                if (stepper) stepper.style.display = 'none';
                var heading = document.querySelector('.studio-header h1');
                var subtitle = document.querySelector('.studio-header p');
                if (heading) heading.textContent = 'Scenepack Studio';
                if (subtitle) subtitle.textContent = 'Curate title pages and store character scenepacks on your own cloud';
            } else {
                panel.style.display = 'none';
                if (main) main.style.display = '';
                if (stepper) stepper.style.display = '';
                var h2 = document.querySelector('.studio-header h1');
                var p2 = document.querySelector('.studio-header p');
                if (h2) h2.textContent = 'Leak Upload';
                if (p2) p2.textContent = 'Share your editing leaks and stuff with the Zyrex library';
            }
        },
        tab: switchTab
    };
})(window, document);
