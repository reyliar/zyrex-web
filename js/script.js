/* ===================== GLOBAL AVATAR ERROR HANDLER ===================== */
window.DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2EwYTBiMCI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==";
window.handleAvatarError = function(img) {
    if (!img) return;
    img.onerror = null;
    img.src = window.DEFAULT_AVATAR;
};

/* ===================== NAVBAR SCROLL EFFECT ===================== */
const navbar = document.querySelector('.navbar');
const navLinks = document.querySelectorAll('.nav-links a');

let lastScrollY = 0;
let scrollTimeout = null;

if (navbar) {
window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    
    // Scrolled class (compact style when not at top)
    if (currentScrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
        navbar.classList.remove('nav-hidden');
    }
    
    // Hide on scroll down, show on scroll up (only when past 100px)
    if (currentScrollY > 100) {
        if (currentScrollY > lastScrollY) {
            // Scrolling down → hide
            navbar.classList.add('nav-hidden');
        } else {
            // Scrolling up → show
            navbar.classList.remove('nav-hidden');
        }
    }
    
    lastScrollY = currentScrollY;

    // Active link on scroll
    let current = '';
    const sections = document.querySelectorAll('section[id]');
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 150;
        if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});
}

/* ===================== MOBILE HAMBURGER MENU ===================== */
const hamburger = document.getElementById('hamburger');
const navLinksContainer = document.getElementById('navLinks');

if (hamburger && navLinksContainer) {
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinksContainer.classList.toggle('open');
});

// Close menu on link click
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navLinksContainer.classList.remove('open');
    });
});
}

/* ===================== DISCORD API - TEAM PROFILES ===================== */
const BOT_API = 'http://93.115.101.154:12988';
const CDN_BASE = 'https://cdn.discordapp.com';

// Avatar proxy helper — bypasses Discord CDN blocks (e.g. Turkey)
function avatarProxyUrl(userId, avatarHash, size) {
    size = size || 64;
    if (!userId || !avatarHash) return '';
    const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return '/api/avatar/' + userId + '/' + avatarHash + '.' + ext + '?size=' + size;
}
function defaultAvatarUrl(idx) {
    return '/api/avatar/default/' + (idx || 0) + '.png';
}

const teamMembers = [
    {
        userId: '1421177012814614548',
        role: 'Founder',
        roleColor: '#184b61'
    },
    {
        userId: '1382421118098346174',
        role: 'Co-Founder',
        roleColor: '#d39f9f'
    }
];

function getAvatarUrl(user, size = 256) {
    if (!user?.avatar || !user?.id) return '';
    return avatarProxyUrl(user.id, user.avatar, size);
}

function getBannerUrl(user, size = 480) {
    if (!user?.banner || !user?.id) return '';
    const ext = user.banner.startsWith('a_') ? 'gif' : 'png';
    return '/api/banner/' + user.id + '/' + user.banner + '.' + ext + '?size=' + size;
}

// Cache helpers for Discord user data
var DISCORD_USER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
function getCachedDiscordUser(userId) {
    try {
        var raw = localStorage.getItem('zyrex_discord_user_' + userId);
        if (!raw) return null;
        var cached = JSON.parse(raw);
        if (Date.now() - cached.ts < DISCORD_USER_CACHE_TTL) return cached.data;
    } catch(e) {}
    return null;
}
function setCachedDiscordUser(userId, data) {
    try {
        localStorage.setItem('zyrex_discord_user_' + userId, JSON.stringify({ ts: Date.now(), data: data }));
    } catch(e) {}
}

async function fetchDiscordUser(userId) {
    try {
        const url = new URL('/api/discord-user', location.origin);
        url.searchParams.set('userId', userId);
        const response = await fetch(url);
        const data = await response.json();
        if (data.success && data.user) {
            setCachedDiscordUser(userId, data.user);
            return data.user;
        }
    } catch (err) {
        console.warn(`Failed to fetch Discord user ${userId}:`, err);
    }
    return null;
}

