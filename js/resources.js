/* ===================== RESOURCES GRID RENDERER ===================== */
// Data is loaded from resources-data.js via window.resourcesData

let _mergedData = null;

// Cache helpers for resources
var RESOURCES_CACHE_KEY = 'zyrex_resources_cache';
var RESOURCES_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCachedResources() {
    try {
        var raw = localStorage.getItem(RESOURCES_CACHE_KEY);
        if (!raw) return null;
        var cached = JSON.parse(raw);
        if (Date.now() - cached.ts < RESOURCES_CACHE_TTL) return cached.data;
    } catch(e) {}
    return null;
}
function setCachedResources(data) {
    try {
        localStorage.setItem(RESOURCES_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
    } catch(e) {}
}

function initResources() {
    // Load creator index from bot API (cache-aware)
    if (!window._creatorIndex) {
        // Try cache first
        try {
            var raw = localStorage.getItem('zyrex_creator_index');
            if (raw) {
                var cached = JSON.parse(raw);
                if (cached.data && (Date.now() - cached.ts < 30 * 60 * 1000)) {
                    window._creatorIndex = cached.data;
                }
            }
        } catch(e) {}
        // Fetch fresh in background
        fetch('/api/search/creator-index').then(function(r) { return r.json(); }).then(function(d) {
            if (d.success && d.index) {
                window._creatorIndex = d.index;
                try { localStorage.setItem('zyrex_creator_index', JSON.stringify({ ts: Date.now(), data: d.index })); } catch(e) {}
            }
        }).catch(function() {});
    }
    
    const data = window.resourcesData;
    if (!data) { setTimeout(initResources, 100); return; }
    _mergedData = [...data];
    try {
        const pub = JSON.parse(localStorage.getItem('zyrex_published_resources') || '[]');
        if (pub.length > 0) {
            const existingIds = new Set(data.map(r => r.id));
            const newEntries = pub.filter(r => !existingIds.has(r.id));
            _mergedData = [...data, ...newEntries];
        }
    } catch(e) {}
    syncAndRender(_mergedData);
}

async function syncAndRender(data) {
    var apiCounts = {};
    try {
        var r = await fetch("/api/downloads/counts", {credentials: 'include'});
        var d = await r.json();
        if (d.success && d.counts) {
            apiCounts = d.counts;
            localStorage.setItem("zyrex_downloads", JSON.stringify(d.counts));
        }
    } catch(e) {}
    // Update stats from API data
    updateResourceStats(data, apiCounts);
    renderResources(data);
}

function updateResourceStats(data, apiCounts){
    var total=data.length;
    var creators=new Set();
    var totalDl=0;
    data.forEach(function(r){
        if(r.creator_nickname)creators.add(r.creator_nickname.toLowerCase());
        else if(r.author_name)creators.add(r.author_name.toLowerCase());
        totalDl+=(apiCounts[r.id]||0);
    });
    animateRes('statPresets',total);
    animateRes('statCreators',creators.size);
    animateRes('statDownloads',totalDl);
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

function getDomain(url) {
    try { return new URL(url).hostname; } catch { return ''; }
}

function getFavicon(url) {
    const domain = getDomain(url);
    if (!domain) return '';
    return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=64';
}

function getPlatformBadge(platform) {
    if (platform === 'win') return '<span class="resource-platform-badge win">WIN</span>';
    if (platform === 'mac') return '<span class="resource-platform-badge mac">MAC</span>';
    if (platform === 'both') return '<span class="resource-platform-badge both">WIN/MAC</span>';
    return '';
}

function getCategoryLabel(category) {
    const labels = { 
        'software': 'Software', 
        'adobe-plugin': 'Adobe Plugin', 
        'ofx-plugin': 'OFX Plugin',
        'others': 'Others',
        'other': 'Others'
    };
    return labels[category] || category;
}

function renderResources(items) {
    // Filter out deleted products
    let deletedIds = [];
    try { deletedIds = JSON.parse(localStorage.getItem('zyrex_deleted_products') || '[]'); } catch(e) {}
    items = items.filter(r => !deletedIds.includes(r.id));
    
    // Apply admin edits
    try {
        const edits = JSON.parse(localStorage.getItem('zyrex_edited_products') || '{}');
        items = items.map(p => edits[p.id] ? { ...p, name: edits[p.id].name || p.name, category: edits[p.id].category || p.category, platform: edits[p.id].platform || p.platform, description: edits[p.id].description || p.description, desc: edits[p.id].description || p.desc, password: edits[p.id].password !== undefined ? edits[p.id].password : p.password, links: edits[p.id].links || p.links, notes: edits[p.id].notes || p.notes } : p);
    } catch(e) {}
    
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;
    if (items.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--gray-dark)"><i class="fas fa-search" style="font-size:2rem;margin-bottom:15px;display:block"></i>No resources found.</div>';
        return;
    }
    // Load download counts from localStorage
    var downloadCounts = {};
    try { downloadCounts = JSON.parse(localStorage.getItem('zyrex_downloads') || '{}'); } catch(e) {}

    grid.innerHTML = items.map(item => {
        const faviconUrl = getFavicon(item.links[0].url);
        const platformBadge = getPlatformBadge(item.platform);
        const downloads = downloadCounts[item.id] || item.downloads || 0;
        const descriptionText = item.description || item.desc || '';
        const shortDesc = descriptionText ? descriptionText.substring(0, 100) + (descriptionText.length > 100 ? '...' : '') : '';
        return '<a href="/product?id=' + item.id + '" class="rc glass-card-enhanced shimmer-sweep">' +
            '<div class="rc-img">' +
            '<div class="rimg" style="display:flex;align-items:center;justify-content:center">' +
            (item.thumbnail ? '<img src="' + item.thumbnail + '" alt="">' : (faviconUrl ? '<img src="' + faviconUrl + '" alt="" onerror="this.parentElement.innerHTML=\'<i class=\\\'fas fa-cube\\\' style=\\\'font-size:2.5rem;opacity:0.3\\\'></i>\'">' : '<i class="fas fa-cube" style="font-size:2.5rem;opacity:0.3"></i>')) +
            '</div>' +
            '<div class="roverlay"></div>' +
            '<div class="rbadge">' +
            '<span class="tag-others">' + getCategoryLabel(item.category) + '</span>' +
            platformBadge +
            '</div>' +
            '</div>' +
            '<div class="rc-content">' +
            '<h3 class="rc-title">' + item.name + '</h3>' +
            (shortDesc ? '<p class="rc-desc">' + shortDesc + '</p>' : '') +
            '<div class="rc-footer">' +
            '<span class="rdate">Plugin</span>' +
            '<div class="rc-actions">' +
            '<span><i class="fas fa-download"></i> ' + downloads + '</span>' +
            '</div></div></div></a>';
    }).join('');
}

let currentPlatform = 'all';
let currentCategory = 'all';
let currentResSearch = '';

function resSearch(){
    var inp = document.getElementById('s');
    currentResSearch = inp ? inp.value : '';
    filterResources();
}

function filterResources() {
    let data = _mergedData || window.resourcesData || [];
    if (!data.length) return;
    let filtered = data;
    if (currentPlatform !== 'all') filtered = filtered.filter(r => r.platform === currentPlatform || r.platform === 'both');
    if (currentCategory !== 'all') {
        filtered = filtered.filter(r => {
            var cat = r.category === 'other' ? 'others' : r.category;
            return cat === currentCategory;
        });
    }
    if (currentResSearch) {
        var s = currentResSearch.toLowerCase().trim();
        // Check creator index: exact match + partial match
        var matchedIds = null;
        if (window._creatorIndex && Object.keys(window._creatorIndex).length > 0) {
            var rawMatch = window._creatorIndex[s];
            if (rawMatch) {
                var ids = Array.isArray(rawMatch) ? rawMatch : String(rawMatch).split(/\s+/);
                matchedIds = new Set(ids);
            } else {
                matchedIds = new Set();
                for (var key in window._creatorIndex) {
                    if (key.indexOf(s) !== -1) {
                        var rawVal = window._creatorIndex[key];
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
                || (r.desc||'').toLowerCase().includes(s)
                || (r.description||'').toLowerCase().includes(s)
                || (r.creator_nickname||'').toLowerCase().includes(s)
                || (r.creator_username||'').toLowerCase().includes(s)
                || (r.author_name||'').toLowerCase().includes(s)
                || (r.creator_social_url||'').toLowerCase().includes(s);
        });
    }
    renderResources(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
    initResources();
    document.querySelectorAll('.platform-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPlatform = btn.dataset.platform;
            filterResources();
        });
    });
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.category;
            filterResources();
        });
    });
});

console.log('📦 Zyrex Resources loaded!');
