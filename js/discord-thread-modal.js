/**
 * Zyrex Discord Live Thread Drawer / Modal
 * Real-time Discord thread viewer and chat integration for Zyrex requests.
 */

(function () {
    let currentRequestId = null;
    let currentThreadData = null;
    let pollInterval = null;
    let isSending = false;
    let lastMessageCount = 0;

    // Inject styles for the Discord Drawer
    function injectStyles() {
        if (document.getElementById('zyrex-discord-drawer-styles')) return;

        const style = document.createElement('style');
        style.id = 'zyrex-discord-drawer-styles';
        style.textContent = `
            .zdc-drawer-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.72);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                z-index: 200000;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .zdc-drawer-overlay.active {
                opacity: 1;
                pointer-events: auto;
            }

            .zdc-drawer {
                position: fixed;
                top: 0;
                right: -520px;
                width: 500px;
                max-width: 100vw;
                height: 100vh;
                background: #313338;
                box-shadow: -10px 0 40px rgba(0, 0, 0, 0.6);
                z-index: 200001;
                display: flex;
                flex-direction: column;
                transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #dbdee1;
                overflow: hidden;
            }
            .zdc-drawer.active {
                transform: translateX(-520px);
            }

            /* Hide floating notification bell & scroll-to-top buttons while drawer is open */
            body.zdc-drawer-open .global-floating-hub,
            body.zdc-drawer-open #globalFloatingHub {
                z-index: 9000 !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
            }
            @media (max-width: 600px) {
                .zdc-drawer {
                    width: 100vw;
                    right: -100vw;
                }
                .zdc-drawer.active {
                    transform: translateX(-100vw);
                }
            }

            /* Header */
            .zdc-header {
                height: 58px;
                background: #2b2d31;
                border-bottom: 1px solid rgba(255, 255, 255, 0.07);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 18px;
                flex-shrink: 0;
            }
            .zdc-header-title-box {
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 0;
            }
            .zdc-thread-icon {
                color: #80848e;
                font-size: 1.15rem;
                flex-shrink: 0;
            }
            .zdc-header-text {
                min-width: 0;
            }
            .zdc-header-title {
                color: #f2f3f5;
                font-weight: 700;
                font-size: 0.96rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .zdc-header-sub {
                font-size: 0.76rem;
                color: #949ba4;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .zdc-header-sub .zdc-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #23a55a;
                display: inline-block;
            }
            .zdc-header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }
            .zdc-btn-icon {
                background: transparent;
                border: none;
                color: #b5bac1;
                width: 34px;
                height: 34px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.18s ease;
                text-decoration: none;
            }
            .zdc-btn-icon:hover {
                background: rgba(255, 255, 255, 0.08);
                color: #f2f3f5;
            }
            .zdc-btn-discord-external {
                background: rgba(88, 101, 242, 0.18);
                color: #8ea1e1;
                font-size: 0.8rem;
                font-weight: 600;
                padding: 6px 12px;
                border-radius: 6px;
                border: 1px solid rgba(88, 101, 242, 0.35);
                display: inline-flex;
                align-items: center;
                gap: 6px;
                text-decoration: none;
                transition: all 0.2s;
            }
            .zdc-btn-discord-external:hover {
                background: #5865f2;
                color: #fff;
                border-color: #5865f2;
            }

            /* Body / Message Area */
            .zdc-body {
                flex: 1;
                overflow-y: auto;
                padding: 16px 18px;
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .zdc-body::-webkit-scrollbar {
                width: 7px;
            }
            .zdc-body::-webkit-scrollbar-track {
                background: #2b2d31;
            }
            .zdc-body::-webkit-scrollbar-thumb {
                background: #1a1b1e;
                border-radius: 4px;
            }

            /* Thread starter banner */
            .zdc-starter-card {
                background: #2b2d31;
                border: 1px solid rgba(255, 255, 255, 0.07);
                border-left: 4px solid #5865f2;
                border-radius: 8px;
                padding: 14px 16px;
                margin-bottom: 8px;
            }
            .zdc-starter-tag {
                font-size: 0.72rem;
                font-weight: 700;
                color: #5865f2;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 6px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .zdc-starter-title {
                color: #f2f3f5;
                font-weight: 700;
                font-size: 1.05rem;
                margin-bottom: 6px;
            }
            .zdc-starter-desc {
                color: #b5bac1;
                font-size: 0.85rem;
                line-height: 1.45;
                white-space: pre-wrap;
                word-break: break-word;
            }

            /* Message item */
            .zdc-msg {
                display: flex;
                gap: 13px;
                padding: 3px 6px;
                border-radius: 6px;
                transition: background 0.12s ease;
                min-width: 0;
            }
            .zdc-msg:hover {
                background: rgba(2, 2, 2, 0.14);
            }
            .zdc-avatar-box {
                flex-shrink: 0;
                width: 40px;
                height: 40px;
            }
            .zdc-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
                background: #1e1f22;
            }
            .zdc-msg-content-box {
                flex: 1;
                min-width: 0;
            }
            .zdc-msg-meta {
                display: flex;
                align-items: baseline;
                gap: 7px;
                margin-bottom: 3px;
            }
            .zdc-msg-author {
                font-weight: 600;
                font-size: 0.92rem;
                color: #f2f3f5;
                cursor: pointer;
            }
            .zdc-msg-author:hover {
                text-decoration: underline;
            }
            .zdc-badge-bot {
                background: #5865f2;
                color: #fff;
                font-size: 0.62rem;
                font-weight: 800;
                border-radius: 3px;
                padding: 1px 4px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                line-height: 1.1;
                display: inline-flex;
                align-items: center;
                gap: 2px;
            }
            .zdc-badge-webhook {
                background: #3ba55d;
                color: #fff;
                font-size: 0.62rem;
                font-weight: 800;
                border-radius: 3px;
                padding: 1px 4px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                line-height: 1.1;
            }
            .zdc-msg-time {
                font-size: 0.72rem;
                color: #949ba4;
                white-space: nowrap;
            }
            .zdc-msg-text {
                font-size: 0.88rem;
                line-height: 1.45;
                color: #dbdee1;
                word-break: break-word;
                white-space: pre-wrap;
            }
            .zdc-msg-text strong {
                color: #fff;
                font-weight: 700;
            }
            .zdc-msg-text a {
                color: #00a8fc;
                text-decoration: none;
            }
            .zdc-msg-text a:hover {
                text-decoration: underline;
            }
            .zdc-msg-text code {
                background: #1e1f22;
                padding: 2px 5px;
                border-radius: 4px;
                font-size: 0.82rem;
                color: #e3e5e8;
            }
            .zdc-mention {
                background: rgba(88, 101, 242, 0.28);
                color: #c9cdfb;
                padding: 1px 4px;
                border-radius: 4px;
                font-weight: 500;
            }

            /* Attachment Preview */
            .zdc-attachments {
                display: flex;
                flex-direction: column;
                gap: 6px;
                margin-top: 6px;
            }
            .zdc-attachment-img {
                max-width: 320px;
                max-height: 240px;
                border-radius: 6px;
                object-fit: cover;
                border: 1px solid rgba(255, 255, 255, 0.08);
                cursor: pointer;
            }

            /* Empty / Loading State */
            .zdc-empty-state {
                text-align: center;
                padding: 40px 20px;
                color: #949ba4;
            }
            .zdc-empty-state i {
                font-size: 2.2rem;
                color: #5865f2;
                margin-bottom: 12px;
                display: block;
            }
            .zdc-empty-state h4 {
                color: #f2f3f5;
                font-size: 1rem;
                margin-bottom: 6px;
            }
            .zdc-empty-state p {
                font-size: 0.82rem;
                line-height: 1.4;
            }

            /* Input Footer */
            .zdc-footer {
                background: #313338;
                padding: 12px 18px 16px 18px;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
                flex-shrink: 0;
            }
            .zdc-input-container {
                background: #383a40;
                border-radius: 10px;
                padding: 4px 8px 4px 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                border: 1px solid transparent;
                transition: border-color 0.2s;
            }
            .zdc-input-container:focus-within {
                border-color: rgba(88, 101, 242, 0.6);
            }
            .zdc-textarea {
                flex: 1;
                background: transparent;
                border: none;
                color: #dbdee1;
                font-family: inherit;
                font-size: 0.9rem;
                resize: none;
                outline: none;
                height: 40px;
                padding: 9px 0;
                line-height: 1.35;
            }
            .zdc-textarea::placeholder {
                color: #80848e;
            }
            .zdc-send-btn {
                background: #5865f2;
                color: #fff;
                border: none;
                width: 36px;
                height: 36px;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                flex-shrink: 0;
            }
            .zdc-send-btn:hover:not(:disabled) {
                background: #4752c4;
                transform: scale(1.05);
            }
            .zdc-send-btn:disabled {
                background: rgba(255, 255, 255, 0.08);
                color: #6d6f78;
                cursor: not-allowed;
            }

            /* Session preview footer hint */
            .zdc-footer-hint {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-top: 8px;
                padding: 0 4px;
                font-size: 0.72rem;
                color: #949ba4;
            }
            .zdc-user-pill {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .zdc-user-pill-avatar {
                width: 17px;
                height: 17px;
                border-radius: 50%;
            }

            /* Guest Login Banner */
            .zdc-guest-banner {
                background: #2b2d31;
                border-radius: 10px;
                padding: 12px 14px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                border: 1px solid rgba(88, 101, 242, 0.25);
            }
            .zdc-guest-banner-text {
                font-size: 0.8rem;
                color: #dbdee1;
            }
            .zdc-guest-login-btn {
                background: #5865f2;
                color: #fff;
                font-weight: 700;
                font-size: 0.8rem;
                border: none;
                border-radius: 6px;
                padding: 7px 14px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: background 0.2s;
                text-decoration: none;
                flex-shrink: 0;
            }
            .zdc-guest-login-btn:hover {
                background: #4752c4;
            }
        `;
        document.head.appendChild(style);
    }

    // Render Drawer HTML into DOM
    function ensureDrawerDOM() {
        injectStyles();
        if (document.getElementById('zyrex-discord-drawer')) return;

        const overlay = document.createElement('div');
        overlay.id = 'zyrex-discord-overlay';
        overlay.className = 'zdc-drawer-overlay';
        overlay.onclick = () => window.closeDiscordThreadDrawer();

        const drawer = document.createElement('div');
        drawer.id = 'zyrex-discord-drawer';
        drawer.className = 'zdc-drawer';

        drawer.innerHTML = `
            <div class="zdc-header">
                <div class="zdc-header-title-box">
                    <i class="fas fa-hashtag zdc-thread-icon"></i>
                    <div class="zdc-header-text">
                        <div class="zdc-header-title" id="zdc-thread-title">Request Thread</div>
                        <div class="zdc-header-sub">
                            <span class="zdc-dot"></span>
                            <span id="zdc-thread-status">Connecting to Discord...</span>
                        </div>
                    </div>
                </div>
                <div class="zdc-header-actions">
                    <a href="#" target="_blank" rel="noopener" id="zdc-external-link" class="zdc-btn-discord-external" title="Open Thread in Discord">
                        <i class="fab fa-discord"></i>
                        <span>Discord</span>
                    </a>
                    <button class="zdc-btn-icon" onclick="window.refreshDiscordThreadMessages()" title="Refresh messages">
                        <i class="fas fa-sync-alt" id="zdc-refresh-icon"></i>
                    </button>
                    <button class="zdc-btn-icon" onclick="window.closeDiscordThreadDrawer()" title="Close drawer">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <div class="zdc-body" id="zdc-messages-body">
                <div class="zdc-empty-state">
                    <i class="fab fa-discord"></i>
                    <h4>Loading Discord Thread...</h4>
                    <p>Fetching real-time messages from Zyrex Discord server</p>
                </div>
            </div>

            <div class="zdc-footer" id="zdc-footer-container">
                <!-- Populated dynamically based on session -->
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(drawer);

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawer.classList.contains('active')) {
                window.closeDiscordThreadDrawer();
            }
        });
    }

    // Get current user session
    function getCurrentUser() {
        let u = window._currentUser || window.currentUser;
        if (!u) {
            try {
                const raw = localStorage.getItem('zyrex_auth_user');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    u = parsed?.data || parsed;
                }
            } catch (e) {}
        }
        return u;
    }

    // Simple Discord Markdown Parser
    function parseDiscordMarkdown(text) {
        if (!text) return '';
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Mentions <@12345>
        escaped = escaped.replace(/&lt;@!?(\d+)&gt;/g, '<span class="zdc-mention">@user</span>');

        // Bold **text**
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic *text*
        escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Inline code `code`
        escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

        // URL linkify
        escaped = escaped.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );

        return escaped;
    }

    // Format Discord timestamp
    function formatDiscordTime(isoString) {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';

        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();

        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (isToday) {
            return `Today at ${timeStr}`;
        }

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) {
            return `Yesterday at ${timeStr}`;
        }

        return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    }

    // Render footer (input box or login prompt)
    function renderFooter() {
        const container = document.getElementById('zdc-footer-container');
        if (!container) return;

        const user = getCurrentUser();

        if (user && (user.id || user.userId || user.username)) {
            const displayName = user.global_name || user.username || 'Zyrex Member';
            let avatarUrl = '/assets/content.png';
            if (user.avatar) {
                const uid = user.id || user.userId;
                const ext = String(user.avatar).startsWith('a_') ? 'gif' : 'png';
                avatarUrl = `https://cdn.discordapp.com/avatars/${uid}/${user.avatar}.${ext}?size=64`;
            }

            container.innerHTML = `
                <div class="zdc-input-container">
                    <textarea 
                        id="zdc-message-input" 
                        class="zdc-textarea" 
                        placeholder="Message in #${escapeHtml(currentThreadData?.request_title || 'thread')}..." 
                        rows="1"
                        maxlength="2000"
                    ></textarea>
                    <button id="zdc-send-btn" class="zdc-send-btn" onclick="window.sendDiscordThreadMessage()" title="Send Message (Enter)">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="zdc-footer-hint">
                    <div class="zdc-user-pill">
                        <img src="${avatarUrl}" class="zdc-user-pill-avatar" alt="Avatar" onerror="this.src='/assets/content.png'">
                        <span>Posting as <strong>${escapeHtml(displayName)}</strong></span>
                    </div>
                    <span>Press <strong>Enter</strong> to send</span>
                </div>
            `;

            const input = document.getElementById('zdc-message-input');
            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        window.sendDiscordThreadMessage();
                    }
                });
                // Auto-expand
                input.addEventListener('input', () => {
                    input.style.height = 'auto';
                    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
                });
            }
        } else {
            container.innerHTML = `
                <div class="zdc-guest-banner">
                    <div class="zdc-guest-banner-text">
                        <strong>Log in with Discord</strong> to send live messages to this thread.
                    </div>
                    <button class="zdc-guest-login-btn" onclick="window.handleDiscordDrawerLogin()">
                        <i class="fab fa-discord"></i> Login
                    </button>
                </div>
            `;
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Open Discord Thread Drawer
    window.openDiscordThreadDrawer = async function (requestId, fallbackTitle) {
        ensureDrawerDOM();
        currentRequestId = requestId;
        currentThreadData = null;
        lastMessageCount = 0;

        const overlay = document.getElementById('zyrex-discord-overlay');
        const drawer = document.getElementById('zyrex-discord-drawer');
        const titleEl = document.getElementById('zdc-thread-title');
        const statusEl = document.getElementById('zdc-thread-status');
        const bodyEl = document.getElementById('zdc-messages-body');

        if (titleEl) titleEl.textContent = fallbackTitle ? `💬 ${fallbackTitle}` : '💬 Request Thread';
        if (statusEl) statusEl.textContent = 'Connecting to Discord thread...';

        bodyEl.innerHTML = `
            <div class="zdc-empty-state">
                <i class="fab fa-discord fa-spin" style="animation-duration: 2s;"></i>
                <h4>Connecting to Discord...</h4>
                <p>Syncing thread messages with the server</p>
            </div>
        `;

        renderFooter();

        document.body.classList.add('zdc-drawer-open');
        overlay.classList.add('active');
        drawer.classList.add('active');

        // Fetch thread data immediately
        await fetchThreadMessages(true);

        // Start 3.5s polling loop
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(() => {
            fetchThreadMessages(false);
        }, 3500);
    };

    // Close drawer
    window.closeDiscordThreadDrawer = function () {
        const overlay = document.getElementById('zyrex-discord-overlay');
        const drawer = document.getElementById('zyrex-discord-drawer');

        document.body.classList.remove('zdc-drawer-open');
        if (overlay) overlay.classList.remove('active');
        if (drawer) drawer.classList.remove('active');

        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        currentRequestId = null;
    };

    // Manual refresh
    window.refreshDiscordThreadMessages = async function () {
        const icon = document.getElementById('zdc-refresh-icon');
        if (icon) icon.classList.add('fa-spin');
        await fetchThreadMessages(false);
        if (icon) setTimeout(() => icon.classList.remove('fa-spin'), 600);
    };

    // Handle guest login click
    window.handleDiscordDrawerLogin = function () {
        if (typeof window.openLoginModal === 'function') {
            window.openLoginModal();
        } else {
            window.location.href = '/api/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        }
    };

    // Fetch thread messages from API
    async function fetchThreadMessages(isInitial = false) {
        if (!currentRequestId) return;

        try {
            const resp = await fetch(`/api/requests/${encodeURIComponent(currentRequestId)}/thread`, {
                headers: {
                    'X-Zyrex-Key': window.ZYREX_API_KEY || 'zyrex_app_sec_k982f81a7b54c29013e9a'
                },
                credentials: 'include'
            });

            if (!resp.ok) {
                throw new Error(`HTTP error ${resp.status}`);
            }

            const data = await resp.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to load thread');
            }

            currentThreadData = data;

            // Update UI headers
            const titleEl = document.getElementById('zdc-thread-title');
            const statusEl = document.getElementById('zdc-thread-status');
            const externalLink = document.getElementById('zdc-external-link');

            if (titleEl) {
                titleEl.textContent = `💬 ${data.request_title || 'Request Thread'}`;
            }
            if (statusEl) {
                const count = (data.messages || []).length;
                statusEl.innerHTML = `<span class="zdc-dot"></span> Thread Active &bull; ${count} message${count === 1 ? '' : 's'}`;
            }
            if (externalLink && data.discord_url) {
                externalLink.href = data.discord_url;
            }

            renderFooter();
            renderMessages(data.messages || [], isInitial);
        } catch (err) {
            console.error('[DiscordDrawer] Error fetching thread:', err);
            const statusEl = document.getElementById('zdc-thread-status');
            if (statusEl) {
                statusEl.textContent = 'Unable to sync thread';
            }
            if (isInitial) {
                const bodyEl = document.getElementById('zdc-messages-body');
                if (bodyEl) {
                    bodyEl.innerHTML = `
                        <div class="zdc-empty-state">
                            <i class="fas fa-exclamation-circle" style="color:#f23f43;"></i>
                            <h4>Could Not Connect to Discord</h4>
                            <p>${escapeHtml(err.message || 'Please check your connection and try again.')}</p>
                            <button class="zdc-guest-login-btn" style="margin-top:14px;" onclick="window.refreshDiscordThreadMessages()">
                                <i class="fas fa-redo"></i> Retry
                            </button>
                        </div>
                    `;
                }
            }
        }
    }

    // Render list of messages
    function renderMessages(messages, isInitial = false) {
        const bodyEl = document.getElementById('zdc-messages-body');
        if (!bodyEl) return;

        // Check if user was near bottom before updating
        const isNearBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 120;

        if (messages.length === 0) {
            bodyEl.innerHTML = `
                <div class="zdc-empty-state">
                    <i class="far fa-comments"></i>
                    <h4>No messages in this thread yet</h4>
                    <p>Be the first to say something in Discord!</p>
                </div>
            `;
            return;
        }

        // Only re-render if message count changed or initial
        if (!isInitial && messages.length === lastMessageCount) {
            return;
        }
        lastMessageCount = messages.length;

        let html = '';

        messages.forEach((msg) => {
            const author = msg.author || {};
            const rawName = (author.name || author.username || 'Discord User').trim();
            const authorName = escapeHtml(rawName);
            // Never show BOT badge on human users. Only show on the official system bot.
            const isBot = !author.is_webhook && !msg.webhook_id && !!author.bot && 
                (String(author.id) === '1519456130290417776' || rawName === 'Zyrex™ Web' || rawName === 'Zyrex Bot');
            const avatarUrl = author.avatar || '/assets/content.png';
            const timeFormatted = formatDiscordTime(msg.created_at || msg.timestamp);
            const parsedContent = parseDiscordMarkdown(msg.content || '');

            let attachmentsHtml = '';
            if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
                attachmentsHtml = '<div class="zdc-attachments">';
                msg.attachments.forEach((att) => {
                    if (att.url && (att.url.match(/\.(jpg|jpeg|png|gif|webp)/i) || (att.filename && att.filename.match(/\.(jpg|jpeg|png|gif|webp)/i)))) {
                        attachmentsHtml += `<a href="${escapeHtml(att.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(att.url)}" class="zdc-attachment-img" alt="attachment"></a>`;
                    } else if (att.url) {
                        attachmentsHtml += `<a href="${escapeHtml(att.url)}" target="_blank" rel="noopener" style="color:#00a8fc;font-size:0.8rem;"><i class="fas fa-paperclip"></i> ${escapeHtml(att.filename || 'Attachment')}</a>`;
                    }
                });
                attachmentsHtml += '</div>';
            }

            html += `
                <div class="zdc-msg" data-msg-id="${escapeHtml(msg.id || '')}">
                    <div class="zdc-avatar-box">
                        <img src="${escapeHtml(avatarUrl)}" class="zdc-avatar" alt="${authorName}" onerror="this.src='/assets/content.png'">
                    </div>
                    <div class="zdc-msg-content-box">
                        <div class="zdc-msg-meta">
                            <span class="zdc-msg-author">${authorName}</span>
                            ${isBot ? '<span class="zdc-badge-bot"><i class="fas fa-robot" style="font-size:0.55rem;"></i> BOT</span>' : ''}
                            <span class="zdc-msg-time">${timeFormatted}</span>
                        </div>
                        <div class="zdc-msg-text">${parsedContent}</div>
                        ${attachmentsHtml}
                    </div>
                </div>
            `;
        });

        bodyEl.innerHTML = html;

        // Scroll to bottom if initial or was near bottom
        if (isInitial || isNearBottom) {
            bodyEl.scrollTop = bodyEl.scrollHeight;
        }
    }

    // Send message to Discord Thread
    window.sendDiscordThreadMessage = async function () {
        if (isSending || !currentRequestId) return;

        const input = document.getElementById('zdc-message-input');
        const sendBtn = document.getElementById('zdc-send-btn');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        isSending = true;
        if (sendBtn) sendBtn.disabled = true;
        input.disabled = true;

        try {
            const resp = await fetch(`/api/requests/${encodeURIComponent(currentRequestId)}/thread/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Zyrex-Key': window.ZYREX_API_KEY || 'zyrex_app_sec_k982f81a7b54c29013e9a'
                },
                credentials: 'include',
                body: JSON.stringify({ content: text })
            });

            const result = await resp.json();

            if (!resp.ok || !result.success) {
                if (resp.status === 401) {
                    alert('Please log in with Discord first to participate in thread discussions.');
                    window.handleDiscordDrawerLogin();
                    return;
                }
                throw new Error(result.error || 'Failed to send message');
            }

            // Successfully sent
            input.value = '';
            input.style.height = '40px';

            // Immediate refresh
            await fetchThreadMessages(false);

            // Scroll to bottom
            const bodyEl = document.getElementById('zdc-messages-body');
            if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
        } catch (err) {
            console.error('[DiscordDrawer] Send error:', err);
            alert(`Error sending message: ${err.message || 'Unknown error'}`);
        } finally {
            isSending = false;
            if (sendBtn) sendBtn.disabled = false;
            input.disabled = false;
            input.focus();
        }
    };

    // Auto-initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureDrawerDOM);
    } else {
        ensureDrawerDOM();
    }
})();

