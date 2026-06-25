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
                <div class="auth-user" style="display:flex;align-items:center;gap:8px">
                    ${avatarUrl ? `<img src="${avatarUrl}" alt="" style="width:32px;height:32px;border-radius:50%;border:2px solid rgba(220,20,60,.3)">` : ''}
                    <span style="font-size:.82rem;font-weight:500;color:#fff">${user.global_name || user.username}</span>
                    ${user.can_upload ? `<a href="/admin" style="font-size:.7rem;color:#dc143c;text-decoration:none;font-weight:600"><i class="fas fa-cog"></i></a>` : ''}
                </div>
            `;
            return;
        }
    } catch(e) {
        console.log('Auth API unavailable, showing invite link');
    }
    
    // Fallback: show Discord invite
    btn.innerHTML = `<a href="https://discord.gg/fAydSzpafA" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;background:rgba(88,101,242,.15);color:#8b9aff;text-decoration:none;font-size:.8rem;font-weight:600;transition:all .3s"><i class="fab fa-discord"></i> Join</a>`;
}

document.addEventListener('DOMContentLoaded', checkAuth);