async function fetchTeamData() {
    try {
        var res = await fetch('/api/team');
        if (res.ok) {
            var d = await res.json();
            if (d && d.success) return d;
        }
    } catch(e) { console.warn('Failed to fetch team data:', e); }
    return null;
}

function formatTeamAvatarUrl(url, userId) {
    if (!url) return '';
    if (url.includes('cdn.discordapp.com/avatars/')) {
        var match = url.match(/\/avatars\/(\d+)\/([a-zA-Z0-9_]+)/);
        if (match) {
            return '/api/avatar/' + match[1] + '/' + match[2] + '.png?size=256';
        }
    }
    return url;
}

function renderTeamMembers(founders, staff, container) {
    if (!container) return;
    
    var allMembers = [];
    var defaultFounders = [
        { id: "1421177012814614548", username: "reyliar", global_name: "reyli", avatar: "/api/avatar/1421177012814614548/66077819163365312e485b95e30001d8.png", role: "Founder", status: "online" },
        { id: "1382421118098346174", username: "dvmonaep", global_name: "kerem", avatar: "/api/avatar/1382421118098346174/d6a983ec1a87e899b737422ee50fb441.png", role: "Co-Founder", status: "online" }
    ];

    var defaultStaff = [
        { id: "700282586026737694", username: "ugotherizz", global_name: "𝑱𝑰𝑵𝑨✧.*", avatar: "/api/avatar/700282586026737694/f358b6536d5aaf867c158c6c0ffb1463.png", role: "Staff Team", status: "online" }
    ];

    var activeFounders = (founders && founders.length > 0) ? founders : defaultFounders;
    var activeStaff = (staff && staff.length > 0) ? staff : defaultStaff;

    // Ensure default staff (JINA) is merged if missing from API array
    defaultStaff.forEach(function(ds) {
        if (!activeStaff.some(function(s) { return String(s.id) === String(ds.id); })) {
            activeStaff.push(ds);
        }
    });

    activeFounders.forEach(function(f) { allMembers.push(f); });
    activeStaff.forEach(function(s) { allMembers.push(s); });

    var html = '';
    allMembers.forEach(function(m) {
        var roleStr = m.role || 'Staff Team';
        var isFounder = roleStr.toLowerCase() === 'founder';
        var isCoFounder = roleStr.toLowerCase() === 'co-founder';
        
        var roleClass = isFounder ? 'role-founder' : (isCoFounder ? 'role-co-founder' : 'role-staff-team');
        var iconClass = (isFounder || isCoFounder) ? 'fa-crown' : 'fa-shield-halved';
        var src = formatTeamAvatarUrl(m.avatar, m.id);
        
        var avaHtml = src 
            ? '<img src="' + src + '" alt="' + (m.global_name || m.username) + '" onerror="this.onerror=null;this.src=\'assets/content.png\';">'
            : '<div class="avatar-placeholder"><i class="fas ' + iconClass + '"></i></div>';

        html += '<div class="team-card glass-card-enhanced shimmer-sweep">' +
            '<a href="https://discord.com/users/' + m.id + '" target="_blank" class="team-card-link">' +
                '<div class="team-avatar">' +
                    avaHtml +
                    '<span class="status-dot status-' + (m.status || 'online') + '"></span>' +
                '</div>' +
                '<h4>' + (m.global_name || m.username) + '</h4>' +
                '<span class="team-discord-tag">@' + m.username + '</span>' +
                '<span class="team-role ' + roleClass + '"><i class="fas ' + iconClass + '"></i> ' + roleStr + '</span>' +
            '</a>' +
        '</div>';
    });

    container.innerHTML = html;
}

async function loadTeamMembers() {
    const teamGrid = document.getElementById('teamGrid');
    if (!teamGrid) return;

    // 1. Render immediate default structure (Founders + Staff) so there's zero delay
    renderTeamMembers(null, null, teamGrid);

    // 2. Fetch live data from bot API / worker
    var data = await fetchTeamData();
    if (data && data.success) {
        renderTeamMembers(data.founders, data.staff, teamGrid);
    }
}

