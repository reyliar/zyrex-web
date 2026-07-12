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
        roleColor: '#72e7e9'
    },
    {
        userId: '1382421118098346174',
        role: 'Co-Founder',
        roleColor: '#721818'
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

async function loadTeamMembers() {
    const teamGrid = document.getElementById('teamGrid');
    if (!teamGrid) return;

    // Helper to render a single member card
    function renderMemberCard(member) {
        var card = document.createElement('div');
        card.className = 'team-card';
        var avatarHtml = member.user && member.user.avatar
            ? '<img src="' + getAvatarUrl(member.user) + '" alt="' + (member.user.global_name || member.user.username) + '">'
            : '<div class="avatar-placeholder"><i class="fas fa-user"></i></div>';
        var displayName = (member.user && (member.user.global_name || member.user.username)) || member.cached_name || 'Loading...';
        var username = (member.user && member.user.username) || member.cached_username || '';
        var discordTag = username ? '@' + username : '';
        var roleClass = member.role.toLowerCase().replace(/\s+/g, '-');
        card.innerHTML = '<a href="https://discord.com/users/' + member.userId + '" target="_blank" class="team-card-link">' +
            '<div class="team-avatar">' + avatarHtml + '</div>' +
            '<h4>' + displayName + '</h4>' +
            '<span class="team-discord-tag">' + discordTag + '</span>' +
            '<span class="team-role role-' + roleClass + '"><i class="fas fa-crown"></i> ' + member.role + '</span>' +
            '</a>';
        return card;
    }

    // Step 1: Try to render from cache immediately
    var cachedMembers = teamMembers.map(function(member) {
        var cached = getCachedDiscordUser(member.userId);
        return { ...member, user: cached, cached_name: cached ? (cached.global_name || cached.username) : null, cached_username: cached ? cached.username : null };
    });
    var hasAllCached = cachedMembers.every(function(m) { return m.user; });

    if (hasAllCached) {
        // Render cached data immediately — no loading spinner
        teamGrid.innerHTML = '';
        cachedMembers.forEach(function(member) {
            teamGrid.appendChild(renderMemberCard(member));
        });
    } else {
        teamGrid.innerHTML = '<div class="loading-team"><i class="fas fa-spinner fa-spin"></i> Loading team...</div>';
    }

    // Step 2: Always fetch fresh data in background and update
    var timeoutId = setTimeout(function() {
        if (!hasAllCached && teamGrid.querySelector('.loading-team')) {
            teamGrid.innerHTML = '';
            teamMembers.forEach(function(member) {
                var card = document.createElement('div');
                card.className = 'team-card';
                var roleClass = member.role.toLowerCase().replace(/\s+/g, '-');
                card.innerHTML = '<a href="https://discord.com/users/' + member.userId + '" target="_blank" class="team-card-link">' +
                    '<div class="team-avatar"><div class="avatar-placeholder"><i class="fas fa-user"></i></div></div>' +
                    '<h4>Loading...</h4>' +
                    '<span class="team-discord-tag">@' + member.userId + '</span>' +
                    '<span class="team-role role-' + roleClass + '"><i class="fas fa-crown"></i> ' + member.role + '</span>' +
                    '</a>';
                teamGrid.appendChild(card);
            });
        }
    }, 6000);

    var freshMembers = await Promise.all(
        teamMembers.map(async function(member) {
            var user = await fetchDiscordUser(member.userId);
            // Fall back to cache if fetch fails
            if (!user) user = getCachedDiscordUser(member.userId);
            return { ...member, user: user };
        })
    );

    clearTimeout(timeoutId);

    // Only update if data actually changed
    var needsUpdate = false;
    if (!hasAllCached) { needsUpdate = true; }
    else {
        for (var i = 0; i < freshMembers.length; i++) {
            var f = freshMembers[i];
            var c = cachedMembers[i];
            var fName = (f.user && (f.user.global_name || f.user.username)) || '';
            var cName = c.cached_name || '';
            if (fName !== cName) { needsUpdate = true; break; }
        }
    }

    if (needsUpdate) {
        teamGrid.innerHTML = '';
        freshMembers.forEach(function(member) {
            teamGrid.appendChild(renderMemberCard(member));
        });
    }
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

console.log('Zyrex - Website loaded successfully!');
