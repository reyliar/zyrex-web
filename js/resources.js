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
    const labels = { 'software': 'Software', 'adobe-plugins': 'Adobe Plugin', 'ofx-plugins': 'OFX Plugin' };
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
        return '<a href="product.html?id=' + item.id + '" class="resource-item" style="text-decoration:none;color:inherit;display:block">' +
            '<div class="resource-thumb">' +
            (faviconUrl ? '<img src="' + faviconUrl + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<div class=&quot;thumb-fallback&quot;><i class=&quot;fas fa-cube&quot;></i></div>\'">' : '<div class="thumb-fallback"><i class="fas fa-cube"></i></div>') +
            getPlatformBadge(item.platform) +
            '</div>' +
            '<div class="resource-info">' +
            '<span class="resource-category">' + getCategoryLabel(item.category) + '</span>' +
            '<h3>' + item.name + '</h3>' +
            (item.desc ? '<p class="resource-desc">' + item.desc.substring(0, 60) + (item.desc.length > 60 ? '...' : '') + '</p>' : '') +
            '</div></a>';
    }).join('');

    // Add stagger animation to grid items
    requestAnimationFrame(() => {
        const items = grid.querySelectorAll('.resource-item');
        items.forEach((item, i) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            item.style.transition = 'opacity 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            item.style.transitionDelay = (i * 0.03) + 's';
            requestAnimationFrame(() => {
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            });
        });
    });
}

let currentPlatform = 'all';
let currentCategory = 'all';

function filterResources() {
    const data = window.resourcesData || [];
    let filtered = data;
    if (currentPlatform !== 'all') filtered = filtered.filter(r => r.platform === currentPlatform || r.platform === 'both');
    if (currentCategory !== 'all') filtered = filtered.filter(r => r.category === currentCategory);
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
