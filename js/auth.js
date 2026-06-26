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
                    ${avatarUrl ? `<img src="${avatarUrl}" alt="" style="width:32px;height:32px;border-radius:50%;border:2px solid rgba(220,20,60,.3)">` : ''}
                    <span style="font-size:.82rem;font-weight:500;color:#fff">${user.global_name || user.username}</span>
                    ${user.is_admin ? '<span style="font-size:.55rem;padding:1px 5px;border-radius:4px;background:rgba(220,20,60,.15);color:#ff4d6d;font-weight:700">ADMIN</span>' : ''}
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
    btn.innerHTML = `<a href="/api/login" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;background:rgba(220,20,60,.15);color:#ff4d6d;text-decoration:none;font-size:.8rem;font-weight:600;transition:all .3s" onmouseover="this.style.background='rgba(220,20,60,.25)'" onmouseout="this.style.background='rgba(220,20,60,.15)'"><i class="fab fa-discord"></i> Login</a>`;
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

document.addEventListener('DOMContentLoaded', checkAuth);
