/* ===================== DISCORD AUTH BUTTON ===================== */
// Tries API first, falls back to Discord invite

// Cache helpers for auth user data
var AUTH_USER_CACHE_KEY = 'zyrex_auth_user';
var AUTH_USER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes (frequently re-validated)

// Avatar proxy helper — bypasses Discord CDN blocks (e.g. Turkey)
function avatarProxyUrl(userId, avatarHash, size) {
    size = size || 64;
    if (!userId || !avatarHash) return '';
    const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return '/api/avatar/' + userId + '/' + avatarHash + '.' + ext + '?size=' + size;
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(char) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char];
    });
}

function clearAuthCache() {
    try { localStorage.removeItem(AUTH_USER_CACHE_KEY); } catch(e) {}
}

function renderLoginUI(btn) {
    if (!btn) return;
    btn.classList.remove('auth-ready', 'menu-open');
    btn.innerHTML = '<a href="/api/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search) + '" class="auth-login-btn"><i class="fab fa-discord"></i><span>Login</span></a>';
}

function redirectToLogin(returnTo) {
    clearAuthCache();
    const target = returnTo || (window.location.pathname + window.location.search);
    window.location.href = '/api/login?redirect=' + encodeURIComponent(target);
}

// Render auth UI from user data (reusable for both cached & fresh)
function renderAuthUI(user) {
    const btn = document.getElementById('authBtn');
    if (!btn) return;
    const avatarUrl = user.avatar
        ? avatarProxyUrl(user.id, user.avatar, 64)
        : '';
    const displayName = escapeHtml(user.global_name || user.username || 'Zyrex User');
    const username = escapeHtml(user.username || 'member');
    const roleLabel = user.can_upload ? 'Uploader' : 'Member';
    const roleHtml = user.is_admin ? '' : '<span class="auth-role">' + roleLabel + '</span>';
    const initial = escapeHtml((user.global_name || user.username || 'Z').charAt(0).toUpperCase());
    const avatarHtml = avatarUrl
        ? '<img class="auth-avatar" src="' + avatarUrl + '" alt="">'
        : '<span class="auth-avatar auth-avatar-fallback">' + initial + '</span>';

    btn.classList.remove('menu-open');
    btn.classList.add('auth-ready');
    btn.innerHTML =
        '<button type="button" class="auth-user" onclick="toggleUserMenu()" aria-expanded="false" aria-controls="userMenu">' +
            avatarHtml +
            '<span class="auth-copy">' +
                '<span class="auth-name">' + displayName + '</span>' +
                roleHtml +
            '</span>' +
            (user.is_admin ? '<span class="auth-admin-badge" title="Admin"><i class="fas fa-shield-halved"></i><span>Admin</span></span>' : '') +
            '<i class="fas fa-chevron-down auth-chevron" aria-hidden="true"></i>' +
        '</button>' +
        '<div id="userMenu" class="auth-dropdown" hidden>' +
            '<div class="auth-menu-head">' +
                avatarHtml +
                '<div class="auth-menu-copy">' +
                    '<strong>' + displayName + '</strong>' +
                    '<span>@' + username + '</span>' +
                '</div>' +
            '</div>' +
            '<a href="/settings" class="auth-menu-link"><i class="fas fa-cog"></i><span>Settings</span></a>' +
            ((user.can_upload || user.is_admin) ? '<a href="/upload" class="auth-menu-link"><i class="fas fa-cloud-upload-alt"></i><span>Upload</span></a>' : '') +
            '<a href="/api/logout" class="auth-menu-link auth-menu-link-danger"><i class="fas fa-sign-out-alt"></i><span>Logout</span></a>' +
        '</div>';
}

async function checkAuth() {
    const btn = document.getElementById('authBtn');
    if (!btn) return;

    // Try to show cached user immediately
    try {
        var raw = localStorage.getItem(AUTH_USER_CACHE_KEY);
        if (raw) {
            var cached = JSON.parse(raw);
            if (cached.data && (Date.now() - cached.ts < AUTH_USER_CACHE_TTL)) {
                renderAuthUI(cached.data);
            }
        }
    } catch(e) {}

    try {
        const resp = await fetch('/api/me', { credentials: 'include' });
        if (resp.ok) {
            const user = await resp.json();
            // Cache the auth user
            try { localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: user })); } catch(e) {}
            renderAuthUI(user);
            return;
        }
        if (resp.status === 401 || resp.status === 403) {
            clearAuthCache();
            renderLoginUI(btn);
            return;
        }
    } catch(e) {
        console.log('Auth API unavailable, showing invite link');
    }
    
    // Fallback: show Discord Login button (only if no cached user shown)
    if (!btn.querySelector('.auth-user')) {
        clearAuthCache();
        renderLoginUI(btn);
    }
}

