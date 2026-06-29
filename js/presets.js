/* ===================== PRESETS GRID RENDERER ===================== */
async function initPresets() {
    try {
        const resp = await fetch('/api/products');
        const data = await resp.json();
        if (Array.isArray(data)) {
            const staticPresets = window.presetsData || [];
            const merged = [...data];
            staticPresets.forEach(sp => {
                if (!merged.some(p => p.id === sp.id)) {
                    merged.push(sp);
                }
            });
            window.presetsData = merged;
            renderPresets(merged);
        } else {
            console.error("Expected array from products endpoint, using fallback");
            renderPresets(window.presetsData || []);
        }
    } catch(e) {
        console.error("Failed to load presets, using fallback:", e);
        renderPresets(window.presetsData || []);
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
        items = items.map(p => edits[p.id] ? { ...p, name: edits[p.id].name || p.name, category: edits[p.id].category || p.category, platform: edits[p.id].platform || p.platform, description: edits[p.id].description || p.description, desc: edits[p.id].description || p.desc, password: edits[p.id].password, links: edits[p.id].links || p.links, notes: edits[p.id].notes || p.notes } : p);
    } catch(e) {}
    
    const grid = document.getElementById('pg') || document.getElementById('presetsGrid');
    if (!grid) return;
    if (items.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#606070"><i class="fas fa-search" style="font-size:2rem;margin-bottom:15px;display:block"></i>No presets found.</div>';
        return;
    }

    const shown = document.getElementById('shownCount');
    if (shown) shown.textContent = items.length;

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
            '<span class="rname">' + nickname + '</span>' +
            '<span class="rdate">Free</span></div>' +
            '<div class="rc-actions">' +
            '<span><i class="fas fa-download"></i> 0</span>' +
            '<span><i class="fas fa-heart"></i> 0</span>' +
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

function gs() {
    const input = document.getElementById('s');
    currentSearch = input ? input.value : '';
    filterPresets();
}

function filterPresets() {
    const data = window.presetsData || [];
    let filtered = data;
    if (currentPresetCategory !== 'all') {
        filtered = filtered.filter(r => {
            const cat = r.category === 'other' ? 'others' : r.category;
            return cat === currentPresetCategory;
        });
    }
    if (currentSearch) {
        const s = currentSearch.toLowerCase();
        filtered = filtered.filter(r => r.name.toLowerCase().includes(s) || r.desc.toLowerCase().includes(s));
    }
    renderPresets(filtered);
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
