/* ===================== NAVBAR SCROLL EFFECT ===================== */
const navbar = document.querySelector('.navbar');
const navLinks = document.querySelectorAll('.nav-links a');

let lastScrollY = 0;
let scrollTimeout = null;

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

/* ===================== MOBILE HAMBURGER MENU ===================== */
const hamburger = document.getElementById('hamburger');
const navLinksContainer = document.getElementById('navLinks');

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

/* ===================== DISCORD API - TEAM PROFILES ===================== */
const BOT_API = 'http://93.115.101.154:12988';
const CDN_BASE = 'https://cdn.discordapp.com';

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
    if (!user?.avatar) return '';
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `${CDN_BASE}/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}

function getBannerUrl(user, size = 480) {
    if (!user?.banner) return '';
    const ext = user.banner.startsWith('a_') ? 'gif' : 'png';
    return `${CDN_BASE}/banners/${user.id}/${user.banner}.${ext}?size=${size}`;
}

async function fetchDiscordUser(userId) {
    try {
        const url = new URL('/api/discord-user', location.origin);
        url.searchParams.set('userId', userId);
        const response = await fetch(url);
        const data = await response.json();
        if (data.success && data.user) return data.user;
    } catch (err) {
        console.warn(`Failed to fetch Discord user ${userId}:`, err);
    }
    return null;
}

async function loadTeamMembers() {
    const teamGrid = document.getElementById('teamGrid');
    if (!teamGrid) return;

    teamGrid.innerHTML = '<div class="loading-team"><i class="fas fa-spinner fa-spin"></i> Loading team...</div>';

    // Timeout: show fallback after 6 seconds if still loading
    const timeoutId = setTimeout(() => {
        if (teamGrid.querySelector('.loading-team')) {
            teamGrid.innerHTML = '';
            teamMembers.forEach(member => {
                const card = document.createElement('div');
                card.className = 'team-card';
                const roleClass = member.role.toLowerCase().replace(/\s+/g, '-');
                card.innerHTML = `
                    <a href="https://discord.com/users/${member.userId}" target="_blank" class="team-card-link">
                        <div class="team-avatar">
                            <div class="avatar-placeholder"><i class="fas fa-user"></i></div>
                        </div>
                        <h4>Loading...</h4>
                        <span class="team-discord-tag">@${member.userId}</span>
                        <span class="team-role role-${roleClass}">
                            <i class="fas fa-crown"></i> ${member.role}
                        </span>
                    </a>
                `;
                teamGrid.appendChild(card);
            });
        }
    }, 6000);

    const members = await Promise.all(
        teamMembers.map(async (member) => {
            const user = await fetchDiscordUser(member.userId);
            return { ...member, user };
        })
    );

    clearTimeout(timeoutId);
    teamGrid.innerHTML = '';

    members.forEach(member => {
        const card = document.createElement('div');
        card.className = 'team-card';

        const avatarHtml = member.user && member.user.avatar
            ? `<img src="${getAvatarUrl(member.user)}" alt="${member.user.global_name || member.user.username}">`
            : `<div class="avatar-placeholder"><i class="fas fa-user"></i></div>`;

        const displayName = member.user?.global_name || member.user?.username || 'Unknown';
        const username = member.user?.username || '';
        const discordTag = member.user ? `@${username}` : '';
        const roleClass = member.role.toLowerCase().replace(/\s+/g, '-');

        card.innerHTML = `
            <a href="https://discord.com/users/${member.userId}" target="_blank" class="team-card-link">
                <div class="team-avatar">
                    ${avatarHtml}
                </div>
                <h4>${displayName}</h4>
                <span class="team-discord-tag">${discordTag}</span>
                <span class="team-role role-${roleClass}">
                    <i class="fas fa-crown"></i> ${member.role}
                </span>
            </a>
        `;

        teamGrid.appendChild(card);
    });
}

/* ===================== DISCORD GUILD STATS ===================== */
async function fetchGuildStats() {
    try {
        const resp = await fetch('/api/guild/stats');
        if (!resp.ok) return;
        const data = await resp.json();
        
        const badge = document.querySelector('.stats-badge');
        if (badge && data.name) {
            badge.innerHTML = `<i class="fab fa-discord"></i> ${data.name.toUpperCase()}`;
        }
        
        const statMap = {
            'Members': data.member_count || 0,
            'Online': data.online_count || 0,
            'Channels': data.channels_count || 0,
            'Roles': data.roles_count || 0,
            'Boost Level': data.boost_level || 0
        };
        document.querySelectorAll('.stats-item').forEach(item => {
            const label = item.querySelector('.stats-label');
            const number = item.querySelector('.stats-number');
            if (label && number) {
                const key = label.textContent.trim();
                if (statMap[key] !== undefined) {
                    number.setAttribute('data-target', statMap[key]);
                }
            }
        });
    } catch(e) {
        console.warn('Guild stats unavailable');
    }
}

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

/* ===================== CONTACT FORM ===================== */
const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const submitBtn = contactForm.querySelector('.form-submit');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Sending... <i class="fas fa-spinner fa-spin"></i>';
        submitBtn.disabled = true;

        setTimeout(() => {
            submitBtn.innerHTML = 'Sent! <i class="fas fa-check"></i>';
            submitBtn.style.background = 'linear-gradient(135deg, #7a081e, #8b0000)';

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
    const particleCount = 50;
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

console.log('🔥 Zyrex - Website loaded successfully!');