// Auto-run team members load on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTeamMembers);
} else {
    loadTeamMembers();
}

/* ===================== DISCORD GUILD STATS ===================== */
var GUILD_STATS_CACHE_KEY = 'zyrex_guild_stats';
var GUILD_STATS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function fetchGuildStats() {
    // Try cached stats first
    try {
        var raw = localStorage.getItem(GUILD_STATS_CACHE_KEY);
        if (raw) {
            var cached = JSON.parse(raw);
            if (cached.data && (Date.now() - cached.ts < GUILD_STATS_CACHE_TTL)) {
                applyGuildStats(cached.data);
            }
        }
    } catch(e) {}

    try {
        const resp = await fetch('/api/guild/stats');
        if (!resp.ok) return;
        const data = await resp.json();
        // Cache the guild stats
        try { localStorage.setItem(GUILD_STATS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data })); } catch(e) {}
        applyGuildStats(data);
    } catch(e) {
        console.warn('Guild stats unavailable');
    }
}

function applyGuildStats(data) {
    const badge = document.querySelector('.stats-badge');
    if (badge && data.name) {
        badge.innerHTML = '<i class="fab fa-discord"></i> ' + data.name.toUpperCase();
    }
    
    const statMap = {
        'Members': data.member_count || 0,
        'Online': data.online_count || 0,
        'Channels': data.channels_count || 0,
        'Roles': data.roles_count || 0,
        'Boost Level': data.boost_level || 0
    };
    document.querySelectorAll('.stats-item').forEach(function(item) {
        const label = item.querySelector('.stats-label');
        const number = item.querySelector('.stats-number');
        if (label && number) {
            const key = label.textContent.trim();
            if (statMap[key] !== undefined) {
                number.setAttribute('data-target', statMap[key]);
            }
        }
    });
}

/* ===================== HERO REAL RESOURCE COUNTERS ===================== */
function fetchResourceStatsForHero() {
    var p1 = fetch('/api/resource-stats', {credentials: 'include'}).then(function(r){ return r.json(); }).catch(function(){ return null; });
    var p2 = fetch('/api/products', {credentials: 'include'}).then(function(r){ return r.json(); }).catch(function(){ return null; });

    Promise.all([p1, p2]).then(function(results) {
        var rStats = results[0] || {};
        var products = results[1] || [];
        if (!Array.isArray(products) && products.data) products = products.data;
        if (!Array.isArray(products)) products = window.presetsData || [];

        var pluginsCount = 0, presetsCount = 0, scenepacksCount = 0, audiosCount = 0;
        var seenIds = new Set();

        // 1. Process static/cached pluginsData (software, plugins, scripts)
        var staticPlugins = window.pluginsData || [];
        staticPlugins.forEach(function(p) {
            if (p.id) seenIds.add(p.id);
            pluginsCount++;
        });

        // 2. Process dynamic products from DB
        products.forEach(function(r) {
            if (r.id && seenIds.has(r.id)) return; // prevent duplicate counting
            if (r.id) seenIds.add(r.id);

            var cat = (r.category || '').toLowerCase();
            var type = (r.type || '').toLowerCase();
            var isPlugin = type === 'plugin' || 
                           type === 'software' || 
                           cat.includes('plugin') || 
                           cat.includes('soft') || 
                           cat.includes('software') || 
                           cat.includes('extension') || 
                           cat.includes('script') || 
                           cat.includes('ofx') || 
                           cat.includes('adobe') ||
                           cat.includes('avx');

            if (type === 'audio' || cat.includes('audio') || cat.includes('sound') || cat.includes('music')) {
                audiosCount++;
            } else if (type === 'scenepack' || cat.includes('scenepack') || cat.includes('scene')) {
                scenepacksCount++;
            } else if (isPlugin) {
                pluginsCount++;
            } else {
                presetsCount++;
            }
        });

        // 3. Fallbacks if stats API returns direct category counts
        if (rStats && rStats.category_counts) {
            if (rStats.category_counts.presets) presetsCount = rStats.category_counts.presets;
            if (rStats.category_counts.scenepacks) scenepacksCount = rStats.category_counts.scenepacks;
            if (rStats.category_counts.audios) audiosCount = rStats.category_counts.audios;
        }

        animateHeroNum('heroStatPresets', presetsCount);
        animateHeroNum('heroStatPlugins', pluginsCount);
        animateHeroNum('heroStatScenepacks', scenepacksCount);
        animateHeroNum('heroStatAudios', audiosCount);
    });
}

