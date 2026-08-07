
/* ===================== ZYREX SECURE API FETCH INTERCEPTOR ===================== */
(function() {
    window.ZYREX_API_KEY = "zyrex_app_sec_k982f81a7b54c29013e9a";
    var origFetch = window.fetch;
    if (origFetch) {
        window.fetch = function(input, init) {
            init = init || {};
            var urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
            if (urlStr && (urlStr.indexOf('/api/') !== -1 || urlStr.startsWith('/api/'))) {
                init.headers = init.headers || {};
                if (typeof Headers !== 'undefined' && init.headers instanceof Headers) {
                    init.headers.set('X-Zyrex-Key', window.ZYREX_API_KEY);
                    init.headers.set('X-API-Key', window.ZYREX_API_KEY);
                } else if (Array.isArray(init.headers)) {
                    init.headers.push(['X-Zyrex-Key', window.ZYREX_API_KEY]);
                    init.headers.push(['X-API-Key', window.ZYREX_API_KEY]);
                } else {
                    init.headers['X-Zyrex-Key'] = window.ZYREX_API_KEY;
                    init.headers['X-API-Key'] = window.ZYREX_API_KEY;
                }
            }
            
            var p = origFetch.call(this, input, init);
            if (urlStr && urlStr.indexOf('/api/products') !== -1 && (!init.method || init.method.toUpperCase() === 'GET')) {
                return p.then(function(response) {
                    if (!response.ok) return response;
                    var clone = response.clone();
                    return clone.json().then(function(jsonObj) {
                        try {
                            var editedKey = 'zyrex_edited_products';
                            var editedMap = JSON.parse(localStorage.getItem(editedKey) || '{}');
                            if (Object.keys(editedMap).length > 0) {
                                if (Array.isArray(jsonObj)) {
                                    jsonObj = jsonObj.map(function(item) {
                                        return (item && item.id && editedMap[item.id]) ? Object.assign({}, item, editedMap[item.id]) : item;
                                    });
                                } else if (jsonObj && jsonObj.id && editedMap[jsonObj.id]) {
                                    jsonObj = Object.assign({}, jsonObj, editedMap[jsonObj.id]);
                                }
                            }
                        } catch(e) {}
                        return new Response(JSON.stringify(jsonObj), {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    }).catch(function() { return response; });
                });
            }
            return p;
        };
    }
})();

var AUTH_USER_CACHE_KEY = 'zyrex_auth_user';
var AUTH_USER_CACHE_TTL = 10 * 60 * 1000;

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
    btn.innerHTML = '<button type="button" onclick="openLoginModal()" class="auth-login-btn"><i class="fab fa-discord"></i><span>Login</span></button>';
}

function openLoginModal() {
    var modal = document.getElementById('loginModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'loginModal';
        modal.className = 'login-modal-overlay';
        modal.innerHTML = 
            '<div class="login-modal-card">' +
                '<button type="button" class="login-modal-close" onclick="closeLoginModal()">&times;</button>' +
                '<img src="/assets/content.png" alt="Zyrex" class="login-modal-logo">' +
                '<h2>Welcome to Zyrex</h2>' +
                '<p>Sign in with Discord to access premium presets, plugins, and cloud downloads.</p>' +
                '<a href="/api/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search) + '" class="login-discord-btn">' +
                    '<i class="fab fa-discord"></i> Login with Discord' +
                '</a>' +
            '</div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeLoginModal();
        });
    }
    setTimeout(function(){ modal.classList.add('active'); }, 10);
}

