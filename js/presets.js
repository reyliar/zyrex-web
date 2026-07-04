/* ===================== PRESETS GRID RENDERER ===================== */

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
    
    try {
        const resp = await fetch('/api/products');
        const data = await resp.json();
        if (Array.isArray(data)) {
            const staticPresets = window.presetsData || [];
            const merged = [...data];
            staticPresets.forEach(sp => {
                if (!merged.some(p => p.id === sp.id)) merged.push(sp);
            });
            const presetsOnly = merged.filter(p => !p.type || p.type === 'preset');
            window.presetsData = presetsOnly;
            updatePresetStats(presetsOnly, apiCounts, statsData);
            renderPresets(presetsOnly);
        } else {
            renderPresets(window.presetsData || []);
        }
    } catch(e) {
        renderPresets(window.presetsData || []);
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
    if (items.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#606070"><i class="fas fa-search" style="font-size:2rem;margin-bottom:15px;display:block"></i>No presets found.</div>';
        const shown = document.getElementById('shownCount');
        if (shown) shown.textContent = '0';
        return;
    }

    const shown = document.getElementById('shownCount');
    if (shown) shown.textContent = items.length;

    // Load download counts and like counts
    var downloadCounts = {};
    var likeCounts = {};
    var bookmarkCounts = {};
    try { downloadCounts = JSON.parse(localStorage.getItem('zyrex_downloads') || '{}'); } catch(e) {}
    try { likeCounts = JSON.parse(localStorage.getItem('zyrex_likes_count') || '{}'); } catch(e) {}
    try { bookmarkCounts = JSON.parse(localStorage.getItem('zyrex_bookmarks_count') || '{}'); } catch(e) {}

    grid.innerHTML = items.map(item => {
        const cat = getCategoryLabel(item.category);
        const catClass = 'tag-' + item.category;
        const icons = { 'after-effects':'fa-film','premiere-pro':'fa-video','photoshop':'fa-image','video-star':'fa-star','topaz-labs':'fa-gem','others':'fa-folder' };
        const icon = icons[item.category] || 'fa-sliders';
        const descriptionText = item.description || item.desc || '';
        const shortDesc = descriptionText ? descriptionText.substring(0, 100) + (descriptionText.length > 100 ? '...' : '') : '';
        const avatarUrl = item.creator_avatar || '';
        const avatarHtml = avatarUrl ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : `<i class="fas fa-user" style="font-size:.6rem"></i>`;
        const nickname = item.creator_nickname || item.author_name || 'Zyrex';
        const dlCount = downloadCounts[item.id] || item.downloads || 0;
        const likeCount = likeCounts[item.id] || 0;

        const thumbHtml = item.thumbnail ? 
            `<img src="${item.thumbnail}" style="width:100%;height:100%;object-fit:cover">` : 
            `<i class="fas ${icon}" style="font-size:2.5rem;color:#a80f2d;opacity:.3"></i>`;

        return '<a href="/preset?id=' + item.id + '" class="rc glass-card-enhanced shimmer-sweep">' +
            '<div class="rc-img">' +
            '<div class="rimg" style="display:flex;align-items:center;justify-content:center;background:#1c1c24;overflow:hidden;width:100%;height:100%">' +
            thumbHtml + '</div>' +
            '<div class="roverlay"></div>' +
            '<div class="rbadge"><span class="' + catClass + '">' + cat + '</span><span class="tag-free">Free</span></div>' +
            '</div>' +
            '<div class="rc-content">' +
            '<h3 class="rc-title">' + item.name + '</h3>' +
            (shortDesc ? '<p class="rc-desc">' + shortDesc + '</p>' : '') +
            '<div class="rc-footer">' +
            '<div class="rc-meta">' +
            '<div class="rava-fb" style="overflow:hidden;display:flex;align-items:center;justify-content:center">' + avatarHtml + '</div>' +
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
let creatorIndex = {}; // {username: [product_ids]}
let creatorIndexLoaded = false;

async function loadCreatorIndex() {
    if (creatorIndexLoaded) return;
    try {
        var r = await fetch('/api/search/creator-index');
        var d = await r.json();
        if (d.success && d.index) {
            creatorIndex = d.index;
            window._creatorIndex = d.index;
            creatorIndexLoaded = true;
            // Re-filter if user already typed something
            if (currentSearch) filterPresets();
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
});

console.log('🎨 Zyrex Presets loaded!');