function animateHeroNum(id, target) {
    var el = document.getElementById(id);
    if (!el) return;
    var start = 0;
    var duration = 1600;
    var startTime = performance.now();
    function step(now) {
        var elapsed = now - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(start + (target - start) * eased);
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target;
    }
    requestAnimationFrame(step);
}

if (document.getElementById('heroStatPresets') || document.getElementById('heroStatPlugins')) {
    document.addEventListener('DOMContentLoaded', fetchResourceStatsForHero);
    fetchResourceStatsForHero();
}

if (document.querySelector('.stats-badge, .stats-item, .stats-number')) {
fetchGuildStats().then(() => {
    /* ===================== COUNTER ANIMATION ===================== */
const counters = document.querySelectorAll('.stats-number');

const animateCounter = (counter) => {
    const target = parseInt(counter.getAttribute('data-target'));
    if (!target) return;
    const duration = 2000;
    const startTime = performance.now();

    const updateCounter = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(0 + (target - 0) * eased);
        counter.textContent = currentValue;
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            counter.textContent = target;
        }
    };
    requestAnimationFrame(updateCounter);
};

const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

counters.forEach(counter => counterObserver.observe(counter));
});
}

/* ===================== CONTACT FORM ===================== */
const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const submitBtn = contactForm.querySelector('.form-submit');
        if (!submitBtn) return;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Sending... <i class="fas fa-spinner fa-spin"></i>';
        submitBtn.disabled = true;

        setTimeout(() => {
            submitBtn.innerHTML = 'Sent! <i class="fas fa-check"></i>';
            submitBtn.style.background = 'linear-gradient(135deg, #7a081e, #8b0000)';

            // Show our custom premium toast
            if (typeof window.showToast === 'function') {
                window.showToast('Message Received', 'Thank you for reaching out! We will get back to you shortly.', 'success');
            }

            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.style.background = '';
                submitBtn.disabled = false;
                contactForm.reset();
            }, 3000);
        }, 1500);
    });
}

/* ===================== SCROLL REVEAL ANIMATION ===================== */
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal, .reveal-scale, .reveal-left, .reveal-right, .resource-card, .team-card, .contact-grid, .stats-item, .about-intro-card');
    if (!revealElements.length) return;

    if (!('IntersectionObserver' in window)) {
        revealElements.forEach(el => el.classList.add('revealed'));
        return;
    }

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                // Also handle inline-style approach for backward compat
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -50px 0px' });

    revealElements.forEach(el => {
        // Only add classes if not already using inline approach
        if (!el.classList.contains('reveal') && !el.classList.contains('reveal-scale') &&
            !el.classList.contains('reveal-left') && !el.classList.contains('reveal-right')) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(40px)';
            el.style.transition = 'opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        }
        revealObserver.observe(el);
    });
}

initScrollReveal();