function toggleUserMenu() {
    const wrapper = document.getElementById('authBtn');
    const menu = document.getElementById('userMenu');
    const trigger = wrapper ? wrapper.querySelector('.auth-user') : null;
    if (wrapper && menu) {
        const nextOpen = !wrapper.classList.contains('menu-open');
        wrapper.classList.toggle('menu-open', nextOpen);
        menu.hidden = !nextOpen;
        if (trigger) trigger.setAttribute('aria-expanded', String(nextOpen));
    }
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const logoutLink = e.target.closest && e.target.closest('a[href="/api/logout"]');
    if (logoutLink) clearAuthCache();

    const menu = document.getElementById('userMenu');
    const btn = document.getElementById('authBtn');
    if (menu && btn && !btn.contains(e.target)) {
        btn.classList.remove('menu-open');
        menu.hidden = true;
        const trigger = btn.querySelector('.auth-user');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    if (!shouldSkipCookieConsent()) {
        initCookieConsent();
    }
});

/* ===================== COOKIES CONSENT SYSTEM ===================== */

function shouldSkipCookieConsent() {
    const host = window.location.hostname.toLowerCase();
    const path = (window.location.pathname.replace(/\/+$/, '') || '/').toLowerCase();
    return host === 'dl.zyrexediting.xyz' || path === '/download' || path === '/download.html';
}

function initCookieConsent() {
    if (shouldSkipCookieConsent()) return;

    // Check if consent already given
    let consent = null;
    try {
        consent = localStorage.getItem('zyrex_cookie_consent');
    } catch(e) {}
    
    // Inject the global cookie consent CSS style
    const style = document.createElement('style');
    style.textContent = `
        .cookie-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 99998;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cookie-backdrop.show {
            opacity: 1;
            pointer-events: auto;
        }
        
        /* Bottom Consent Banner — fixed overlay at viewport bottom, follows scroll */
        .cookie-banner {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: rgba(12, 2, 4, 0.97) !important;
            backdrop-filter: blur(25px) saturate(210%) !important;
            -webkit-backdrop-filter: blur(25px) saturate(210%) !important;
            border: none !important;
            border-top: 1px solid rgba(var(--cherry-rgb), 0.2) !important;
            border-radius: 16px 16px 0 0 !important;
            padding: 20px 28px !important;
            box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(var(--cherry-rgb), 0.1) !important;
            z-index: 99999 !important;
            font-family: inherit;
            color: #fff;
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            box-sizing: border-box;
            margin: 0 !important;
            overflow: visible !important;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }
        .cookie-banner.show {
            opacity: 1;
            pointer-events: auto;
        }
        .cookie-banner.hidden {
            display: none !important;
        }
        .cookie-banner-text {
            flex: 1;
            text-align: left;
        }
        .cookie-banner h3 {
            font-size: 1rem;
            font-weight: 700;
            margin: 0 0 4px 0;
            color: #fff;
        }
        .cookie-banner p {
            font-size: 0.78rem;
            color: #a0a0b0;
            line-height: 1.4;
            margin: 0;
        }
        .cookie-actions {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-shrink: 0;
        }

        /* Customize/Preferences Modal (bottom popup/banner style) */
        .cookie-modal {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translate(-50%, 40px);
            width: 90%;
            max-width: 520px;
            background: rgba(12, 2, 4, 0.95);
            backdrop-filter: blur(25px) saturate(210%);
            -webkit-backdrop-filter: blur(25px) saturate(210%);
            border: 1px solid rgba(var(--cherry-rgb), 0.15);
            border-radius: 16px;
            padding: 24px 28px;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(var(--cherry-rgb), 0.08);
            z-index: 100000;
            font-family: inherit;
            color: #fff;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0;
            pointer-events: none;
            box-sizing: border-box;
        }
        .cookie-modal.show {
            transform: translate(-50%, 0);
            opacity: 1;
            pointer-events: auto;
        }
        .cookie-modal.hidden {
            display: none !important;
        }
        .cookie-modal h4 {
            font-size: 1.1rem;
            font-weight: 700;
            margin: 0 0 10px 0;
            color: #fff;
        }
        .cookie-modal p {
            font-size: 0.8rem;
            color: #a0a0b0;
            line-height: 1.5;
            margin: 0 0 20px 0;
        }

        .btn-cookie-primary {
            background: linear-gradient(180deg, #d61c3c 0%, #7a081e 50%, #4a0310 100%);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 9px 16px;
            border-radius: 8px;
            font-size: 0.78rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .btn-cookie-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(122, 8, 30, 0.4);
        }
        .btn-cookie-secondary {
            background: rgba(255, 255, 255, 0.04);
            color: #e0e0e0;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 9px 16px;
            border-radius: 8px;
            font-size: 0.78rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .btn-cookie-secondary:hover {
            background: rgba(255, 255, 255, 0.08);
        }
        .btn-cookie-link {
            background: transparent;
            color: #a0a0b0;
            border: none;
            font-size: 0.78rem;
            font-weight: 500;
            cursor: pointer;
            padding: 9px 6px;
            text-decoration: underline;
            transition: color 0.2s;
        }
        .btn-cookie-link:hover {
            color: #fff;
        }
        .cookie-customize {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .cookie-option {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            padding: 12px;
            transition: all 0.2s;
        }
        .cookie-option:hover {
            background: rgba(255, 255, 255, 0.04);
        }
        .cookie-option label {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            cursor: pointer;
        }
        .cookie-option input[type="checkbox"] {
            margin-top: 3px;
            accent-color: #7a081e;
            cursor: pointer;
        }
        .cookie-option label span {
            font-size: 0.8rem;
            font-weight: 600;
            color: #fff;
        }
        .cookie-option label small {
            display: block;
            font-weight: 400;
            color: #707080;
            margin-top: 2px;
        }

        .cookie-backdrop,
        .cookie-backdrop.show {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }

        .cookie-banner {
            left: 50% !important;
            right: auto !important;
            bottom: 24px !important;
            width: calc(100% - 48px) !important;
            max-width: 980px !important;
            background: linear-gradient(135deg, rgba(16, 3, 7, 0.92), rgba(7, 8, 14, 0.92)) !important;
            backdrop-filter: blur(22px) saturate(180%) !important;
            -webkit-backdrop-filter: blur(22px) saturate(180%) !important;
            border: 1px solid rgba(255, 255, 255, 0.10) !important;
            border-radius: 14px !important;
            padding: 16px 18px !important;
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55), 0 0 28px rgba(var(--cherry-rgb), 0.12) !important;
            gap: 18px !important;
            transform: translate3d(-50%, 18px, 0) !important;
            transition: opacity 0.28s ease, transform 0.28s ease !important;
        }

        .cookie-banner.show {
            transform: translate3d(-50%, 0, 0) !important;
        }

        .cookie-banner h3 {
            font-size: 0.92rem !important;
        }

        .cookie-banner p {
            line-height: 1.5 !important;
        }
        
        @media (max-width: 768px) {
            .cookie-banner {
                flex-direction: column !important;
                align-items: stretch !important;
                bottom: 14px !important;
                width: calc(100% - 28px) !important;
                padding: 14px !important;
                gap: 14px !important;
                border-radius: 12px !important;
            }
            .cookie-actions {
                justify-content: stretch;
                flex-wrap: wrap;
            }
            .cookie-actions > * {
                flex: 1 1 auto;
                text-align: center;
            }
        }
    `;
    document.head.appendChild(style);

    // Inject Cookie Consent Banner HTML + Backdrop overlay
    const backdrop = document.createElement('div');
    backdrop.id = 'cookieBackdrop';
    backdrop.className = 'cookie-backdrop';
    document.body.appendChild(backdrop);

    const banner = document.createElement('div');
    banner.id = 'cookieConsentBanner';
    banner.className = 'cookie-banner hidden';
    banner.innerHTML = `
        <div class="cookie-banner-text">
            <h3>Privacy choices</h3>
            <p>Essential cookies keep login and downloads working. Optional cookies help us improve the site experience.</p>
        </div>
        <div class="cookie-actions">
            <button id="acceptAllCookies" class="btn-cookie-primary">Accept</button>
            <button id="declineCookies" class="btn-cookie-secondary">Decline</button>
            <a href="/settings?tab=general" class="btn-cookie-link" style="text-decoration: underline; padding: 9px 12px;">Settings</a>
        </div>
    `;
    document.body.appendChild(banner);

    // Add Action Event Listeners
    document.getElementById('acceptAllCookies').onclick = () => saveConsent(true, true);
    document.getElementById('declineCookies').onclick = () => saveConsent(false, false);

    // Show popup after short delay if no preference saved
    if (!consent) {
        setTimeout(() => {
            backdrop.classList.add('show');
            banner.classList.remove('hidden');
            setTimeout(() => {
                banner.classList.add('show');
            }, 100);
        }, 1500);
    }

    // Try injecting the Cookie Preferences link in the footer
    injectCookiePreferencesLink();
}

