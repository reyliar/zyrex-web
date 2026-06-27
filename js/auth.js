/* ===================== DISCORD AUTH BUTTON ===================== */
// Tries API first, falls back to Discord invite

async function checkAuth() {
    const btn = document.getElementById('authBtn');
    if (!btn) return;

    try {
        const resp = await fetch('/api/me', { credentials: 'include' });
        if (resp.ok) {
            const user = await resp.json();
            const avatarUrl = user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
                : '';

            btn.innerHTML = `
                <div class="auth-user" style="position:relative;display:flex;align-items:center;gap:8px;cursor:pointer" onclick="toggleUserMenu()">
                    ${avatarUrl ? `<img src="${avatarUrl}" alt="" style="width:32px;height:32px;border-radius:50%;border:2px solid rgba(122, 8, 30,.3)">` : ''}
                    <span style="font-size:.82rem;font-weight:500;color:#fff">${user.global_name || user.username}</span>
                    ${user.is_admin ? '<span style="font-size:.55rem;padding:1px 5px;border-radius:4px;background:rgba(122, 8, 30,.15);color:#f53d5c;font-weight:700">ADMIN</span>' : ''}
                </div>
                <div id="userMenu" style="display:none;position:absolute;top:100%;right:0;margin-top:8px;background:#121216;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:6px;min-width:180px;z-index:9999;box-shadow:0 10px 40px rgba(0,0,0,.5)">
                    <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.04);margin-bottom:4px">
                        <div style="font-size:.85rem;font-weight:600">${user.global_name || user.username}</div>
                        <div style="font-size:.7rem;color:#606070">@${user.username}</div>
                    </div>
                    <a href="/settings" style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:6px;color:#9090a0;text-decoration:none;font-size:.8rem;transition:all .2s" onmouseover="this.style.background='rgba(255,255,255,.04)'" onmouseout="this.style.background='transparent'"><i class="fas fa-cog" style="width:16px;text-align:center"></i> Settings</a>
                    ${(user.can_upload || user.is_admin) ? `<a href="/upload" style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:6px;color:#9090a0;text-decoration:none;font-size:.8rem;transition:all .2s" onmouseover="this.style.background='rgba(255,255,255,.04)'" onmouseout="this.style.background='transparent'"><i class="fas fa-cloud-upload-alt" style="width:16px;text-align:center"></i> Upload</a>` : ''}
                    <a href="/api/logout" style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:6px;color:#9090a0;text-decoration:none;font-size:.8rem;transition:all .2s" onmouseover="this.style.background='rgba(255,255,255,.04)'" onmouseout="this.style.background='transparent'"><i class="fas fa-sign-out-alt" style="width:16px;text-align:center"></i> Logout</a>
                </div>
            `;
            return;
        }
    } catch(e) {
        console.log('Auth API unavailable, showing invite link');
    }
    
    // Fallback: show Discord Login button
    btn.innerHTML = `<a href="/api/login" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;background:rgba(122, 8, 30,.15);color:#f53d5c;text-decoration:none;font-size:.8rem;font-weight:600;transition:all .3s" onmouseover="this.style.background='rgba(122, 8, 30,.25)'" onmouseout="this.style.background='rgba(122, 8, 30,.15)'"><i class="fab fa-discord"></i> Login</a>`;
}

function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('userMenu');
    const btn = document.getElementById('authBtn');
    if (menu && btn && !btn.contains(e.target)) {
        menu.style.display = 'none';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initCookieConsent();
});

/* ===================== COOKIES CONSENT SYSTEM ===================== */

function initCookieConsent() {
    // Check if consent already given
    const consent = localStorage.getItem('zyrex_cookie_consent');
    
    // Inject the global cookie consent CSS style
    const style = document.createElement('style');
    style.textContent = `
        .cookie-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 99999;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cookie-backdrop.show {
            opacity: 1;
            pointer-events: auto;
        }
        .cookie-banner {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.92);
            width: 90%;
            max-width: 480px;
            background: rgba(12, 2, 4, 0.85);
            backdrop-filter: blur(30px) saturate(220%);
            -webkit-backdrop-filter: blur(30px) saturate(220%);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            padding: 32px;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75), 0 0 40px rgba(122, 8, 30, 0.15);
            z-index: 100000;
            font-family: inherit;
            color: #fff;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0;
            pointer-events: none;
            box-sizing: border-box;
        }
        .cookie-banner *, .cookie-banner *::before, .cookie-banner *::after {
            box-sizing: border-box;
        }
        .cookie-banner.show {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
            pointer-events: auto;
        }
        .cookie-banner.hidden {
            display: none !important;
        }
        .cookie-banner h3 {
            font-size: 1.15rem;
            font-weight: 700;
            margin: 0 0 8px 0;
            color: #fff;
        }
        .cookie-banner h4 {
            font-size: 1.05rem;
            font-weight: 600;
            margin: 0 0 12px 0;
            color: #fff;
        }
        .cookie-banner p {
            font-size: 0.82rem;
            color: #a0a0b0;
            line-height: 1.5;
            margin: 0 0 20px 0;
        }
        .cookie-actions {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        .btn-cookie-primary {
            background: linear-gradient(180deg, #d61c3c 0%, #7a081e 50%, #4a0310 100%);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .btn-cookie-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(122, 8, 30, 0.4);
        }
        .btn-cookie-secondary {
            background: rgba(255, 255, 255, 0.04);
            color: #e0e0e0;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 0.8rem;
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
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            padding: 10px 8px;
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
            font-size: 0.82rem;
            font-weight: 600;
            color: #fff;
        }
        .cookie-option label small {
            display: block;
            font-weight: 400;
            color: #707080;
            margin-top: 2px;
        }
        @media (max-width: 480px) {
            .cookie-banner {
                width: calc(100% - 30px);
                padding: 20px;
            }
        }
    `;
    document.head.appendChild(style);

    // Inject Cookie Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'cookieConsentBackdrop';
    backdrop.className = 'cookie-backdrop';
    document.body.appendChild(backdrop);

    // Inject Cookie Consent Banner HTML
    const banner = document.createElement('div');
    banner.id = 'cookieConsentBanner';
    banner.className = 'cookie-banner hidden';
    banner.innerHTML = `
        <div id="cookieMainContent" class="cookie-content">
            <h3>Cookie Preferences 🍪</h3>
            <p>We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. Please choose your preferences below.</p>
            <div class="cookie-actions">
                <button id="acceptAllCookies" class="btn-cookie-primary">Accept All</button>
                <button id="declineCookies" class="btn-cookie-secondary">Decline</button>
                <button id="customizeCookies" class="btn-cookie-link">Customize</button>
            </div>
        </div>
        <div id="cookieCustomizeContent" class="cookie-customize hidden">
            <h4>Customize Preferences</h4>
            <div class="cookie-option">
                <label>
                    <input type="checkbox" id="cookieEssential" checked disabled>
                    <span>Essential Cookies <small>(Required for login session and core operations)</small></span>
                </label>
            </div>
            <div class="cookie-option">
                <label>
                    <input type="checkbox" id="cookieAnalytics" checked>
                    <span>Analytical Cookies <small>(Helps us improve performance and site structures)</small></span>
                </label>
            </div>
            <div class="cookie-option">
                <label>
                    <input type="checkbox" id="cookiePersonalization" checked>
                    <span>Personalization Cookies <small>(Retains custom choices like themes and preferences)</small></span>
                </label>
            </div>
            <div class="cookie-actions" style="margin-top:10px">
                <button id="saveCookiePreferences" class="btn-cookie-primary">Save Preferences</button>
                <button id="backCookieBanner" class="btn-cookie-secondary">Back</button>
            </div>
        </div>
    `;
    document.body.appendChild(banner);

    // Add Action Event Listeners
    document.getElementById('acceptAllCookies').onclick = () => saveConsent(true, true);
    document.getElementById('declineCookies').onclick = () => saveConsent(false, false);
    
    document.getElementById('customizeCookies').onclick = () => {
        document.getElementById('cookieMainContent').classList.add('hidden');
        document.getElementById('cookieCustomizeContent').classList.remove('hidden');
    };

    document.getElementById('backCookieBanner').onclick = () => {
        document.getElementById('cookieCustomizeContent').classList.add('hidden');
        document.getElementById('cookieMainContent').classList.remove('hidden');
    };

    document.getElementById('saveCookiePreferences').onclick = () => {
        const analytics = document.getElementById('cookieAnalytics').checked;
        const personalization = document.getElementById('cookiePersonalization').checked;
        saveConsent(analytics, personalization);
    };

    // Show popup after short delay if no preference saved
    if (!consent) {
        setTimeout(() => {
            banner.classList.remove('hidden');
            setTimeout(() => {
                banner.classList.add('show');
                backdrop.classList.add('show');
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
    localStorage.setItem('zyrex_cookie_consent', JSON.stringify(preferences));
    
    const banner = document.getElementById('cookieConsentBanner');
    const backdrop = document.getElementById('cookieConsentBackdrop');
    if (banner) {
        banner.classList.remove('show');
        if (backdrop) backdrop.classList.remove('show');
        setTimeout(() => banner.classList.add('hidden'), 400);
    }
}

function openCookieSettings() {
    const banner = document.getElementById('cookieConsentBanner');
    const backdrop = document.getElementById('cookieConsentBackdrop');
    if (!banner) return;

    // Load saved preferences if available
    const saved = localStorage.getItem('zyrex_cookie_consent');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            document.getElementById('cookieAnalytics').checked = !!parsed.analytics;
            document.getElementById('cookiePersonalization').checked = !!parsed.personalization;
        } catch(e) {}
    }

    // Reset view to customize
    document.getElementById('cookieMainContent').classList.add('hidden');
    document.getElementById('cookieCustomizeContent').classList.remove('hidden');
    
    banner.classList.remove('hidden');
    setTimeout(() => {
        banner.classList.add('show');
        if (backdrop) backdrop.classList.add('show');
    }, 100);
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
