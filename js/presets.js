/* ===================== PRESETS GRID RENDERER ===================== */
function initPresets() {
    const data = window.presetsData;
    if (!data) { setTimeout(initPresets, 100); return; }
    renderPresets(data);
}

function renderPresets(items) {
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
        const shortDesc = item.desc ? item.desc.substring(0, 100) + (item.desc.length > 100 ? '...' : '') : '';

        return '<a href="product.html?id=' + item.id + '" class="rc">' +
            '<div class="rc-img">' +
            '<div class="rimg" style="display:flex;align-items:center;justify-content:center;background:#1c1c24">' +
            '<i class="fas ' + icon + '" style="font-size:2.5rem;color:#dc143c;opacity:.3"></i></div>' +
            '<div class="roverlay"></div>' +
            '<div class="rbadge"><span class="' + catClass + '">' + cat + '</span><span class="tag-free">Free</span></div>' +
            '</div>' +
            '<div class="rc-content">' +
            '<h3 class="rc-title">' + item.name + '</h3>' +
            (shortDesc ? '<p class="rc-desc">' + shortDesc + '</p>' : '') +
            '<div class="rc-footer">' +
            '<div class="rc-meta">' +
            '<div class="rava-fb"><i class="fas fa-sliders" style="font-size:.6rem"></i></div>' +
            '<span class="rname">Zyrex</span>' +
            '<span class="rdate">Premium</span></div>' +
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
        'others': 'Others'
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
        filtered = filtered.filter(r => r.category === currentPresetCategory);
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
