/**
 * Scenepack upload form: IMDb lookup, pack details, download versions,
 * thumbnail upload, live preview and submission.
 */
(function (window, document) {
    'use strict';
    var SP = window.Scenepacks;
    if (!SP) return;

    var selected = {
        imdb_id: '',
        imdb_type: '',
        poster: '',
        backdrop: '',
        rating: '',
        votes: '',
        rated: '',
        runtime: '',
        released: '',
        language: '',
        country: '',
        awards: '',
        plot: '',
        director: '',
        cast: '',
        genres: [],
        title_key: ''
    };
    var thumbnailUrl = '';
    var searchSeq = 0;
    // Editing an existing pack reuses this same page, exactly like the leak
    // uploader: ?id=<pack> prefills the form and the save goes through the update
    // route, so nothing about the stored files is guessed.
    var editId = '';
    var editSnapshot = null;
    var editTitleInProduction = false;

    function el(id) { return document.getElementById(id); }
    function val(id) { var node = el(id); return node ? String(node.value || '').trim() : ''; }
    function setVal(id, value) { var node = el(id); if (node) node.value = value == null ? '' : String(value); }

    function statusNode(message, kind) {
        var host = el('spFormStatus');
        if (!host) return;
        if (!message) { host.innerHTML = ''; host.style.display = 'none'; return; }
        var icons = { ok: 'fa-circle-check', warn: 'fa-triangle-exclamation', err: 'fa-circle-exclamation', info: 'fa-circle-info' };
        var type = icons[kind] ? kind : 'info';
        host.className = 'sp-note ' + (type === 'info' ? '' : type);
        host.innerHTML = '<i class="fas ' + icons[type] + '" aria-hidden="true"></i><span>' + SP.escapeHtml(message) + '</span>';
        host.style.display = 'flex';
    }

    /* ── IMDb lookup ──────────────────────────────────────────────────────── */

    function renderImdbResults(items) {
        var host = el('spImdbResults');
        if (!host) return;
        if (!items.length) {
            host.innerHTML = '<p class="sp-panel-sub" style="margin:0">No title matched that search. Check the spelling, paste an IMDb ID (tt…), or enter the details manually.</p>';
            return;
        }
        host.innerHTML = items.map(function (item, index) {
            var poster = item.poster || '';
            var meta = [item.year, item.genres, item.rating ? '★ ' + item.rating : ''].filter(Boolean).join(' · ');
            return '<button type="button" class="sp-imdb-result" data-index="' + index + '">'
                + (poster ? '<img src="' + SP.escapeAttr(poster) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : '<img alt="">')
                + '<span><b>' + SP.escapeHtml(item.title || 'Untitled') + '</b><small>' + SP.escapeHtml(meta) + '</small></span>'
                + '<span class="kind">' + SP.escapeHtml(item.type || 'Title') + '</span>'
                + '</button>';
        }).join('');
        host.setAttribute('data-items', JSON.stringify(items.map(function (item) {
            return {
                imdb_id: item.imdb_id || item.id || '',
                title: item.title || '',
                year: item.year || '',
                type: item.type || '',
                rating: item.rating || '',
                votes: item.votes || '',
                rated: item.rated || '',
                runtime: item.runtime || '',
                released: item.released || '',
                genres: item.genres || '',
                director: item.directors || '',
                cast: item.cast || '',
                plot: item.plot || '',
                awards: item.awards || '',
                poster: item.poster || '',
                category: item.category || ''
            };
        })));
    }

    async function runImdbSearch(query) {
        var q = String(query || '').trim();
        var host = el('spImdbResults');
        if (!q) {
            if (host) host.innerHTML = '';
            return;
        }
        var seq = ++searchSeq;
        if (host) host.innerHTML = '<p class="sp-panel-sub" style="margin:0"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Searching IMDb…</p>';
        try {
            var data = await SP.api('/api/lookup/imdb?q=' + encodeURIComponent(q));
            if (seq !== searchSeq) return;
            renderImdbResults(Array.isArray(data.results) ? data.results : []);
        } catch (error) {
            if (seq !== searchSeq) return;
            if (host) host.innerHTML = '<p class="sp-panel-sub" style="margin:0">IMDb search failed: ' + SP.escapeHtml(error.message) + '</p>';
        }
    }

    function applyImdbSelection(item) {
        selected = {
            imdb_id: item.imdb_id || '',
            imdb_type: String(item.type || '').toLowerCase(),
            poster: item.poster || '',
            backdrop: item.poster || '',
            rating: item.rating || '',
            votes: item.votes || '',
            rated: item.rated || '',
            runtime: item.runtime || '',
            released: item.released || '',
            language: item.language || '',
            country: item.country || '',
            awards: item.awards || '',
            plot: item.plot || '',
            director: item.director || '',
            cast: item.cast || '',
            genres: String(item.genres || '').split(',').map(function (g) { return g.trim(); }).filter(Boolean)
        };

        setVal('spMovieTitle', item.title || '');
        setVal('spImdbId', selected.imdb_id);
        setVal('spYear', String(item.year || '').slice(0, 4));
        setVal('spGenres', selected.genres.join(', '));
        setVal('spRating', selected.rating);
        setVal('spRuntime', selected.runtime);
        setVal('spDirector', selected.director);
        setVal('spCast', selected.cast);
        setVal('spPlot', selected.plot);

        var typeSelect = el('spType');
        if (typeSelect) {
            typeSelect.value = selected.imdb_type === 'series' ? 'series' : selected.imdb_type === 'game' ? 'game' : 'movie';
        }

        var titleInput = el('spTitle');
        if (titleInput && !titleInput.value.trim()) {
            titleInput.value = [item.title, val('spQuality') || '1080p'].filter(Boolean).join(' — ');
        }

        var box = el('spImdbSelected');
        if (box) {
            box.style.display = 'grid';
            box.innerHTML = (selected.poster ? '<img src="' + SP.escapeAttr(selected.poster) + '" alt="">' : '<img alt="">')
                + '<div>'
                + '<h3>' + SP.escapeHtml(item.title || '') + (item.year ? ' <span style="opacity:.6;font-weight:600">(' + SP.escapeHtml(String(item.year)) + ')</span>' : '') + '</h3>'
                + '<p>' + SP.escapeHtml(selected.plot || 'No synopsis returned by IMDb.') + '</p>'
                + '<p style="margin-top:6px;font-size:.7rem;opacity:.7">' + SP.escapeHtml([selected.imdb_id, selected.genres.join(', '), selected.rating ? 'IMDb ' + selected.rating : ''].filter(Boolean).join(' · ')) + '</p>'
                + '</div>';
        }
        var results = el('spImdbResults');
        if (results) results.innerHTML = '';
        var query = el('spImdbQuery');
        if (query) query.value = [item.title, item.year].filter(Boolean).join(' ');
        updatePreview();
    }

    function bindImdb() {
        var query = el('spImdbQuery');
        var results = el('spImdbResults');
        if (query) {
            var search = SP.debounce(function () { runImdbSearch(query.value); }, 420);
            query.addEventListener('input', search);
            query.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    runImdbSearch(query.value);
                }
            });
        }
        var searchButton = el('spImdbSearchBtn');
        if (searchButton) {
            searchButton.addEventListener('click', function () {
                runImdbSearch(query ? query.value : '');
            });
        }
        if (results) {
            results.addEventListener('click', function (event) {
                var button = event.target.closest('[data-index]');
                if (!button) return;
                var stored = results.getAttribute('data-items');
                if (!stored) return;
                var items = [];
                try { items = JSON.parse(stored); } catch (_) { items = []; }
                var item = items[Number(button.getAttribute('data-index'))];
                if (item) applyImdbSelection(item);
            });
        }
    }

    /* ── Download versions ────────────────────────────────────────────────── */

    function storageToUrl(storage) {
        if (!storage) return '';
        if (storage.kind === 'sftpgo') return storage.key || '';
        if (storage.kind === 'gdrive') {
            if (storage.folder_id) return 'https://drive.google.com/drive/folders/' + storage.folder_id;
            if (storage.file_id) return 'https://drive.google.com/file/d/' + storage.file_id + '/view';
            return storage.url || '';
        }
        return storage.url || '';
    }

    function versionRow(data) {
        var entry = data || {};
        var wrap = document.createElement('div');
        wrap.className = 'sp-version';
        wrap._storage = entry.storage || null;
        wrap.innerHTML = '<input class="sp-input" data-field="label" placeholder="Version name" value="' + SP.escapeAttr(entry.label || '') + '">'
            + '<input class="sp-input" data-field="quality" placeholder="1080p" value="' + SP.escapeAttr(entry.quality || '') + '">'
            + '<input class="sp-input" data-field="size" placeholder="1.4 GB" value="' + SP.escapeAttr(entry.size || '') + '">'
            + '<input class="sp-input" data-field="format" placeholder="MP4" value="' + SP.escapeAttr(entry.format || '') + '">'
            + '<input class="sp-input" data-field="provider" placeholder="Mega" value="' + SP.escapeAttr(entry.provider || '') + '">'
            + '<input class="sp-input" data-field="url" placeholder="https://…/scenepack.mp4" value="' + SP.escapeAttr(storageToUrl(entry.storage) || entry.url || '') + '">'
            + '<button type="button" class="sp-remove-row" title="Remove version"><i class="fas fa-trash" aria-hidden="true"></i></button>';
        var urlInput = wrap.querySelector('[data-field="url"]');
        var formatInput = wrap.querySelector('[data-field="format"]');
        if (urlInput && formatInput) {
            urlInput.addEventListener('blur', function () {
                if (!formatInput.value.trim()) formatInput.value = SP.mediaFormat(urlInput.value);
            });
        }
        wrap.querySelector('.sp-remove-row').addEventListener('click', function () {
            if (el('spVersions').children.length <= 1) {
                SP.toast('At least one version row is required.', 'info');
                return;
            }
            wrap.remove();
        });
        return wrap;
    }

    function collectVersions() {
        var host = el('spVersions');
        if (!host) return [];
        return Array.prototype.map.call(host.querySelectorAll('.sp-version'), function (row) {
            var entry = {};
            Array.prototype.forEach.call(row.querySelectorAll('[data-field]'), function (input) {
                entry[input.getAttribute('data-field')] = String(input.value || '').trim();
            });
            if (!entry.format) entry.format = SP.mediaFormat(entry.url) || SP.mediaFormat(storageToUrl(row._storage));
            // Keep the original storage reference when the link was left untouched,
            // so a cloud key is never flattened into a raw URL.
            var original = row._storage;
            if (original) {
                var originalUrl = storageToUrl(original);
                if (!entry.url || entry.url === originalUrl) {
                    entry.storage = original;
                    if (original.kind !== 'direct') entry.url = '';
                } else if (original.kind === 'gdrive') {
                    entry.storage = { kind: 'gdrive', url: entry.url };
                }
            }
            return entry;
        }).filter(function (entry) {
            return Boolean(entry.url) || Boolean(entry.storage);
        });
    }

    /* ── Thumbnail upload ─────────────────────────────────────────────────── */

    async function uploadThumbnail(file) {
        if (!file) return;
        if (!/^image\//i.test(file.type)) {
            SP.toast('Choose an image file for the thumbnail.', 'err');
            return;
        }
        if (file.size > 6 * 1024 * 1024) {
            SP.toast('Thumbnails must be smaller than 6 MB.', 'err');
            return;
        }
        var status = el('spThumbStatus');
        if (status) status.textContent = 'Uploading thumbnail…';
        try {
            var dataUrl = await new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload = function () { resolve(String(reader.result || '')); };
                reader.onerror = function () { reject(new Error('Could not read the file')); };
                reader.readAsDataURL(file);
            });
            var base64 = dataUrl.split(',')[1] || '';
            var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            var name = 'scenepack-' + Date.now().toString(36) + '.' + ext;
            var data = await SP.api('/api/thumbnails/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ filename: name, data: base64 })
            });
            if (data && data.url) {
                thumbnailUrl = data.url;
                setVal('spThumb', data.url);
                if (status) status.textContent = 'Thumbnail uploaded.';
                updatePreview();
            } else {
                throw new Error('Upload did not return a URL.');
            }
        } catch (error) {
            if (status) status.textContent = '';
            SP.toast(error.message || 'Thumbnail upload failed.', 'err');
        }
    }

    /* ── Image pickers (poster + character photo) ─────────────────────────── */

    async function uploadImageFile(file, targetInputId, statusId) {
        var status = statusId ? el(statusId) : null;
        if (status) status.textContent = 'Uploading image…';
        var dataUrl = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || '')); };
            reader.onerror = function () { reject(new Error('Could not read the file')); };
            reader.readAsDataURL(file);
        });
        var base64 = dataUrl.split(',')[1] || '';
        var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        var name = 'scenepack-' + Date.now().toString(36) + '.' + ext;
        var data = await SP.api('/api/thumbnails/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ filename: name, data: base64 })
        });
        if (!data || !data.url) throw new Error('Upload did not return a URL.');
        setVal(targetInputId, data.url);
        if (status) status.textContent = 'Image uploaded.';
        return data.url;
    }

    function bindImagePicker(pickId, fileId, inputId, statusId) {
        var pick = el(pickId);
        var file = el(fileId);
        if (!pick || !file) return;
        pick.addEventListener('click', function () { file.click(); });
        file.addEventListener('change', async function () {
            if (!file.files || !file.files[0]) return;
            pick.disabled = true;
            try {
                await uploadImageFile(file.files[0], inputId, statusId);
                updatePreview();
            } catch (error) {
                SP.toast(error.message || 'Image upload failed.', 'err');
            } finally {
                pick.disabled = false;
                file.value = '';
            }
        });
    }

    function bindDropzone() {
        var zone = el('spDropzone');
        var input = el('spThumbFile');        if (!zone || !input) return;
        zone.addEventListener('click', function () { input.click(); });
        zone.addEventListener('dragover', function (event) {
            event.preventDefault();
            zone.classList.add('is-over');
        });
        zone.addEventListener('dragleave', function () { zone.classList.remove('is-over'); });
        zone.addEventListener('drop', function (event) {
            event.preventDefault();
            zone.classList.remove('is-over');
            if (event.dataTransfer.files && event.dataTransfer.files[0]) uploadThumbnail(event.dataTransfer.files[0]);
        });
        input.addEventListener('change', function () {
            if (input.files && input.files[0]) uploadThumbnail(input.files[0]);
        });
        var thumbInput = el('spThumb');
        if (thumbInput) thumbInput.addEventListener('input', function () {
            thumbnailUrl = thumbInput.value.trim();
            updatePreview();
        });
    }

    /* ── Live preview ─────────────────────────────────────────────────────── */

    function buildPayload() {
        var genres = val('spGenres').split(',').map(function (g) { return g.trim(); }).filter(Boolean);
        return {
            title: val('spTitle'),
            type: val('spType') || 'movie',
            character: val('spCharacter'),
            character_avatar: val('spCharacterAvatar'),
            character_category: val('spCategory'),
            actor: val('spActor'),
            credit_name: val('spCreditName'),
            credit_link: val('spCreditLink'),
            encoding: val('spEncoding') || val('spCodec'),
            description: val('spDescription'),
            tags: val('spTags'),
            quality: val('spQuality'),
            resolution: val('spResolution'),
            format: val('spFormat'),
            codec: val('spCodec'),
            fps: val('spFps'),
            clip_count: Number(val('spClips')) || 0,
            duration: val('spDuration'),
            file_size: val('spSize'),
            audio: val('spAudio'),
            access: 'free',
            in_production: Boolean((el('spInProduction') || {}).checked),
            thumbnail: thumbnailUrl || val('spThumb'),
            backdrop: selected.backdrop || thumbnailUrl || '',
            preview_url: val('spPreviewUrl'),
            trailer_url: val('spTrailer'),
            downloads: collectVersions(),
            movie: {
                title: val('spMovieTitle') || val('spTitle'),
                imdb_id: val('spImdbId') || selected.imdb_id,
                year: val('spYear'),
                genres: genres,
                rating: val('spRating'),
                votes: selected.votes,
                rated: selected.rated,
                runtime: val('spRuntime'),
                plot: val('spPlot'),
                director: val('spDirector'),
                cast: val('spCast'),
                language: selected.language,
                country: selected.country,
                released: selected.released,
                awards: selected.awards,
                imdb_type: selected.imdb_type,
                poster: selected.poster,
                backdrop: selected.backdrop
            }
        };
    }

    function updatePreview() {
        var host = el('spPreview');
        if (!host) return;
        var payload = buildPayload();
        var poster = payload.thumbnail || payload.movie.poster || '';
        var title = payload.title || payload.movie.title || 'Your scenepack';
        var meta = [payload.quality, payload.encoding].filter(Boolean).join(' · ');
        host.innerHTML = '<div class="sp-tile" role="presentation">'
            + '<span class="sp-tile-fallback">' + SP.escapeHtml(title) + '</span>'
            + (poster ? '<img src="' + SP.escapeAttr(poster) + '" alt="" onerror="this.style.display=\'none\'">' : '')
            + '</div>'
            + '<div style="margin-top:12px;font-size:.86rem;font-weight:600;line-height:1.35">' + SP.escapeHtml(title) + '</div>'
            + (meta ? '<div style="margin-top:3px;font-size:.74rem;color:var(--sp-muted)">' + SP.escapeHtml(meta) + '</div>' : '')
            + (payload.character || payload.credit_name
                ? '<div style="margin-top:3px;font-size:.74rem;color:var(--sp-muted)">'
                + SP.escapeHtml([payload.character, payload.credit_name].filter(Boolean).join(' · ')) + '</div>'
                : '');
    }

    /* ── My submissions ───────────────────────────────────────────────────── */

    async function loadMine() {
        var host = el('spMineList');
        if (!host) return;
        try {
            var data = await SP.api('/api/scenepacks/mine');
            var items = Array.isArray(data.items) ? data.items : [];
            host.innerHTML = items.length
                ? items.map(function (item) {
                    var poster = item.thumbnail || (item.movie && item.movie.poster) || '';
                    return '<div class="sp-mine-row">'
                        + (poster ? '<img src="' + SP.escapeAttr(poster) + '" alt="">' : '<img alt="">')
                        + '<div class="grow"><b>' + SP.escapeHtml(item.title) + '</b>'
                        + '<small>' + SP.escapeHtml(SP.formatDate(item.created_at)) + ' · ' + SP.formatCount(item.downloads_count) + ' downloads</small></div>'
                        + '<span class="sp-state ' + SP.escapeAttr(item.status) + '">' + SP.escapeHtml(item.status) + '</span>'
                        + '</div>';
                }).join('')
                : '<p class="sp-panel-sub" style="margin:0">You have not uploaded a scenepack yet.</p>';
        } catch (error) {
            host.innerHTML = '<p class="sp-panel-sub" style="margin:0">' + SP.escapeHtml(error.message) + '</p>';
        }
    }

    /* ── IMDb scraping ────────────────────────────────────────────────────── */

    function scrapeStatus(message, kind) {
        var host = el('spScrapeStatus');
        if (!host) return;
        host.textContent = message || '';
        host.className = 'sp-scrape-status' + (kind ? ' is-' + kind : '');
    }

    // Applies a scraped record to the metadata block. Existing values are kept
    // unless the field is empty, so a manual correction is never clobbered.
    function applyScrapedMeta(meta, overwrite) {
        if (!meta) return;
        var fill = function (id, value) {
            if (!value) return;
            var node = el(id);
            if (!node) return;
            if (overwrite === true || !String(node.value || '').trim()) node.value = value;
        };
        selected.imdb_id = meta.imdb_id || selected.imdb_id;
        selected.imdb_type = meta.imdb_type || selected.imdb_type;
        selected.poster = meta.poster || selected.poster;
        selected.backdrop = meta.backdrop || selected.backdrop;
        selected.rating = meta.rating || selected.rating;
        selected.votes = meta.votes || selected.votes;
        selected.rated = meta.rated || selected.rated;
        selected.runtime = meta.runtime || selected.runtime;
        selected.released = meta.released || selected.released;
        selected.language = meta.language || selected.language;
        selected.country = meta.country || selected.country;
        selected.awards = meta.awards || selected.awards;
        selected.plot = meta.plot || selected.plot;
        selected.director = meta.director || selected.director;
        selected.cast = meta.cast || selected.cast;
        if (meta.genres && meta.genres.length) selected.genres = meta.genres;

        fill('spMovieTitle', meta.title);
        fill('spImdbId', meta.imdb_id);
        fill('spYear', String(meta.year || '').slice(0, 4));
        fill('spRating', meta.rating);
        fill('spRuntime', meta.runtime);
        fill('spGenres', (selected.genres || []).join(', '));
        fill('spDirector', meta.director);
        fill('spCast', meta.cast);
        fill('spPlot', meta.plot);

        var type = el('spType');
        if (type && meta.imdb_type && (overwrite === true || !type.value)) {
            type.value = meta.imdb_type === 'series' ? 'series' : meta.imdb_type === 'game' ? 'game' : 'movie';
        }
        updatePreview();
    }

    async function scrapeNow(options) {
        var opts = options || {};
        var target = (opts.target || val('spImdbId') || val('spMovieTitle') || (editSnapshot && editSnapshot.title_key) || '').trim();
        if (!target) {
            scrapeStatus('Add an IMDb ID or a title name first.', 'err');
            SP.toast('Add an IMDb ID or a title name first.', 'err');
            return null;
        }
        var button = el('spScrapeBtn');
        var inline = el('spImdbIdScrape');
        [button, inline].forEach(function (node) { if (node) node.disabled = true; });
        scrapeStatus('Scraping…');
        try {
            var data = await SP.api('/api/scenepacks/admin/scrape?id=' + encodeURIComponent(target));
            applyScrapedMeta(data.meta, opts.overwrite !== false);
            scrapeStatus('Scraped from ' + (data.source === 'rawg' ? 'RAWG' : 'IMDb') + '.', 'ok');
            if (!opts.silent) SP.toast('Metadata scraped.', 'ok');
            return data.meta;
        } catch (error) {
            scrapeStatus(error.message || 'The scrape failed.', 'err');
            if (!opts.silent) SP.toast(error.message || 'The scrape failed.', 'err');
            return null;
        } finally {
            [button, inline].forEach(function (node) { if (node) node.disabled = false; });
        }
    }

    function bindScrape() {
        var button = el('spScrapeBtn');
        if (button) button.addEventListener('click', function () { scrapeNow({ overwrite: false }); });
        var inline = el('spImdbIdScrape');
        if (inline) inline.addEventListener('click', function () { scrapeNow({ target: val('spImdbId'), overwrite: true }); });
        // Leaving the IMDb id field fills the metadata without pressing anything.
        var idInput = el('spImdbId');
        if (idInput) {
            idInput.addEventListener('blur', function () {
                var value = idInput.value.trim();
                if (/tt\d{7,10}/i.test(value)) scrapeNow({ target: value, overwrite: false, silent: true });
            });
        }
    }

    /* ── Edit mode ────────────────────────────────────────────────────────── */

    var EMPTY_SELECTION = {
        imdb_id: '', imdb_type: '', poster: '', backdrop: '', rating: '', votes: '', rated: '',
        runtime: '', released: '', language: '', country: '', awards: '', plot: '', director: '',
        cast: '', genres: [], title_key: ''
    };

    async function enterEditMode(id) {
        editId = id;
        var result;
        try {
            result = await SP.api('/api/scenepacks/admin/packs/' + encodeURIComponent(id));
        } catch (error) {
            statusNode(error.message || 'That scenepack could not be loaded.', 'err');
            SP.toast(error.message || 'That scenepack could not be loaded.', 'err');
            return;
        }
        var pack = (result && result.raw) || {};
        editSnapshot = pack;

        var movie = pack.movie || {};
        selected = {
            imdb_id: movie.imdb_id || '',
            imdb_type: movie.imdb_type || pack.type || '',
            poster: movie.poster || '',
            backdrop: movie.backdrop || '',
            rating: movie.rating || '',
            votes: movie.votes || '',
            rated: movie.rated || '',
            runtime: movie.runtime || '',
            released: movie.released || '',
            language: movie.language || '',
            country: movie.country || '',
            awards: movie.awards || '',
            plot: movie.plot || '',
            director: movie.director || '',
            cast: movie.cast || '',
            genres: Array.isArray(movie.genres) ? movie.genres : []
        };

        setVal('spTitle', pack.title || '');
        setVal('spType', pack.type || 'movie');
        setVal('spCharacter', pack.character || '');
        setVal('spCharacterAvatar', pack.character_avatar || '');
        setVal('spCategory', pack.character_category || '');
        setVal('spActor', pack.actor || '');
        setVal('spCreditName', pack.credit_name || '');
        setVal('spCreditLink', pack.credit_link || '');
        setVal('spEncoding', pack.encoding || '');
        setVal('spQuality', pack.quality || '');
        setVal('spSize', pack.file_size || '');
        setVal('spClips', pack.clip_count ? String(pack.clip_count) : '');
        setVal('spDuration', pack.duration || '');
        setVal('spFormat', pack.format || '');
        setVal('spAudio', pack.audio || '');
        setVal('spTags', (pack.tags || []).join(', '));
        setVal('spDescription', pack.description || '');
        setVal('spThumb', pack.thumbnail || '');
        setVal('spPreviewUrl', pack.preview_url || '');
        setVal('spTrailer', pack.trailer_url || '');
        setVal('spMovieTitle', movie.title || '');
        setVal('spImdbId', movie.imdb_id || '');
        setVal('spYear', String(movie.year || '').slice(0, 4));
        setVal('spRating', movie.rating || '');
        setVal('spRuntime', movie.runtime || '');
        setVal('spGenres', (selected.genres || []).join(', '));
        setVal('spDirector', movie.director || '');
        setVal('spCast', movie.cast || '');
        setVal('spPlot', movie.plot || '');
        thumbnailUrl = pack.thumbnail || '';

        var versions = el('spVersions');
        if (versions) {
            versions.innerHTML = '';
            var rows = Array.isArray(pack.downloads) && pack.downloads.length
                ? pack.downloads
                : [{ label: 'Full pack' }];
            rows.forEach(function (entry) { versions.appendChild(versionRow(entry)); });
        }

        if (movie.title) {
            var box = el('spImdbSelected');
            if (box) {
                box.style.display = 'grid';
                box.innerHTML = (selected.poster ? '<img src="' + SP.escapeAttr(selected.poster) + '" alt="">' : '<img alt="">')
                    + '<div><h3>' + SP.escapeHtml(movie.title) + (movie.year ? ' <span style="opacity:.6;font-weight:600">(' + SP.escapeHtml(String(movie.year)) + ')</span>' : '') + '</h3>'
                    + '<p>' + SP.escapeHtml(selected.plot || 'No synopsis stored for this title.') + '</p></div>';
            }
            var query = el('spImdbQuery');
            if (query) query.value = [movie.title, movie.year].filter(Boolean).join(' ');
        }

        // The production flag lives on the curated title page, not on the pack.
        var titleKey = String(pack.title_key || '');
        if (titleKey) {
            try {
                var page = await SP.api('/api/scenepacks/title?key=' + encodeURIComponent(titleKey));
                editTitleInProduction = Boolean(page.title && page.title.in_production === true);
            } catch (_) { editTitleInProduction = false; }
        }
        var production = el('spInProduction');
        if (production) production.checked = editTitleInProduction;

        var heading = el('spUploadTitle');
        if (heading) heading.textContent = 'Edit scenepack';
        document.title = 'Edit Scenepack | Zyrex';
        var button = el('spSubmitBtn');
        if (button) button.innerHTML = '<i class="fas fa-floppy-disk" aria-hidden="true"></i> Save changes';
        var note = el('spIdentityNote');
        if (note) {
            note.className = 'sp-note ok';
            note.innerHTML = '<i class="fas fa-pen" aria-hidden="true"></i><span>Editing <strong>'
                + SP.escapeHtml(pack.title || 'this scenepack') + '</strong>. Saving updates it in place.</span>';
        }
        var cancel = el('spEditCancel');
        if (cancel) cancel.hidden = false;
        updatePreview();

        // Keep the title identity so the next character lands on the same page.
        selected.title_key = (pack && pack.title_key) || '';
        refreshCharacters();

        // Automatic scrape on open: a pack stored before scraping existed gets its
        // metadata filled without the admin pressing anything.
        var stale = !movie.rating || !movie.plot || !(Array.isArray(movie.genres) && movie.genres.length);
        if (stale && (movie.imdb_id || titleKey)) {
            scrapeNow({ target: movie.imdb_id || titleKey, overwrite: false, silent: true });
        }
    }

    /* ── Characters already in this title ─────────────────────────────────── */

    var saveNext = false;

    var CATEGORY_LABELS = { main: 'Main cast', supporting: 'Supporting', guest: 'Guest' };

    function categoryLabel(value) {
        return CATEGORY_LABELS[value] || 'Unsorted';
    }

    function initials(name) {
        return String(name || '?').split(/\s+/).slice(0, 2).map(function (part) {
            return part.charAt(0).toUpperCase();
        }).join('');
    }

    function renderCharacters(items) {
        var host = el('spCharacterStrip');
        if (!host) return;
        if (!items.length) {
            host.hidden = true;
            host.innerHTML = '';
            return;
        }
        host.hidden = false;
        host.innerHTML = '<div class="sp-chars-head"><b>Characters in this title</b><span>' + items.length
            + ' character' + (items.length === 1 ? '' : 's') + '</span></div>'
            + '<div class="sp-chars-row">'
            + items.map(function (pack) {
                var photo = pack.character_avatar || '';
                return '<a class="sp-char-chip" href="/upload-scenepack?id=' + encodeURIComponent(pack.id) + '" title="Edit this character">'
                    + '<span class="sp-char-photo">' + (photo
                        ? '<img src="' + SP.escapeAttr(photo) + '" alt="" loading="lazy" onerror="this.remove()">'
                        : SP.escapeHtml(initials(pack.character || pack.title)))
                    + '</span>'
                    + '<span class="sp-char-text"><b>' + SP.escapeHtml(pack.character || pack.title) + '</b>'
                    + '<small>' + SP.escapeHtml(categoryLabel(pack.character_category)) + '</small></span>'
                    + '</a>';
            }).join('')
            + '</div>';
    }

    async function refreshCharacters() {
        var key = (editSnapshot && editSnapshot.title_key) || selected.title_key || '';
        if (!key) {
            // Before the first save the title is only known by its IMDb id.
            var typedId = val('spImdbId') || selected.imdb_id || '';
            key = typedId ? 'imdb:' + String(typedId).toLowerCase() : '';
        }
        if (!key) {
            renderCharacters([]);
            return;
        }
        try {
            var data = await SP.api('/api/scenepacks/mine');
            var wanted = key.toLowerCase();
            var imdbOnly = wanted.indexOf('imdb:') === 0 ? wanted.slice(5) : '';
            var items = (data.items || []).filter(function (pack) {
                var packKey = String(pack.title_key || '').toLowerCase();
                if (packKey) return packKey === wanted;
                // A pack saved before title_key existed still belongs to the title.
                var packImdb = String((pack.movie && pack.movie.imdb_id) || '').toLowerCase();
                return Boolean(imdbOnly) && packImdb === imdbOnly;
            });
            renderCharacters(items);
        } catch (_) {
            renderCharacters([]);
        }
    }

    // Clears only the character-specific fields so the next character can be added
    // without retyping the title, quality, tags or description.
    function resetCharacterFields() {
        ['spCharacter', 'spActor', 'spCharacterAvatar', 'spSize', 'spDuration', 'spClips'].forEach(function (id) {
            setVal(id, '');
        });
        var host = el('spVersions');
        if (host) {
            host.innerHTML = '';
            host.appendChild(versionRow({ label: 'Full pack' }));
        }
        updatePreview();
        var character = el('spCharacter');
        if (character) character.focus();
    }

    function readiness() {
        var payload = buildPayload();
        var missing = [];
        if (!payload.character) missing.push('character name');
        if (!payload.downloads.length) missing.push('a file link');
        return missing;
    }

    function updateReadiness() {
        var button = el('spSubmitNext');
        if (button) button.disabled = readiness().length > 0;
    }

    /* ── Submit ───────────────────────────────────────────────────────────── */

    async function submit(event) {
        event.preventDefault();
        var payload = buildPayload();
        if (!payload.title && !payload.movie.title) {
            statusNode('Add a pack title or pick a title from IMDb first.', 'err');
            return;
        }
        if (!payload.downloads.length) {
            statusNode('Add at least one download version with a link (SFTPGo/S3, a Google Drive link or a direct .mp4 URL).', 'warn');
            return;
        }
        var button = el('spSubmitBtn');
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ' + (editId ? 'Saving…' : 'Submitting…');
        }
        statusNode(editId ? 'Saving your changes…' : 'Saving your scenepack…', 'info');
        try {
            var data = editId
                ? await SP.api('/api/scenepacks/' + encodeURIComponent(editId), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify(payload)
                })
                : await SP.api('/api/scenepacks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify(payload)
                });
            if (editId) {
                var wanted = Boolean((el('spInProduction') || {}).checked);
                if (editSnapshot && editSnapshot.title_key && wanted !== editTitleInProduction) {
                    try {
                        await SP.api('/api/scenepacks/admin/titles/' + encodeURIComponent(editSnapshot.title_key), {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                            body: JSON.stringify({ in_production: wanted })
                        });
                        editTitleInProduction = wanted;
                    } catch (_) { /* the pack itself is already saved */ }
                }
                statusNode('Scenepack updated.', 'ok');
                SP.toast('Scenepack updated.', 'ok');
                if (data && data.item && data.item.title_key) {
                    editSnapshot = Object.assign({}, editSnapshot, { title_key: data.item.title_key });
                }
                loadMine();
                updatePreview();
                return;
            }
            statusNode(data.message || 'Scenepack published.', 'ok');
            SP.toast(saveNext ? 'Character saved. Add the next one.' : 'Scenepack published.', 'ok');
            if (data && data.item && data.item.title_key) selected.title_key = data.item.title_key;
            refreshCharacters();
            if (saveNext) {
                resetCharacterFields();
                loadMine();
                return;
            }
            var form = el('spSubmitForm');
            if (form) form.reset();
            var versions = el('spVersions');
            if (versions) {
                versions.innerHTML = '';
                versions.appendChild(versionRow({ label: 'Full pack', quality: '1080p' }));
            }
            thumbnailUrl = '';
            selected = Object.assign({}, EMPTY_SELECTION);
            var picked = el('spImdbSelected');
            if (picked) picked.style.display = 'none';
            updatePreview();
            refreshCharacters();
            loadMine();
        } catch (error) {
            var hint = error.code === 'ADMIN_REQUIRED'
                ? 'Scenepack publishing is limited to Zyrex staff.'
                : (error.message || 'The upload failed.');
            statusNode(hint, 'err');
            SP.toast(hint, 'err');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = editId
                    ? '<i class="fas fa-floppy-disk" aria-hidden="true"></i> Save changes'
                    : '<i class="fas fa-cloud-arrow-up" aria-hidden="true"></i> Publish scenepack';
            }
            saveNext = false;
            updateReadiness();
        }
    }

    function bindPreviewTriggers() {
        ['spTitle', 'spQuality', 'spEncoding', 'spCharacter', 'spActor', 'spCreditName', 'spType', 'spYear', 'spRating', 'spThumb', 'spMovieTitle'].forEach(function (id) {
            var node = el(id);
            if (!node) return;
            node.addEventListener('input', updatePreview);
            node.addEventListener('change', updatePreview);
        });
        var characterInput = el('spCharacter');
        if (characterInput) characterInput.addEventListener('input', updateReadiness);
        var addVersion = el('spAddVersion');
        if (addVersion) {
            addVersion.addEventListener('click', function () {
                var host = el('spVersions');
                if (host) host.appendChild(versionRow({}));
                updateReadiness();
            });
        }
        var versionsHost = el('spVersions');
        if (versionsHost) versionsHost.addEventListener('input', updateReadiness);
    }

    async function checkIdentity() {
        var note = el('spIdentityNote');
        if (!note) return;
        try {
            var me = await SP.api('/api/me');
            var isAdmin = Boolean(me.is_admin);
            note.className = 'sp-note ' + (isAdmin ? 'ok' : 'warn');
            note.innerHTML = '<i class="fas ' + (isAdmin ? 'fa-circle-check' : 'fa-lock') + '" aria-hidden="true"></i><span>'
                + (isAdmin
                    ? 'Signed in as <strong>' + SP.escapeHtml(me.global_name || me.username || 'admin') + '</strong>. Scenepacks you publish go live immediately.'
                    : 'Scenepack publishing is limited to Zyrex staff. Ask an admin for access.')
                + '</span>';
        } catch (_) {
            note.className = 'sp-note warn';
            note.innerHTML = '<i class="fas fa-lock" aria-hidden="true"></i><span>Log in with Discord to publish a scenepack.</span>';
        }
    }

    function start() {
        if (!el('spSubmitForm')) return;
        bindImdb();
        bindDropzone();
        bindImagePicker('spCharacterAvatarPick', 'spCharacterAvatarFile', 'spCharacterAvatar');
        bindPreviewTriggers();

        var versions = el('spVersions');
        if (versions && !versions.children.length) versions.appendChild(versionRow({ label: 'Full pack', quality: '1080p' }));

        var form = el('spSubmitForm');
        form.addEventListener('submit', submit);
        form.addEventListener('input', SP.debounce(updatePreview, 200));

        var nextButton = el('spSubmitNext');
        if (nextButton) {
            nextButton.addEventListener('click', function () {
                saveNext = true;
                submit({ preventDefault: function () {} });
            });
        }
        var categorySelect = el('spCategory');
        if (categorySelect) categorySelect.addEventListener('change', updateReadiness);

        updatePreview();
        updateReadiness();
        refreshCharacters();
        checkIdentity();
        loadMine();
        bindScrape();

        var editTarget = (SP.queryParam('id') || SP.queryParam('edit') || '').trim();
        if (editTarget) enterEditMode(editTarget);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})(window, document);
