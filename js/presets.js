/* ===================== PRESETS GRID RENDERER ===================== */

// Cache helpers for products data
var PRODUCTS_CACHE_KEY = 'zyrex_products_cache';
var PRODUCTS_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
var PRESETS_PAGE_SIZE = 33;
var currentPresetPage = 1;
var lastPresetRenderKey = '';
var lastPresetRenderItems = [];

function getCachedProducts() {
    try {
        var raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
        if (!raw) return null;
        var cached = JSON.parse(raw);
        if (Date.now() - cached.ts < PRODUCTS_CACHE_TTL) return cached.data;
    } catch(e) {}
    return null;
}
function setCachedProducts(data) {
    try {
        localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
    } catch(e) {}
}

async function initPresets() {
    // Load creator username index for search (await to ensure ready before first search)
    await loadCreatorIndex();
    
    // Sync download counts + resource stats from API
    var apiCounts = {}, statsData = {};
    try {
        var r1 = await fetch("/api/downloads/counts", {credentials: 'include'});
        var d1 = await r1.json();
        if (d1.success && d1.counts) { apiCounts = d1.counts; localStorage.setItem("zyrex_downloads", JSON.stringify(d1.counts)); }
    } catch(e) {}
    try {
        var r2 = await fetch("/api/resource-stats", {credentials: 'include'});
        var d2 = await r2.json();
        if (d2.success) statsData = d2;
    } catch(e) {}
    
    // Try cached products first — render immediately if available
    var cachedProducts = getCachedProducts();
    if (cachedProducts && Array.isArray(cachedProducts)) {
        var staticPresets = window.presetsData || [];
        var mergedCached = [...cachedProducts];
        staticPresets.forEach(function(sp) {
            if (!mergedCached.some(function(p) { return p.id === sp.id; })) mergedCached.push(sp);
        });
        var presetsOnlyCached = mergedCached.filter(function(p) { return !p.type || p.type === 'preset'; });
        window.presetsData = presetsOnlyCached;
        updatePresetStats(presetsOnlyCached, apiCounts, statsData);
        renderPresets(presetsOnlyCached);
    }
    
    // Always fetch fresh data in background
    try {
        const resp = await fetch('/api/products');
        const data = await resp.json();
        if (Array.isArray(data)) {
            setCachedProducts(data);
            const staticPresets = window.presetsData || [];
            const merged = [...data];
            staticPresets.forEach(sp => {
                if (!merged.some(p => p.id === sp.id)) merged.push(sp);
            });
            const presetsOnly = merged.filter(p => !p.type || p.type === 'preset');
            // Only re-render if data changed or wasn't cached
            if (!cachedProducts || JSON.stringify(presetsOnly.map(function(p){return p.id}).sort()) !== JSON.stringify(presetsOnlyCached.map(function(p){return p.id}).sort())) {
                window.presetsData = presetsOnly;
                updatePresetStats(presetsOnly, apiCounts, statsData);
                renderPresets(presetsOnly);
            }
        } else if (!cachedProducts) {
            renderPresets(window.presetsData || []);
        }
    } catch(e) {
        if (!cachedProducts) {
            renderPresets(window.presetsData || []);
        }
    }
}