/* ===================== SMOOTH SCROLL ===================== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;

        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

/* ===================== PARTICLE BACKGROUND ===================== */
const particlesContainer = document.getElementById('particles');
if (particlesContainer) {
    const compactParticles = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    const particleCount = compactParticles ? 18 : 36;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 4 + 2}px;
            height: ${Math.random() * 4 + 2}px;
            background: rgba(220, 20, 60, ${Math.random() * 0.4 + 0.1});
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: floatParticle ${Math.random() * 10 + 8}s infinite;
            animation-delay: ${Math.random() * 5}s;
            pointer-events: none;
        `;
        particlesContainer.appendChild(particle);
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes floatParticle {
            0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
            25% { transform: translateY(-30px) translateX(15px); opacity: 0.6; }
            50% { transform: translateY(-10px) translateX(-10px); opacity: 0.4; }
            75% { transform: translateY(-40px) translateX(20px); opacity: 0.7; }
        }
    `;
    document.head.appendChild(style);
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
    loadTeamMembers();
});

/* ===================== TOAST SYSTEM ===================== */
window.showToast = function(title, message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.position = 'fixed';
        container.style.bottom = '24px';
        container.style.right = '24px';
        container.style.zIndex = '99999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '12px';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.background = 'rgba(12, 4, 8, 0.88)';
    toast.style.backdropFilter = 'blur(20px)';
    toast.style.webkitBackdropFilter = 'blur(20px)';
    toast.style.border = '1px solid rgba(168, 15, 45, 0.35)';
    toast.style.borderRadius = '14px';
    toast.style.padding = '16px 20px';
    toast.style.color = '#fff';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '14px';
    toast.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(168, 15, 45, 0.15)';
    toast.style.width = '340px';
    toast.style.pointerEvents = 'auto';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    const iconColor = type === 'success' ? '#00c864' : '#ff3860';

    toast.innerHTML = `
        <i class="fas ${icon}" style="font-size: 1.4rem; color: ${iconColor}; flex-shrink: 0;"></i>
        <div style="flex: 1; min-width: 0;">
            <strong style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 2px;">${title}</strong>
            <span style="display: block; font-size: 0.76rem; color: #8888a0; line-height: 1.4;">${message}</span>
        </div>
        <button style="background: transparent; border: none; color: #55556a; cursor: pointer; font-size: 0.8rem; padding: 4px; transition: color 0.2s;" onclick="this.parentElement.style.opacity='0';setTimeout(()=>this.parentElement.remove(),400)"><i class="fas fa-times"></i></button>
    `;

    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 50);

    // Animate out
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
};

