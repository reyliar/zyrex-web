
function getProductSubcategories(item) {
    if (!item) return ['preset'];
    let list = [];
    let sub = item.resource_subcategories;
    if (typeof sub === 'string') {
        try {
            let parsed = JSON.parse(sub);
            if (Array.isArray(parsed)) list = parsed;
        } catch(e) {
            list = sub.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        }
    } else if (Array.isArray(sub) && sub.length > 0) {
        list = sub.slice();
    }
    if (list.length === 0 && item.resource_category) {
        list = String(item.resource_category).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    }
    if (list.length === 0) list = ['preset'];
    return list.map(function(s) { return String(s).toLowerCase().trim(); }).filter(Boolean);
}
window.getProductSubcategories = getProductSubcategories;

window.DEFAULT_AVATAR = '/assets/default-avatar.png';

window.ANONYMOUS_AVATAR = window.DEFAULT_AVATAR || '/assets/default-avatar.png';

window.handleAvatarError = function(img) {
    if (!img) return;
    img.onerror = null;
    img.src = window.DEFAULT_AVATAR;
};

var presetDiscordAvatarCache = {};
var presetDiscordProfileCache = {};
function resolvePresetDiscordAvatar(userId, fallback) {
    // The shared localStorage cache is authoritative: it is what every resource
    // page renders, so the grid must agree with the detail pages.
    if (userId && window.ZyrexProfile) {
        var shared = window.ZyrexProfile.cachedAvatar(userId);
        if (shared) return shared;
    }
    if (userId && presetDiscordAvatarCache[userId]) return presetDiscordAvatarCache[userId];
    if (window.ZyrexProfile) {
        var resolved = window.ZyrexProfile.avatarUrl(fallback, userId);
        if (resolved) {
            if (userId) {
                presetDiscordAvatarCache[userId] = resolved;
                window.ZyrexProfile.rememberAvatar(userId, resolved);
            }
            return resolved;
        }
        if (userId) return window.ZyrexProfile.defaultDiscordAvatar(userId) || window.DEFAULT_AVATAR;
        return window.DEFAULT_AVATAR;
    }
    if (fallback && /^https?:\/\//i.test(fallback)) {
        if (userId) presetDiscordAvatarCache[userId] = fallback;
        return fallback;
    }
    if (fallback) {
        const hash = String(fallback).replace(/\.(png|jpg|jpeg|webp|gif)$/i, '');
        if (!/^(?:a_)?[a-z0-9_-]{16,}$/i.test(hash) || !userId) return window.DEFAULT_AVATAR;
        const ext = hash.startsWith('a_') ? 'gif' : 'png';
        const url = 'https://cdn.discordapp.com/avatars/' + userId + '/' + hash + '.' + ext + '?size=128';
        if (userId) presetDiscordAvatarCache[userId] = url;
        return url;
    }
    let defIdx = 0;
    if (userId && /^\d+$/.test(userId)) {
        try { defIdx = Number((BigInt(userId) >> 22n) % 6n); } catch(e) { defIdx = parseInt(userId) % 5 || 0; }
    }
    return 'https://cdn.discordapp.com/embed/avatars/' + defIdx + '.png';
}

function fetchPresetDiscordAvatar(userId) {
    if (!userId) return Promise.resolve('');
    if (!presetDiscordProfileCache[userId]) {
        presetDiscordProfileCache[userId] = fetch('/api/discord-user?userId=' + encodeURIComponent(userId))
            .then(function(response) { return response.ok ? response.json() : null; })
            .then(function(data) {
                var user = data && data.success && data.user;
                if (!user) return '';
                var url = '';
                if (user.avatar) {
                    var ext = String(user.avatar).startsWith('a_') ? 'gif' : 'png';
                    url = '/api/avatar/' + encodeURIComponent(userId) + '/' + encodeURIComponent(user.avatar) + '.' + ext + '?size=128';
                } else {
                    url = user.avatar_url || '';
                }
                if (url && window.ZyrexProfile) window.ZyrexProfile.rememberAvatar(userId, url);
                return url;
            })
            .catch(function() { return ''; });
    }
    return presetDiscordProfileCache[userId];
}

window.handlePresetCardAvatarError = function(img) {
    if (!img) return;
    var userId = img.getAttribute('data-uploader-id') || '';
    if (userId && img.dataset.profileLookupStarted !== 'true') {
        img.dataset.profileLookupStarted = 'true';
        fetchPresetDiscordAvatar(userId).then(function(url) {
            if (url && img.isConnected) img.src = url;
            else if (img.isConnected) window.handleAvatarError(img);
        });
        return;
    }
    window.handleAvatarError(img);
};

function loadPresetAvatars() {
    document.querySelectorAll('.preset-card-avatar[data-uploader-id]').forEach(function(img) {
        var uid = img.getAttribute('data-uploader-id');
        var fb = img.getAttribute('data-fallback') || '';
        img.onerror = function() { window.handlePresetCardAvatarError(this); };
        if (uid) {
            var url = resolvePresetDiscordAvatar(uid, fb);
            if (url) img.src = url;
            if (img.dataset.profileLookupStarted !== 'true') {
                img.dataset.profileLookupStarted = 'true';
                fetchPresetDiscordAvatar(uid).then(function(liveUrl) {
                    if (liveUrl && img.isConnected) img.src = liveUrl;
                });
            }
        }
    });
}

// Cache helpers for products data
// Bump this when creator identity/avatar handling changes so old catalogs do
// not keep rendering stale creator photos for returning visitors.
var PRODUCTS_CACHE_KEY = 'zyrex_products_cache_v4';
var PRODUCTS_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
var PRESETS_PAGE_SIZE = 33;
var currentPresetPage = 1;
var lastPresetRenderKey = '';
var lastPresetRenderItems = [];