function updatePresetStats(data, apiCounts, statsData){
    var total = statsData.total_resources || data.length;
    var creators = statsData.unique_creators || new Set(data.map(function(r){return (r.creator_nickname||r.author_name||'').toLowerCase()}).filter(Boolean)).size;
    var totalDl = statsData.total_downloads || 0;
    if(!statsData.total_downloads){ data.forEach(function(r){ totalDl += (apiCounts[r.id]||0); }); }
    animateRes('statPresets', total);
    animateRes('statCreators', creators);
    animateRes('statDownloads', totalDl);
    // Update category pill counts
    var cats = {};
    data.forEach(function(r){ var c = r.category || 'others'; cats[c] = (cats[c]||0)+1; });
    var allCount = data.length;
    document.querySelectorAll('.cp button').forEach(function(btn){
        var c = btn.dataset.c;
        var cnt = btn.querySelector('.cnt');
        if(cnt){
            if(c === 'all') cnt.textContent = allCount;
            else cnt.textContent = cats[c] || 0;
        }
    });
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
    
    // Apply admin edits
    try {
        const edits = JSON.parse(localStorage.getItem('zyrex_edited_products') || '{}');
        items = items.map(p => edits[p.id] ? { ...p, name: edits[p.id].name || p.name, category: edits[p.id].category || p.category, platform: edits[p.id].platform || p.platform, description: edits[p.id].description || p.description, desc: edits[p.id].description || p.desc, password: edits[p.id].password !== undefined ? edits[p.id].password : p.password, links: edits[p.id].links || p.links, notes: edits[p.id].notes || p.notes } : p);
    } catch(e) {}
    
    const grid = document.getElementById('pg') || document.getElementById('presetsGrid');
    if (!grid) return;

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

    grid.innerHTML = pageItems.map(item => {
        const cat = getCategoryLabel(item.category);
        const catClass = 'tag-' + (item.category || 'others');
        const icons = { 'after-effects':'fa-film','premiere-pro':'fa-video','photoshop':'fa-image','video-star':'fa-star','topaz-labs':'fa-gem','others':'fa-folder' };
        const icon = icons[item.category] || 'fa-sliders';
        const descriptionText = item.description || item.desc || '';
        const shortDesc = descriptionText ? descriptionText.substring(0, 80) + (descriptionText.length > 80 ? '...' : '') : '';
        const avatarUrl = item.creator_avatar || '';
        const avatarHtml = avatarUrl ? `<img src="${avatarUrl}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><i class="fas fa-user" style="display:none;font-size:.5rem"></i>` : `<i class="fas fa-user" style="font-size:.5rem"></i>`;
        const nickname = item.creator_nickname || item.author_name || 'Zyrex';
        const dlCount = downloadCounts[item.id] || item.downloads || 0;
        const likeCount = likeCounts[item.id] || 0;

        const thumbHtml = item.thumbnail ? 
            `<img src="${item.thumbnail}" class="rimg" alt="" loading="lazy" onerror="this.style.display='none';this.parentElement.querySelector('.rimg-fallback').style.display='flex'">` +
            `<div class="rimg-fallback" style="display:none"><i class="fas ${icon}"></i></div>` : 
            `<div class="rimg-fallback"><i class="fas ${icon}"></i></div>`;

        return '<a href="/preset?id=' + item.id + '" class="rc">' +
            '<div class="rc-img">' +
            thumbHtml +
            '<div class="roverlay"></div>' +
            '<div class="rbadge"><span class="' + catClass + '">' + cat + '</span><span class="tag-free">Free</span></div>' +
            '</div>' +
            '<div class="rc-content">' +
            '<h3 class="rc-title" title="' + item.name + '">' + item.name + '</h3>' +
            (shortDesc ? '<p class="rc-desc">' + shortDesc + '</p>' : '') +
            '<div class="rc-footer">' +
            '<div class="rc-meta">' +
            '<div class="rava-fb">' + avatarHtml + '</div>' +
            '<span class="rname">' + nickname + '</span></div>' +
            '<div class="rc-actions">' +
            '<span><i class="fas fa-download"></i> ' + dlCount + '</span>' +
            '<span><i class="fas fa-heart"></i> ' + likeCount + '</span>' +
            '</div></div></div></a>';
    }).join('');

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

function gs() {
    const input = document.getElementById('s');
    currentSearch = input ? input.value : '';
    console.log('🔍 Search:', currentSearch);
    filterPresets();
}

function filterPresets() {
    try {
    const data = window.presetsData || [];
    console.log('📦 Filtering', data.length, 'items, search:', currentSearch, 'index keys:', Object.keys(creatorIndex).length);
    let filtered = data;
    if (currentPresetCategory !== 'all') {
        filtered = filtered.filter(r => {
            const cat = r.category === 'other' ? 'others' : r.category;
            return cat === currentPresetCategory;
        });
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
    
    // Sort
    if (currentSort === 'recent') {
        filtered.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
    } else if (currentSort === 'downloads') {
        var dcounts = {};
        try { dcounts = JSON.parse(localStorage.getItem('zyrex_downloads') || '{}'); } catch(e) {}
        filtered.sort((a, b) => {
            const dlA = dcounts[a.id] || a.downloads || 0;
            const dlB = dcounts[b.id] || b.downloads || 0;
            return dlB - dlA;
        });
    } else if (currentSort === 'name') {
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    
    renderPresets(filtered);
    } catch(e) { console.error('filterPresets error:', e); }
}

document.addEventListener('DOMContentLoaded', () => {
    initPresets();
    // Category pills
    document.querySelectorAll('.cp button').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.cp button').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentPresetCategory = tab.dataset.c;
            filterPresets();
        });
    });
    // Sort tabs
    document.querySelectorAll('.st button').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.st button').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSort = tab.dataset.sort;
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