/* ===================== GLOBAL NOTIFICATIONS & SCROLL-TO-TOP HUB ===================== */
(function initGlobalFloatingHub() {
    let cachedLiveNotifs = [];

    function getNotifPrefs() {
        try {
            const raw = localStorage.getItem('zyrex_notif_prefs');
            return raw ? JSON.parse(raw) : { dnd: false, presets: true, plugins: true, replies: true, announcements: true };
        } catch(e) {
            return { dnd: false, presets: true, plugins: true, replies: true, announcements: true };
        }
    }

    function setupHub() {
        if (document.getElementById('globalFloatingHub')) return;
        if (!document.body) {
            setTimeout(setupHub, 50);
            return;
        }

        // Create Floating Action Container with Panel inside for perfect anchoring
        const hub = document.createElement('div');
        hub.id = 'globalFloatingHub';
        hub.className = 'global-floating-hub';
        hub.innerHTML = `
            <div class="floating-notif-wrap">
                <button id="globalNotifBtn" class="floating-hub-btn" onclick="window.toggleGlobalNotifPanel(event)" title="Notifications" aria-label="Notifications">
                    <i class="fas fa-bell"></i>
                    <span class="notif-bubble-badge" id="floatingNotifBadge" style="display:none">0</span>
                </button>
                <div id="globalNotifPanel" class="global-notif-panel">
                    <div class="notif-panel-header">
                        <h4>
                            <i class="fas fa-bell" style="color:var(--cherry-neon)"></i> Notifications 
                            <span class="notif-bubble-badge" id="panelNotifBadge" style="position:static;display:none;margin-left:4px">0</span>
                        </h4>
                        <div class="notif-panel-actions">
                            <button class="notif-header-act-btn" onclick="window.toggleDNDQuick()" title="Toggle Do Not Disturb" id="btnQuickDND"><i class="fas fa-moon"></i></button>
                            <a href="/settings?tab=general" class="notif-header-act-btn" title="Notification Settings"><i class="fas fa-cog"></i></a>
                            <button class="notif-header-act-btn" onclick="window.clearAllNotifs()" title="Clear all notifications"><i class="fas fa-trash-can"></i></button>
                            <button class="notif-header-act-btn" onclick="window.markAllNotifsRead()" title="Mark all as read"><i class="fas fa-check-double"></i></button>
                            <button class="notif-header-act-btn" onclick="window.toggleGlobalNotifPanel(event)" title="Close"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                    <div class="notif-panel-body" id="globalNotifList"></div>
                    <div class="notif-panel-footer" id="globalNotifFooter" style="display:none">
                        <span id="notifFooterSummary" style="color:var(--text-sub)"></span>
                        <div style="display:flex;gap:8px">
                            <button class="notif-footer-btn" onclick="window.clearAllNotifs()"><i class="fas fa-trash-can"></i> Clear All</button>
                        </div>
                    </div>
                </div>
            </div>
            <button id="globalScrollTopBtn" class="floating-hub-btn scroll-top-btn" onclick="window.scrollToTopSmooth()" title="Back to Top" aria-label="Back to Top">
                <i class="fas fa-arrow-up"></i>
            </button>
        `;
        document.body.appendChild(hub);

        // Smooth scroll listener: toggles scroll-to-top button visibility
        function handleScroll() {
            const h = document.getElementById('globalFloatingHub');
            if (h) {
                const scrollY = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
                if (scrollY > 180) {
                    h.classList.add('scrolled');
                } else {
                    h.classList.remove('scrolled');
                }
            }
        }
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            const p = document.getElementById('globalNotifPanel');
            const btn = document.getElementById('globalNotifBtn');
            if (p && p.classList.contains('open') && !p.contains(e.target) && !btn.contains(e.target)) {
                p.classList.remove('open');
            }
        });

        // Load notifications data
        fetchLiveNotifications();
        // Background live check every 45s
        setInterval(fetchLiveNotifications, 45000);
    }

    function getReadIds() {
        try {
            return JSON.parse(localStorage.getItem('zyrex_read_notifs') || '[]');
        } catch(e) {
            return [];
        }
    }

    function getClearedIds() {
        try {
            return JSON.parse(localStorage.getItem('zyrex_cleared_notifs') || '[]');
        } catch(e) {
            return [];
        }
    }

    async function fetchLiveNotifications() {
        const prefs = getNotifPrefs();
        try {
            let userId = '';
            try {
                const sessRaw = sessionStorage.getItem('zyrex_session_user');
                if (sessRaw) userId = JSON.parse(sessRaw).id || '';
            } catch(e) {}

            const res = await fetch('/api/notifications' + (userId ? '?user_id=' + encodeURIComponent(userId) : ''));
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.notifications)) {
                    cachedLiveNotifs = data.notifications;
                }
            }
        } catch(e) {
            console.warn('Live notifications fetch failed:', e);
        }
        renderGlobalNotifications();
    }

    function parseNotifMarkdown(str) {
        if (!str) return '';
        let text = escapeHtmlNotif(str);
        // headings # Title, ## Title
        text = text.replace(/^#\s+(.*?)$/gm, '<strong style="font-size:1.02em;color:#fff;display:inline-block;margin-bottom:2px">$1</strong>');
        text = text.replace(/^##\s+(.*?)$/gm, '<strong style="font-size:0.96em;color:#fff;display:inline-block">$1</strong>');
        text = text.replace(/^###\s+(.*?)$/gm, '<strong style="font-size:0.90em;color:#fff;display:inline-block">$1</strong>');
        // bold **text** or __text__
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
        // italic *text* or _text_
        text = text.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
        text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
        // strikethrough ~~text~~
        text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
        // inline code `code`
        text = text.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.09);padding:1px 5px;border-radius:4px;font-size:0.8em;color:#ff8da1">$1</code>');
        // markdown links [text](url)
        text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+|\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--cherry-light);text-decoration:underline">$1</a>');
        // newlines
        text = text.replace(/\n/g, '<br>');
        return text;
    }

    function renderGlobalNotifications() {
        const list = document.getElementById('globalNotifList');
        const footer = document.getElementById('globalNotifFooter');
        const footerSummary = document.getElementById('notifFooterSummary');
        const badge1 = document.getElementById('floatingNotifBadge');
        const badge2 = document.getElementById('panelNotifBadge');
        const dndBtn = document.getElementById('btnQuickDND');
        if (!list) return;

        const prefs = getNotifPrefs();
        if (dndBtn) {
            dndBtn.style.color = prefs.dnd ? 'var(--cherry-neon)' : 'var(--text-sub)';
            dndBtn.title = prefs.dnd ? 'Do Not Disturb is ON (Click to turn off)' : 'Enable Do Not Disturb';
        }

        // If DND is enabled, hide all badges and show DND state
        if (prefs.dnd) {
            if (badge1) badge1.style.display = 'none';
            if (badge2) badge2.style.display = 'none';
            if (footer) footer.style.display = 'none';
            list.innerHTML = `
                <div style="text-align:center;padding:32px 16px;color:var(--text-sub);font-size:0.84rem">
                    <i class="fas fa-moon" style="font-size:2rem;margin-bottom:10px;display:block;color:var(--cherry-neon);opacity:0.85"></i>
                    <div style="font-weight:700;color:#fff;margin-bottom:4px">Do Not Disturb is Active</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:14px">Live notifications and badges are muted.</div>
                    <button class="notif-header-act-btn" onclick="window.toggleDNDQuick()" style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,43,82,0.15);color:#fff;border:1px solid rgba(255,43,82,0.35);padding:6px 14px;border-radius:8px">
                        <i class="fas fa-bell"></i> Turn Off DND
                    </button>
                </div>
            `;
            return;
        }

        const clearedIds = getClearedIds();
        // Filter notifications according to cleared IDs and user category preferences
        const filteredNotifs = cachedLiveNotifs.filter(n => {
            if (clearedIds.includes(n.id)) return false;
            const cat = n.category || 'announcement';
            if (cat === 'preset' && prefs.presets === false) return false;
            if (cat === 'plugin' && prefs.plugins === false) return false;
            if (cat === 'scenepack' && prefs.presets === false) return false;
            if (cat === 'audio' && prefs.presets === false) return false;
            if (cat === 'reply' && prefs.replies === false) return false;
            if (cat === 'announcement' && prefs.announcements === false) return false;
            return true;
        });

        const readIds = getReadIds();
        const unreadCount = filteredNotifs.filter(n => !readIds.includes(n.id)).length;

        if (badge1) {
            badge1.textContent = unreadCount;
            badge1.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
        if (badge2) {
            badge2.textContent = unreadCount;
            badge2.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
        }

        if (filteredNotifs.length === 0) {
            if (footer) footer.style.display = 'none';
            list.innerHTML = `
                <div style="text-align:center;padding:36px 16px;color:rgba(255,255,255,0.45);font-size:0.84rem">
                    <i class="fas fa-bell-slash" style="font-size:1.8rem;margin-bottom:10px;opacity:0.35;display:block;color:var(--cherry-neon)"></i>
                    <div>No new notifications</div>
                </div>
            `;
            return;
        }

        if (footer) {
            footer.style.display = 'flex';
            if (footerSummary) {
                footerSummary.textContent = `${filteredNotifs.length} notification${filteredNotifs.length > 1 ? 's' : ''}`;
            }
        }

        list.innerHTML = filteredNotifs.map(n => {
            const isUnread = !readIds.includes(n.id);
            const iconClass = n.icon_brand ? `fab ${n.icon}` : `fas ${n.icon}`;
            const timeAgo = formatNotifTime(n.created_at);
            return `
                <div class="notif-item ${isUnread ? 'unread' : ''}" style="position:relative">
                    <a href="${n.link}" style="display:flex;align-items:flex-start;gap:12px;text-decoration:none;color:inherit;flex:1;min-width:0" onclick="window.markNotifRead('${n.id}')">
                        <div class="notif-icon-circle" style="background:${n.bg};color:${n.color}">
                            <i class="${iconClass}"></i>
                        </div>
                        <div class="notif-content-wrap">
                            <div class="notif-title-row" style="padding-right:24px">
                                <span class="notif-title">${parseNotifMarkdown(n.title)}</span>
                                <span class="notif-time">${timeAgo}</span>
                            </div>
                            <div class="notif-desc">${parseNotifMarkdown(n.desc)}</div>
                        </div>
                    </a>
                    <button class="notif-item-del-btn" onclick="window.clearSingleNotif(event, '${n.id}')" title="Dismiss">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    function formatNotifTime(isoDate) {
        if (!isoDate) return 'Just now';
        try {
            const date = new Date(isoDate.endsWith('Z') ? isoDate : isoDate + 'Z');
            const sec = Math.floor((new Date() - date) / 1000);
            if (isNaN(sec) || sec < 40) return 'Just now';
            if (sec < 60) return `${sec}s ago`;
            const min = Math.floor(sec / 60);
            if (min < 60) return `${min}m ago`;
            const hrs = Math.floor(min / 60);
            if (hrs < 24) return `${hrs}h ago`;
            return `${Math.floor(hrs / 24)}d ago`;
        } catch(e) {
            return 'Recently';
        }
    }

    function escapeHtmlNotif(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    window.toggleGlobalNotifPanel = function(e) {
        if (e) e.stopPropagation();
        const panel = document.getElementById('globalNotifPanel');
        if (panel) {
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) {
                renderGlobalNotifications();
            }
        }
    };

    window.toggleDNDQuick = function() {
        const prefs = getNotifPrefs();
        prefs.dnd = !prefs.dnd;
        localStorage.setItem('zyrex_notif_prefs', JSON.stringify(prefs));
        renderGlobalNotifications();
    };

    window.refreshGlobalNotifications = function() {
        renderGlobalNotifications();
    };

    window.scrollToTopSmooth = function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    window.markNotifRead = function(id) {
        const readIds = getReadIds();
        if (!readIds.includes(id)) {
            readIds.push(id);
            localStorage.setItem('zyrex_read_notifs', JSON.stringify(readIds));
            renderGlobalNotifications();
        }
    };

    window.markAllNotifsRead = function() {
        const allIds = cachedLiveNotifs.map(n => n.id);
        localStorage.setItem('zyrex_read_notifs', JSON.stringify(allIds));
        renderGlobalNotifications();
    };

    window.clearSingleNotif = function(e, id) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const cleared = getClearedIds();
        if (!cleared.includes(id)) {
            cleared.push(id);
            localStorage.setItem('zyrex_cleared_notifs', JSON.stringify(cleared));
            renderGlobalNotifications();
        }
    };

    window.clearAllNotifs = function() {
        const cleared = getClearedIds();
        cachedLiveNotifs.forEach(n => {
            if (!cleared.includes(n.id)) cleared.push(n.id);
        });
        localStorage.setItem('zyrex_cleared_notifs', JSON.stringify(cleared));
        renderGlobalNotifications();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupHub);
        window.addEventListener('load', setupHub);
    } else {
        setupHub();
    }
    setTimeout(setupHub, 200);
    setTimeout(setupHub, 1000);
})();

console.log('Zyrex - Website loaded successfully!');