var loaderStartTime = Date.now();
function hideResourcesLoader() {
    var loader = document.getElementById('resources-loader');
    if (!loader || loader.classList.contains('fade-out')) return;
    
    var elapsed = Date.now() - loaderStartTime;
    var minDelay = Math.max(0, 450 - elapsed);
    
    setTimeout(function() {
        if (loader && !loader.classList.contains('fade-out')) {
            loader.classList.add('fade-out');
            setTimeout(function() {
                if (loader && loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
            }, 600);
        }
    }, minDelay);
}

function getCachedProducts() {
    if (window.ZyrexPrivacy && typeof window.ZyrexPrivacy.readProducts === 'function') {
        return window.ZyrexPrivacy.readProducts();
    }
    return null;
}
function setCachedProducts(data) {
    if (window.ZyrexPrivacy && typeof window.ZyrexPrivacy.writeProducts === 'function') {
        window.ZyrexPrivacy.writeProducts(data);
    } else {
        try {
            localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
        } catch(e) {}
    }
    if (window.ZyrexChunkStore && Array.isArray(data)) {
        window.ZyrexChunkStore.storeCatalogChunks('products', data, PRESETS_PAGE_SIZE);
    }
}

function updateCreatorMarquee(products) {
    var root = document.getElementById('creatorMarquee');
    var viewport = root && root.querySelector('.creator-marquee-viewport');
    var track = document.getElementById('creatorMarqueeTrack');
    if (!root || !viewport || !track || !Array.isArray(products)) return;

    var unique = new Map();
    products.forEach(function(product) {
        if (!product) return;
        var productType = String(product.type || product.resource_type || '').trim().toLowerCase();
        var productCategory = String(product.category || '').trim().toLowerCase();
        var productId = String(product.id || '').trim().toLowerCase();
        // This strip only represents resources rendered on /resources. Scenepacks
        // have their own catalog and should not introduce creators here.
        if ((productType && productType !== 'preset') || productCategory === 'scenepack' || productId.indexOf('scenepack-') === 0) return;
        var socialUrl = String(product.creator_social_url || '').trim();
        var parsedUrl;
        try {
            parsedUrl = new URL(socialUrl);
            if (!/^https?:$/.test(parsedUrl.protocol)) return;
        } catch (_) { return; }

        var host = parsedUrl.hostname.replace(/^www\./i, '').toLowerCase();
        var path = parsedUrl.pathname.replace(/\/+$/, '');
        var platform = String(product.creator_platform || host.split('.')[0]).toLowerCase();
        if (platform === 'twitter') platform = 'x';
        var accountId = String(product.creator_account_id || '').trim();
        var key = accountId ? platform + ':' + accountId : host + path.toLowerCase();
        if (!key) return;
        var pathParts = path.split('/').filter(Boolean).map(function(part) {
            try { return decodeURIComponent(part); } catch (_) { return part; }
        });
        var pathName = pathParts[0] || '';
        if (/^(channel|channels|user|users|c|profile)$/i.test(pathName) && pathParts[1]) pathName = pathParts[1];
        var username = pathName.replace(/^@+/, '');
        var candidate = String(product.creator_username || '').trim().replace(/^@+/, '');
        if (/^[a-zA-Z0-9._-]{1,64}$/.test(candidate) && !/^https?$/i.test(candidate)) username = candidate;
        if (!/^[a-zA-Z0-9._-]{1,64}$/.test(username)) username = '';
        if (!username) return;
        var handle = '@' + username;

        var avatar = String(product.creator_avatar || '').trim();
        try {
            if (!avatar || new URL(avatar, location.href).protocol !== 'https:') avatar = '';
        } catch (_) { avatar = ''; }
        var existing = unique.get(key);
        if (existing) {
            if (!existing.avatar && avatar) existing.avatar = avatar;
        } else {
            unique.set(key, { handle: handle, avatar: avatar, url: parsedUrl.href, key: key, host: host, platform: platform, accountId: accountId });
        }
    });

    // Account IDs are the canonical identity, but older catalog rows may have
    // incomplete IDs. Share a known avatar among rows for the same platform
    // handle so a first row with an empty avatar cannot create a blank badge.
    var avatarByHandle = new Map();
    unique.forEach(function(creator) {
        var handleKey = String(creator.platform || creator.host || '') + ':' + creator.handle.toLowerCase();
        if (creator.avatar && !avatarByHandle.has(handleKey)) avatarByHandle.set(handleKey, creator.avatar);
    });
    unique.forEach(function(creator) {
        if (creator.avatar) return;
        var handleKey = String(creator.platform || creator.host || '') + ':' + creator.handle.toLowerCase();
        if (avatarByHandle.has(handleKey)) creator.avatar = avatarByHandle.get(handleKey);
    });

    var creators = Array.from(unique.values());
    if (!creators.length) {
        root.style.display = 'none';
        return;
    }

    var searchInput = document.getElementById('creatorMarqueeSearch');

    function makeBadge(creator, clone) {
        var badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'creator-marquee-badge';
        badge.dataset.creatorKey = creator.key;
        badge.dataset.creatorHost = creator.host;
        badge.dataset.creatorHandle = creator.handle.toLowerCase();
        badge.dataset.creatorPlatform = creator.platform || '';
        badge.dataset.creatorAccountId = creator.accountId || '';
        badge.title = 'Show leaks by ' + creator.handle;
        badge.setAttribute('aria-label', 'Show leaks by ' + creator.handle);
        if (clone) badge.tabIndex = -1;

        var avatar = document.createElement('img');
        avatar.src = creator.avatar || window.DEFAULT_AVATAR || '/assets/content.png';
        avatar.alt = '';
        avatar.loading = 'eager';
        avatar.decoding = 'async';
        avatar.onerror = function() {
            this.onerror = null;
            this.src = window.DEFAULT_AVATAR || '/assets/content.png';
        };
        var name = document.createElement('span');
        name.className = 'creator-marquee-name';
        name.textContent = creator.handle;
        badge.append(avatar, name);
        return badge;
    }

    function paintCreatorMarquee(query) {
        track.replaceChildren();
        root.style.display = '';
        query = String(query || '').trim().toLowerCase().replace(/^@+/, '');

        if (query) {
            root.classList.add('is-searching');
            var matches = creators.filter(function(creator) {
                return creator.handle.toLowerCase().slice(1).includes(query);
            });
            if (!matches.length) {
                var empty = document.createElement('div');
                empty.className = 'creator-marquee-empty';
                empty.textContent = 'No creators found';
                track.appendChild(empty);
                return;
            }
            matches.forEach(function(creator) { track.appendChild(makeBadge(creator, false)); });
            return;
        }

        root.classList.remove('is-searching');
        // Repeat short creator lists enough to fill the viewport, then mirror
        // the complete sequence for a continuous, gap-free marquee.
        creators.forEach(function(creator) { track.appendChild(makeBadge(creator, false)); });
        var baseWidth = track.scrollWidth;
        var repeatCount = Math.max(1, Math.ceil((viewport.clientWidth || 900) / Math.max(baseWidth, 1)));
        for (var i = 1; i < repeatCount; i++) {
            creators.forEach(function(creator) { track.appendChild(makeBadge(creator, true)); });
        }
        Array.from(track.children).forEach(function(badge) {
            var duplicate = makeBadge({
                key: badge.dataset.creatorKey,
                host: badge.dataset.creatorHost,
                handle: badge.dataset.creatorHandle,
                platform: badge.dataset.creatorPlatform,
                accountId: badge.dataset.creatorAccountId,
                avatar: badge.querySelector('img').src,
            }, true);
            duplicate.setAttribute('aria-hidden', 'true');
            track.appendChild(duplicate);
        });
    }

    if (searchInput) searchInput.oninput = function() { paintCreatorMarquee(this.value); };
    paintCreatorMarquee(searchInput ? searchInput.value : '');

    viewport.onclick = function(event) {
        var badge = event.target.closest('.creator-marquee-badge');
        if (!badge || typeof window.filterByCreator !== 'function') return;
        window.filterByCreator({ key: badge.dataset.creatorKey, host: badge.dataset.creatorHost, handle: badge.dataset.creatorHandle, platform: badge.dataset.creatorPlatform, accountId: badge.dataset.creatorAccountId });
    };
}

async function initPresets() {
    var apiCounts = {}, statsData = {};
    // Wait for the privacy epoch before trusting anything from storage: a cached
    // catalog that predates an anonymity change must never be painted.
    if (window.ZyrexPrivacy && typeof window.ZyrexPrivacy.whenReady === 'function') {
        await window.ZyrexPrivacy.whenReady();
    }
    var cachedProducts = getCachedProducts();

    // Stale-While-Revalidate: Render immediately from cache on frame 0
    if (cachedProducts && cachedProducts.length > 0) {
        try {
            updateCreatorMarquee(cachedProducts);
            var localCounts = JSON.parse(localStorage.getItem("zyrex_downloads") || "{}");
            var initialPresets = cachedProducts.filter(function(p) { return !p.type || p.type === 'preset'; });
            initialPresets.forEach(function(p, idx) { if (p._origIdx === undefined) p._origIdx = idx; });
            window.presetsData = initialPresets;
            updatePresetStats(initialPresets, localCounts, {});
            filterPresets();
            hideResourcesLoader();
        } catch(e) {}
    }

    try {
        // Load creator username index for search
        await loadCreatorIndex().catch(function(){});

        // Fetch stats, download counts and products in parallel with individual fallbacks
        var [rCounts, rStats, rProducts] = await Promise.all([
            fetch("/api/downloads/counts", {credentials: 'include'}).then(function(res){ return res.json(); }).catch(function(){ return null; }),
            fetch("/api/resource-stats", {credentials: 'include'}).then(function(res){ return res.json(); }).catch(function(){ return null; }),
            fetch("/api/products?ts=" + Date.now()).then(function(res){ return res.json(); }).catch(function(){ return null; })
        ]);

        if (rCounts && rCounts.success && rCounts.counts) {
            apiCounts = rCounts.counts;
            localStorage.setItem("zyrex_downloads", JSON.stringify(rCounts.counts));
        }

        if (rStats && rStats.success) {
            statsData = rStats;
        }

        var productsData = Array.isArray(rProducts) ? rProducts : cachedProducts;
        if (Array.isArray(rProducts)) {
            setCachedProducts(rProducts);
        }

        var staticPresets = window.presetsData || [];
        var merged = productsData ? [...productsData] : [];
        staticPresets.forEach(function(sp) {
            if (!merged.some(function(p) { return p.id === sp.id; })) merged.push(sp);
        });
        updateCreatorMarquee(merged);
        var presetsOnly = merged.filter(function(p) { return !p.type || p.type === 'preset'; });
        presetsOnly.forEach(function(p, idx) { p._origIdx = idx; });

        window.presetsData = presetsOnly;

        // 1. Update numerical data table / stats bar FIRST while loading screen is active
        updatePresetStats(presetsOnly, apiCounts, statsData);

        // 2. Render preset cards grid with consistent filtering and sorting
        filterPresets();

    } catch(e) {
        console.error("Error in initPresets:", e);
        var fallbackPresets = (window.presetsData || []).filter(function(p) { return !p.type || p.type === 'preset'; });
        fallbackPresets.forEach(function(p, idx) { if (p._origIdx === undefined) p._origIdx = idx; });
        updatePresetStats(fallbackPresets, {}, {});
        filterPresets();
    } finally {
        // 3. ALWAYS hide loader once data table is processed or on error
        hideResourcesLoader();
    }
}

function updatePresetStats(data, apiCounts, statsData){
    var total = (data && data.length > 0) ? data.length : (statsData.total_resources || 0);
    var creators = (data && data.length > 0) ? new Set(data.map(function(r){return (r.creator_nickname||r.author_name||'').toLowerCase()}).filter(Boolean)).size : (statsData.unique_creators || 0);
    var totalDl = statsData.total_downloads || 0;
    if(!statsData.total_downloads){ (data||[]).forEach(function(r){ totalDl += (apiCounts[r.id]||0); }); }
    animateRes('statPresets', total);
    animateRes('statCreators', creators);
    animateRes('statDownloads', totalDl);

    // Hero Real Statistics Counters
    var pluginsCount = 0, presetsCount = 0, audiosCount = 0;
    (data || []).forEach(function(r) {
        var cat = (r.category || '').toLowerCase();
        var type = (r.type || '').toLowerCase();
        if (type === 'plugin' || cat === 'plugin' || cat === 'adobe' || cat === 'ofx' || cat === 'software') {
            pluginsCount++;
        } else if (type === 'audio' || cat === 'audio') {
            audiosCount++;
        } else {
            presetsCount++;
        }
    });

    animateRes('heroStatTotal', total);
    animateRes('heroStatPlugins', pluginsCount);
    animateRes('heroStatPresets', presetsCount);
    animateRes('heroStatAudios', audiosCount);

    // Update category pill counts
    var cats = {};
    (data || []).forEach(function(r){ var c = r.category || 'others'; cats[c] = (cats[c]||0)+1; });
    var allCount = (data || []).length;
    document.querySelectorAll('.cp button').forEach(function(btn){
        var c = btn.dataset.c;
        var cnt = btn.querySelector('.cnt');
        if(cnt){
            if(c === 'all') cnt.textContent = allCount;
            else cnt.textContent = cats[c] || 0;
        }
    });

    // Update subcategory pill counts
    var subcatCounts = { 'all': allCount, 'preset': 0, 'project-file': 0, 'setting-preset': 0 };
    (data || []).forEach(function(r) {
        var scs = getProductSubcategories(r);
        scs.forEach(function(sc) {
            if (subcatCounts[sc] !== undefined) {
                subcatCounts[sc]++;
            }
        });
    });
    var elAll = document.getElementById('subcatCntAll');
    if (elAll) elAll.textContent = subcatCounts['all'] || 0;
    var elPre = document.getElementById('subcatCntPreset');
    if (elPre) elPre.textContent = subcatCounts['preset'] || 0;
    var elProj = document.getElementById('subcatCntProject');
    if (elProj) elProj.textContent = subcatCounts['project-file'] || 0;
    var elSet = document.getElementById('subcatCntSetting');
    if (elSet) elSet.textContent = subcatCounts['setting-preset'] || 0;
}
function animateRes(id,target){
    var el=document.getElementById(id);
    if(!el)return;
    var start=parseInt(el.textContent)||0;
    if(start===target)return;
    var dur=600,step=(target-start)/(dur/16),cur=start;
    function tick(){
        cur+=step;
        if((step>0&&cur>=target)||(step<0&&cur<=target)){el.textContent=target;return}
        el.textContent=Math.round(cur);
        requestAnimationFrame(tick);
    }
    tick();
}

function shouldPaginatePresetGrid(grid) {
    return !!grid && grid.id === 'pg' && !!document.querySelector('.pgn');
}

function setPresetPageStatus(page, totalPages, totalItems, pageItemCount, paginate) {
    var shown = document.getElementById('shownCount');
    if (shown) {
        shown.textContent = paginate && totalItems > 0 ? pageItemCount + ' of ' + totalItems : String(totalItems);
    }

    var pageStatus = document.getElementById('pageStatus');
    if (pageStatus) {
        var safePage = totalItems > 0 ? page : 0;
        var safeTotal = totalItems > 0 ? totalPages : 0;
        pageStatus.innerHTML = 'Page <strong>' + safePage + '</strong> of <strong>' + safeTotal + '</strong>';
    }
}

function getPresetPaginationPages(totalPages) {
    var pages = [];
    if (totalPages <= 7) {
        for (var i = 1; i <= totalPages; i++) pages.push(i);
        return pages;
    }

    pages.push(1);
    var start = Math.max(2, currentPresetPage - 1);
    var end = Math.min(totalPages - 1, currentPresetPage + 1);
    if (start > 2) pages.push('gap-start');
    for (var p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push('gap-end');
    pages.push(totalPages);
    return pages;
}

function renderPresetPagination(totalPages) {
    var pager = document.querySelector('.pgn');
    if (!pager) return;
    if (totalPages <= 1) {
        pager.innerHTML = '';
        return;
    }

    var buttons = [
        '<button type="button" data-page="prev" aria-label="Previous page"' + (currentPresetPage === 1 ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>'
    ];

    getPresetPaginationPages(totalPages).forEach(function(page) {
        if (typeof page === 'string') {
            buttons.push('<span class="pgn-ellipsis" aria-hidden="true">...</span>');
            return;
        }
        buttons.push('<button type="button" data-page="' + page + '"' + (page === currentPresetPage ? ' class="active"' : '') + '>' + page + '</button>');
    });

    buttons.push('<button type="button" data-page="next" aria-label="Next page"' + (currentPresetPage === totalPages ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>');
    pager.innerHTML = buttons.join('');
}

function goToPresetPage(targetPage) {
    if (!lastPresetRenderItems.length) return;
    var totalPages = Math.max(1, Math.ceil(lastPresetRenderItems.length / PRESETS_PAGE_SIZE));
    var nextPage = currentPresetPage;

    if (targetPage === 'prev') nextPage -= 1;
    else if (targetPage === 'next') nextPage += 1;
    else nextPage = parseInt(targetPage, 10);

    if (!Number.isFinite(nextPage)) return;
    nextPage = Math.max(1, Math.min(totalPages, nextPage));
    if (nextPage === currentPresetPage) return;

    currentPresetPage = nextPage;
    renderPresets(lastPresetRenderItems);
    var top = document.querySelector('.rh') || document.getElementById('pg');
    if (top && typeof top.scrollIntoView === 'function') {
        top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function renderPresets(items) {
    // Filter out deleted products
    let deletedIds = [];
    try { deletedIds = JSON.parse(localStorage.getItem('zyrex_deleted_products') || '[]'); } catch(e) {}
    items = items.filter(p => !deletedIds.includes(p.id));
    
    // Admin edits come from the server; see js/product-overrides.js.
    if (window.ZyrexProductOverrides) items = window.ZyrexProductOverrides.applyList(items);
    
    const grid = document.getElementById('pg') || document.getElementById('presetsGrid');
    if (!grid) return;
    if (typeof currentViewMode !== 'undefined' && currentViewMode === 'list') grid.classList.add('list-view');
    else grid.classList.remove('list-view');

    const paginate = shouldPaginatePresetGrid(grid);
    const renderKey = items.map(function(p) { return p.id || ''; }).join('|');
    if (renderKey !== lastPresetRenderKey) {
        currentPresetPage = 1;
        lastPresetRenderKey = renderKey;
    }
    lastPresetRenderItems = items.slice();

    if (items.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#606070"><i class="fas fa-search" style="font-size:2rem;margin-bottom:15px;display:block"></i>No presets found.</div>';
        setPresetPageStatus(0, 0, 0, 0, paginate);
        renderPresetPagination(0);
        return;
    }

    const totalItems = items.length;
    const totalPages = paginate ? Math.max(1, Math.ceil(totalItems / PRESETS_PAGE_SIZE)) : 1;
    currentPresetPage = Math.max(1, Math.min(totalPages, currentPresetPage));
    const pageStart = paginate ? (currentPresetPage - 1) * PRESETS_PAGE_SIZE : 0;
    const pageItems = paginate ? items.slice(pageStart, pageStart + PRESETS_PAGE_SIZE) : items;

    setPresetPageStatus(currentPresetPage, totalPages, totalItems, pageItems.length, paginate);
    renderPresetPagination(totalPages);

    // Load download counts and like counts
    var downloadCounts = {};
    var likeCounts = {};
    var bookmarkCounts = {};
    try { downloadCounts = JSON.parse(localStorage.getItem('zyrex_downloads') || '{}'); } catch(e) {}
    try { likeCounts = JSON.parse(localStorage.getItem('zyrex_likes_count') || '{}'); } catch(e) {}
    try { bookmarkCounts = JSON.parse(localStorage.getItem('zyrex_bookmarks_count') || '{}'); } catch(e) {}

function getCategorySvgClass(cat) {
    const key = (cat || '').toLowerCase().trim();
    if (key === 'after-effects' || key === 'ae') return 'cat-icon-ae';
    if (key === 'premiere-pro' || key === 'premiere' || key === 'pr') return 'cat-icon-pr';
    if (key === 'photoshop' || key === 'ps') return 'cat-icon-ps';
    if (key === 'video-star' || key === 'vs') return 'cat-icon-vs';
    if (key === 'topaz-labs' || key === 'topaz') return 'cat-icon-topaz';
    return 'cat-icon-others';
}
window.getCategorySvgClass = getCategorySvgClass;

    if (typeof window.renderPresetGridChunked === 'function') {
        window.renderPresetGridChunked(grid, pageItems, {
            downloadCounts: downloadCounts,
            likeCounts: likeCounts
        });
        return;
    }

    grid.innerHTML = pageItems.map(item => {
        const cat = getCategoryLabel(item.category);
        const catClass = 'tag-' + (item.category || 'others');
        const catSvgClass = getCategorySvgClass(item.category);
        const catSvgIcon = `<span class="cat-svg-icon ${catSvgClass}" style="margin-right:4px"></span>`;
        const descriptionText = item.description || item.desc || '';
        const shortDesc = descriptionText ? descriptionText.substring(0, 80) + (descriptionText.length > 80 ? '...' : '') : '';
        const discordIdMatch = (item.creator_avatar || item.uploader_avatar || '').match(/\/avatars\/(\d{17,20})\//);
        const extractedDiscordId = discordIdMatch ? discordIdMatch[1] : '';

        const rawUploaderId = item.is_anonymous ? '' : String(item.credited_uploader_id || item.uploader_id || item.author_id || extractedDiscordId || '').trim();
        const creatorUsername = String(item.creator_username || '').trim().replace(/^@+/, '');
        const isFounderSocialImport = !item.is_anonymous && !item.credited_uploader_id
            && rawUploaderId === '1421177012814614548' && creatorUsername
            && !/^(reyli|reyliar)$/i.test(creatorUsername);
        const uploaderName = item.is_anonymous ? 'Anonymous' : (isFounderSocialImport
            ? (item.creator_nickname || '@' + creatorUsername)
            : (item.credited_uploader_name || item.uploader_name || item.author_name || item.creator_nickname || 'Zyrex').trim());
        const uploaderId = isFounderSocialImport ? '' : rawUploaderId;
        const uploaderAv = item.is_anonymous ? '' : (isFounderSocialImport
            ? (item.creator_avatar || '')
            : (item.credited_uploader_avatar || item.uploader_avatar || item.author_avatar || (extractedDiscordId && !item.uploader_id && !item.author_id ? item.creator_avatar : '') || '').trim());
        const avatarSrc = item.is_anonymous ? window.ANONYMOUS_AVATAR : (uploaderAv ? resolvePresetDiscordAvatar(uploaderId, uploaderAv) : window.DEFAULT_AVATAR);
        const avatarHtml = `<img src="${avatarSrc}" class="preset-card-avatar" data-uploader-id="${uploaderId}" data-fallback="${uploaderAv}" alt="" onerror="window.handlePresetCardAvatarError(this)">`;
        const nickname = uploaderName;
        // The whole card is already an anchor, so the uploader name routes to the
        // profile itself instead of nesting links.
        const uploaderProfileUrl = item.is_anonymous || isFounderSocialImport ? '' : String(item.uploader_profile_url || '').trim();
        const uploaderNameAttr = uploaderProfileUrl
            ? ` style="cursor:pointer" title="View profile" onclick="event.preventDefault();event.stopPropagation();location.href='${uploaderProfileUrl}'"`
            : '';
        const dlCount = downloadCounts[item.id] || item.downloads || 0;
        const likeCount = likeCounts[item.id] || 0;

        const thumbnailUrl = String(item.thumbnail || '').replace(/&amp;/gi, '&').replace(/&#0*38;/gi, '&');
        const thumbHtml = thumbnailUrl ?
            `<img src="${thumbnailUrl}" class="rimg" alt="" loading="lazy" onerror="this.style.display='none';this.parentElement.querySelector('.rimg-fallback').style.display='flex'">` +
            `<div class="rimg-fallback" style="display:none"><span class="cat-svg-icon ${catSvgClass}" style="font-size:2.8rem"></span></div>` : 
            `<div class="rimg-fallback"><span class="cat-svg-icon ${catSvgClass}" style="font-size:2.8rem"></span></div>`;

        const itemType = (item.type || '').toLowerCase();
        let detailUrl = '/leak?id=' + encodeURIComponent(item.id);
        if (itemType === 'scenepack') detailUrl = '/leaks';
        else if (itemType === 'audio') detailUrl = '/product-audio?id=' + encodeURIComponent(item.id);
        else if (itemType === 'plugin' || itemType === 'software') detailUrl = '/product?id=' + encodeURIComponent(item.id);

        const subcats = getProductSubcategories(item);
        const subcatBadges = subcats.map(function(sc) {
            if (sc === 'project-file') {
                return '<span class="tag-project-file">Project File</span>';
            } else if (sc === 'setting-preset') {
                const isTopaz = (item.setting_preset_type === 'topaz-labs') || (item.category === 'topaz-labs');
                const topazIcon = isTopaz ? '<span class="cat-svg-icon cat-icon-topaz" style="margin-right:4px"></span>' : '';
                return '<span class="tag-setting-preset">' + topazIcon + 'Setting Preset</span>';
            } else {
                return '<span class="tag-preset">Preset</span>';
            }
        }).join('');

        return '<a href="' + detailUrl + '" class="rc">' +
            '<div class="rc-img">' +
            thumbHtml +
            '<div class="roverlay"></div>' +
            '<div class="rbadge grid-badge">' + subcatBadges + '<span class="' + catClass + '">' + catSvgIcon + cat + '</span><span class="tag-free">Free</span></div>' +
            '</div>' +
            '<div class="rc-content">' +
            '<div class="rc-head">' +
            '<h3 class="rc-title" title="' + item.name + '">' + item.name + '</h3>' +
            '<div class="rbadge list-badge">' + subcatBadges + '<span class="' + catClass + '">' + catSvgIcon + cat + '</span><span class="tag-free">Free</span></div>' +
            '</div>' +
            (shortDesc ? '<p class="rc-desc">' + shortDesc + '</p>' : '') +
            '<div class="rc-footer">' +
            '<div class="rc-meta">' +
            '<div class="rava-fb">' + avatarHtml + '</div>' +
            '<span class="rname preset-card-name' + (uploaderId === '1421177012814614548' ? ' is-founder-name' : '') + '"' + uploaderNameAttr + ' data-uploader-id="' + uploaderId + '">' + nickname + '</span></div>' +
            '<div class="rc-actions">' +
            '<span><i class="fas fa-download"></i> ' + dlCount + '</span>' +
            '<span><i class="fas fa-heart"></i> ' + likeCount + '</span>' +
            '</div></div></div></a>';
    }).join('');

    loadPresetAvatars();

    requestAnimationFrame(() => {
        const items = grid.querySelectorAll('.rc');
        items.forEach((item, i) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            item.style.transition = 'opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            item.style.transitionDelay = (i * 0.03) + 's';
            requestAnimationFrame(() => {
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
                setTimeout(() => {
                    item.style.opacity = '';
                    item.style.transform = '';
                    item.style.transition = '';
                    item.style.transitionDelay = '';
                }, 500 + (i * 30));
            });
        });
    });
}

function getCategoryLabel(category) {
    const labels = {
        'after-effects': 'After Effects',
        'premiere-pro': 'Premiere Pro',
        'photoshop': 'Photoshop',
        'video-star': 'Video Star',
        'topaz-labs': 'Topaz Labs',
        'others': 'Others',
        'other': 'Others'
    };
    return labels[category] || category;
}

let currentPresetCategory = 'all';
let currentSearch = '';
let currentCreatorFilter = null;
let currentSort = 'recent';
let creatorIndex = {}; // {username: [product_ids]}
let creatorIndexLoaded = false;

// Cache helpers for creator index
var CREATOR_INDEX_CACHE_KEY = 'zyrex_creator_index';
var CREATOR_INDEX_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCachedCreatorIndex() {
    try {
        var raw = localStorage.getItem(CREATOR_INDEX_CACHE_KEY);
        if (!raw) return null;
        var cached = JSON.parse(raw);
        if (Date.now() - cached.ts < CREATOR_INDEX_CACHE_TTL) return cached.data;
    } catch(e) {}
    return null;
}
function setCachedCreatorIndex(data) {
    try {
        localStorage.setItem(CREATOR_INDEX_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
    } catch(e) {}
}

async function loadCreatorIndex() {
    if (creatorIndexLoaded) return;
    
    // Try cache first — apply immediately
    var cached = getCachedCreatorIndex();
    if (cached) {
        creatorIndex = cached;
        window._creatorIndex = cached;
        creatorIndexLoaded = true;
        if (currentSearch) filterPresets();
    }
    
    // Always fetch fresh in background
    try {
        var r = await fetch('/api/search/creator-index');
        var d = await r.json();
        if (d.success && d.index) {
            setCachedCreatorIndex(d.index);
            var changed = JSON.stringify(d.index) !== JSON.stringify(creatorIndex);
            creatorIndex = d.index;
            window._creatorIndex = d.index;
            creatorIndexLoaded = true;
            // Re-filter if index changed and user already typed something
            if (changed && currentSearch) filterPresets();
        }
    } catch(e) { console.error('Creator index load failed:', e); }
}

function getProductTimestamp(p) {
    if (!p) return 0;
    if (p.created_at) {
        var str = String(p.created_at).trim();
        if (str.indexOf('T') === -1 && str.indexOf(' ') !== -1) {
            str = str.replace(' ', 'T') + 'Z';
        }
        var t = Date.parse(str);
        if (!isNaN(t) && t > 0) return t;
    }
    if (p.date) {
        var t2 = Date.parse(p.date);
        if (!isNaN(t2) && t2 > 0) return t2;
    }
    if (p.timestamp) {
        var t3 = Number(p.timestamp);
        if (!isNaN(t3) && t3 > 0) return t3;
    }
    return 0;
}

function gs() {
    const input = document.getElementById('s');
    currentSearch = input ? input.value : '';
    currentPresetPage = 1;
    console.log('🔍 Search:', currentSearch);
    filterPresets();
}

let currentPresetSubcat = 'all';

function filterBySubcat(subcat) {
    currentPresetSubcat = subcat || 'all';
    currentPresetPage = 1;
    document.querySelectorAll('#subcatTabs .subcat-btn').forEach(btn => {
        if (btn.dataset.subcat === currentPresetSubcat) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    filterPresets();
}
window.filterBySubcat = filterBySubcat;

function filterByCreator(profile) {
    if (!profile || !profile.key) return;
    currentCreatorFilter = {
        key: String(profile.key).toLowerCase(),
        host: String(profile.host || '').toLowerCase(),
        handle: String(profile.handle || '').toLowerCase(),
        platform: String(profile.platform || '').toLowerCase(),
        accountId: String(profile.accountId || '')
    };
    currentSearch = '';
    var searchInput = document.getElementById('s');
    if (searchInput) searchInput.value = '';
    currentPresetCategory = 'all';
    currentPresetSubcat = 'all';
    currentPresetPage = 1;
    document.querySelectorAll('#cp button').forEach(function(button) {
        button.classList.toggle('active', button.dataset.c === 'all');
    });
    document.querySelectorAll('#subcatTabs .subcat-btn').forEach(function(button) {
        button.classList.toggle('active', button.dataset.subcat === 'all');
    });
    var status = document.getElementById('activeCreatorFilter');
    var name = document.getElementById('activeCreatorName');
    if (name) name.textContent = profile.handle || '';
    if (status) status.style.display = 'inline-flex';
    filterPresets();
    var results = document.querySelector('.ri');
    if (results) results.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
window.filterByCreator = filterByCreator;

function clearCreatorFilter() {
    currentCreatorFilter = null;
    var status = document.getElementById('activeCreatorFilter');
    if (status) status.style.display = 'none';
    currentPresetPage = 1;
    filterPresets();
}
window.clearCreatorFilter = clearCreatorFilter;

function productMatchesCreator(product, selected) {
    if (!product || !selected) return false;
    if (selected.accountId && String(product.creator_account_id || '') === selected.accountId && String(product.creator_platform || '').toLowerCase().replace('twitter', 'x') === selected.platform) return true;
    var socialUrl = String(product.creator_social_url || '').trim();
    if (socialUrl) {
        try {
            var parsed = new URL(socialUrl);
            if (/^https?:$/.test(parsed.protocol)) {
                var host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
                var key = host + parsed.pathname.replace(/\/+$/, '').toLowerCase();
                if (key === selected.key) return true;
                if (host === selected.host && selected.handle) {
                    var username = String(product.creator_username || '').trim().replace(/^@+/, '').toLowerCase();
                    if (username && username === selected.handle.replace(/^@/, '')) return true;
                }
            }
        } catch (_) {}
    }
    return false;
}

function filterPresets() {
    try {
    const data = window.presetsData || [];
    console.log('📦 Filtering', data.length, 'items, search:', currentSearch, 'subcat:', currentPresetSubcat, 'index keys:', Object.keys(creatorIndex).length);
    let filtered = data;
    if (currentPresetCategory !== 'all') {
        filtered = filtered.filter(r => {
            const cat = r.category === 'other' ? 'others' : r.category;
            return cat === currentPresetCategory;
        });
    }

    // Filter by Subcategory
    if (currentPresetSubcat && currentPresetSubcat !== 'all') {
        filtered = filtered.filter(r => {
            const subcats = getProductSubcategories(r);
            return subcats.includes(currentPresetSubcat);
        });
    }

    if (currentCreatorFilter) {
        filtered = filtered.filter(function(product) { return productMatchesCreator(product, currentCreatorFilter); });
    }

    if (currentSearch) {
        var s = currentSearch.toLowerCase().trim();
        // Check creator index: exact match + partial match
        var matchedIds = null;
        if (creatorIndex && Object.keys(creatorIndex).length > 0) {
            // Exact match
            var rawMatch = creatorIndex[s];
            if (rawMatch) {
                // Handle both array format ["id1","id2"] and string format "id1 id2"
                var ids = Array.isArray(rawMatch) ? rawMatch : String(rawMatch).split(/\s+/);
                matchedIds = new Set(ids);
            } else {
                // Partial match: any index key containing the search term
                matchedIds = new Set();
                for (var key in creatorIndex) {
                    if (key.indexOf(s) !== -1) {
                        var rawVal = creatorIndex[key];
                        var keyIds = Array.isArray(rawVal) ? rawVal : String(rawVal).split(/\s+/);
                        keyIds.forEach(function(id) { matchedIds.add(id); });
                    }
                }
                if (matchedIds.size === 0) matchedIds = null;
            }
        }
        filtered = filtered.filter(function(r){
            if (matchedIds && matchedIds.has(r.id)) return true;
            return (r.name||'').toLowerCase().includes(s)
                || (r.creator_nickname||'').toLowerCase().includes(s)
                || (r.author_name||'').toLowerCase().includes(s)
                || (r.creator_username||'').toLowerCase().includes(s)
                || (r.creator_social_url||'').toLowerCase().includes(s)
                || (r.tags||'').toLowerCase().includes(s);
        });
        console.log('🔎 Filtered from', data.length, 'to', filtered.length, 'matchedIds:', matchedIds ? matchedIds.size : 'none');
    }
    
    // Sort (shallow copy first to avoid mutating window.presetsData array)
    filtered = [...filtered];
    if (currentSort === 'recent') {
        filtered.sort(function(a, b) {
            var timeA = getProductTimestamp(a);
            var timeB = getProductTimestamp(b);
            if (timeA !== timeB && timeA > 0 && timeB > 0) {
                return timeB - timeA;
            }
            if (timeA > 0 && timeB === 0) return -1;
            if (timeB > 0 && timeA === 0) return 1;
            return ((a._origIdx !== undefined ? a._origIdx : 0) - (b._origIdx !== undefined ? b._origIdx : 0));
        });
    } else if (currentSort === 'downloads') {
        var dcounts = {};
        try { dcounts = JSON.parse(localStorage.getItem('zyrex_downloads') || '{}'); } catch(e) {}
        filtered.sort(function(a, b) {
            var dlA = dcounts[a.id] !== undefined ? dcounts[a.id] : (a.downloads || 0);
            var dlB = dcounts[b.id] !== undefined ? dcounts[b.id] : (b.downloads || 0);
            if (dlB !== dlA) return dlB - dlA;
            return ((a._origIdx !== undefined ? a._origIdx : 0) - (b._origIdx !== undefined ? b._origIdx : 0));
        });
    } else if (currentSort === 'name') {
        filtered.sort(function(a, b) {
            var cmp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
            if (cmp !== 0) return cmp;
            return ((a._origIdx !== undefined ? a._origIdx : 0) - (b._origIdx !== undefined ? b._origIdx : 0));
        });
    }
    
    renderPresets(filtered);
    } catch(e) { console.error('filterPresets error:', e); }
}

let currentViewMode = localStorage.getItem('zyrex_resource_view') || 'grid';

function applyPresetViewMode(mode) {
    currentViewMode = mode || 'grid';
    localStorage.setItem('zyrex_resource_view', currentViewMode);
    const grid = document.getElementById('pg') || document.getElementById('presetsGrid');
    if (grid) {
        if (currentViewMode === 'list') grid.classList.add('list-view');
        else grid.classList.remove('list-view');
    }
    document.querySelectorAll('.tb-v button').forEach(btn => {
        if (btn.dataset.view === currentViewMode) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initPresets();
    applyPresetViewMode(currentViewMode);

    // View toggle buttons
    document.querySelectorAll('.tb-v button').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.view) {
                applyPresetViewMode(btn.dataset.view);
            }
        });
    });

    // Category pills
    document.querySelectorAll('.cp button').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.cp button').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentPresetCategory = tab.dataset.c;
            currentPresetPage = 1;
            filterPresets();
        });
    });

    // Subcategory buttons delegation
    const subcatTabs = document.getElementById('subcatTabs');
    if (subcatTabs) {
        subcatTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.subcat-btn');
            if (btn && btn.dataset.subcat) {
                filterBySubcat(btn.dataset.subcat);
            }
        });
    }

    // Search input
    const searchInput = document.getElementById('s');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            gs();
        });
    }

    // Sort tabs
    document.querySelectorAll('.st button').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.st button').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSort = tab.dataset.sort;
            currentPresetPage = 1;
            filterPresets();
        });
    });
    const pager = document.querySelector('.pgn');
    if (pager) {
        pager.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-page]');
            if (!button || button.disabled) return;
            goToPresetPage(button.dataset.page);
        });
    }
});

console.log('🎨 Zyrex Presets loaded!');