function closeLoginModal() {
    var modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function redirectToLogin(returnTo) {
    clearAuthCache();
    openLoginModal();
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
            '<a href="/bookmarks" class="auth-menu-link"><i class="fas fa-bookmark"></i><span>Bookmarks</span></a>' +
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
        /* Bottom Consent Banner — fixed overlay at viewport bottom, safe-area aware, non-blocking page scroll */
        .cookie-banner {
            position: fixed !important;
            bottom: max(16px, env(safe-area-inset-bottom, 16px)) !important;
            left: 50% !important;
            right: auto !important;
            transform: translate(-50%, 20px) !important;
            width: calc(100% - 32px) !important;
            max-width: 880px !important;
            background: linear-gradient(135deg, rgba(16, 8, 20, 0.96), rgba(8, 6, 12, 0.96)) !important;
            backdrop-filter: blur(24px) saturate(200%) !important;
            -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
            border: 1px solid rgba(255, 43, 82, 0.28) !important;
            border-radius: 16px !important;
            padding: 16px 22px !important;
            box-shadow: 0 16px 45px rgba(0, 0, 0, 0.65), 0 0 30px rgba(255, 43, 82, 0.12) !important;
            z-index: 999999 !important;
            font-family: inherit;
            color: #fff;
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            box-sizing: border-box;
            margin: 0 !important;
            opacity: 0;
            visibility: hidden;
            pointer-events: none !important;
            transition: opacity 0.35s ease, transform 0.35s ease, visibility 0.35s ease !important;
        }
        .cookie-banner.show {
            opacity: 1 !important;
            visibility: visible !important;
            transform: translate(-50%, 0) !important;
            pointer-events: auto !important;
        }
        .cookie-banner.hidden {
            display: none !important;
        }
        .cookie-banner-text {
            flex: 1;
            text-align: left;
        }
        .cookie-banner h3 {
            font-size: 0.95rem;
            font-weight: 700;
            margin: 0 0 4px 0;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 8px;
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

        .btn-cookie-primary {
            background: linear-gradient(135deg, #ff2b52 0%, #b81432 100%);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.15);
            padding: 9px 18px;
            border-radius: 10px;
            font-size: 0.80rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 14px rgba(255, 43, 82, 0.3);
        }
        .btn-cookie-primary:hover,
        .btn-cookie-primary:active {
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(255, 43, 82, 0.45);
        }
        .btn-cookie-secondary {
            background: rgba(255, 255, 255, 0.06);
            color: #e0e0e0;
            border: 1px solid rgba(255, 255, 255, 0.12);
            padding: 9px 16px;
            border-radius: 10px;
            font-size: 0.80rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .btn-cookie-secondary:hover,
        .btn-cookie-secondary:active {
            background: rgba(255, 255, 255, 0.12);
        }
        .btn-cookie-link {
            background: transparent;
            color: #a0a0b0;
            border: none;
            font-size: 0.78rem;
            font-weight: 500;
            cursor: pointer;
            padding: 9px 10px;
            text-decoration: underline;
            transition: color 0.2s;
        }
        .btn-cookie-link:hover {
            color: #fff;
        }

        @media (max-width: 768px) {
            .cookie-banner {
                flex-direction: column !important;
                align-items: stretch !important;
                bottom: max(12px, env(safe-area-inset-bottom, 12px)) !important;
                width: calc(100% - 24px) !important;
                padding: 14px 16px !important;
                gap: 12px !important;
                border-radius: 14px !important;
            }
            .cookie-banner h3 {
                font-size: 0.90rem !important;
            }
            .cookie-banner p {
                font-size: 0.75rem !important;
                line-height: 1.35 !important;
            }
            .cookie-actions {
                display: flex !important;
                flex-direction: row !important;
                gap: 8px !important;
                width: 100% !important;
            }
            .cookie-actions > * {
                flex: 1 1 0px !important;
                text-align: center !important;
                padding: 8px 6px !important;
                font-size: 0.76rem !important;
                white-space: nowrap !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
        }
    `;
    document.head.appendChild(style);

    // Inject Cookie Consent Banner HTML
    const banner = document.createElement('div');
    banner.id = 'cookieConsentBanner';
    banner.className = 'cookie-banner hidden';
    banner.innerHTML = `
        <div class="cookie-banner-text">
            <h3><i class="fas fa-cookie-bite" style="color:var(--bordeaux-vivid,#ff2b52)"></i> Privacy Choices</h3>
            <p>We use essential cookies to power login & downloads, and optional cookies to enhance your Zyrex experience.</p>
        </div>
        <div class="cookie-actions">
            <button id="acceptAllCookies" class="btn-cookie-primary">Accept All</button>
            <button id="declineCookies" class="btn-cookie-secondary">Essential Only</button>
            <a href="/settings?tab=general" class="btn-cookie-link">Settings</a>
        </div>
    `;
    document.body.appendChild(banner);

    // Add Action Event Listeners
    document.getElementById('acceptAllCookies').onclick = () => saveConsent(true, true);
    document.getElementById('declineCookies').onclick = () => saveConsent(false, false);

    // Show banner after short delay if no preference saved
    if (!consent) {
        setTimeout(() => {
            banner.classList.remove('hidden');
            requestAnimationFrame(() => {
                banner.classList.add('show');
            });
        }, 1200);
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