function saveConsent(analytics, personalization) {
    const preferences = {
        essential: true,
        analytics: analytics,
        personalization: personalization,
        timestamp: Date.now()
    };
    try {
        localStorage.setItem('zyrex_cookie_consent', JSON.stringify(preferences));
    } catch(e) {}
    
    const banner = document.getElementById('cookieConsentBanner');
    const backdrop = document.getElementById('cookieBackdrop');
    if (banner) {
        banner.classList.remove('show');
        setTimeout(() => banner.classList.add('hidden'), 400);
    }
    if (backdrop) {
        backdrop.classList.remove('show');
    }
}

function openCookieSettings() {
    window.location.href = '/settings?tab=general';
}

function injectCookiePreferencesLink() {
    const footerBottom = document.querySelector('.footer-bottom');
    if (footerBottom) {
        const p = footerBottom.querySelector('p');
        if (p && !document.getElementById('cookiePrefFooterLink')) {
            const separator = document.createTextNode(' | ');
            const a = document.createElement('a');
            a.id = 'cookiePrefFooterLink';
            a.href = '#';
            a.textContent = 'Cookie Preferences';
            a.style.color = '#707080';
            a.style.textDecoration = 'underline';
            a.style.marginLeft = '5px';
            a.style.fontSize = '0.8rem';
            a.style.cursor = 'pointer';
            a.onclick = (e) => {
                e.preventDefault();
                openCookieSettings();
            };
            p.appendChild(separator);
            p.appendChild(a);
        }
    }
}
