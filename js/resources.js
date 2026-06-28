/* ===================== RESOURCES GRID RENDERER ===================== */
// Data is loaded from resources-data.js via window.resourcesData

function initResources() {
    const data = window.resourcesData;
    if (!data) { setTimeout(initResources, 100); return; }
    renderResources(data);
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
        'adobe-plugins': 'Adobe Plugin', 
        'ofx-plugins': 'OFX Plugin',
        'others': 'Others',
        'other': 'Others'
    };
    return labels[category] || category;
}

function renderResources(items) {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;
    if (items.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--gray-dark)"><i class="fas fa-search" style="font-size:2rem;margin-bottom:15px;display:block"></i>No resources found.</div>';
        return;
    }
    grid.innerHTML = items.map(item => {
        const faviconUrl = getFavicon(item.links[0].url);
        const platformBadge = getPlatformBadge(item.platform);
        const downloads = item.downloads !== undefined ? item.downloads : 0;
        const descriptionText = item.description || item.desc || '';
        const shortDesc = descriptionText ? descriptionText.substring(0, 100) + (descriptionText.length > 100 ? '...' : '') : '';
        return '<a href="product.html?id=' + item.id + '" class="rc glass-card-enhanced shimmer-sweep">' +
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

function filterResources() {
    const data = window.resourcesData || [];
    let filtered = data;
    if (currentPlatform !== 'all') filtered = filtered.filter(r => r.platform === currentPlatform || r.platform === 'both');
    if (currentCategory !== 'all') {
        filtered = filtered.filter(r => {
            const cat = r.category === 'other' ? 'others' : r.category;
            return cat === currentCategory;
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
