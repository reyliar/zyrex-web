/**
 * Profile Page Engine (Pixel 5-Point Stars, Live Lanyard Sync, Fast 3D Tilt, Loading Screen, Aesthetic Custom Cursor, DevTools Protection)
 * Zyrex Editing
 */

(function () {
    'use strict';

    // ----------------------------------------------------
    // DISABLE RIGHT-CLICK & DEVTOOLS SHORTCUTS (F12, Ctrl+Shift+I/J/C, Ctrl+U)
    // ----------------------------------------------------
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });

    document.addEventListener('keydown', (e) => {
        // F12 key
        if (e.key === 'F12' || e.keyCode === 123) {
            e.preventDefault();
            return false;
        }

        // Ctrl+Shift+I (Inspect), Ctrl+Shift+J (Console), Ctrl+Shift+C (Element Selector), Ctrl+U (View Source)
        if (e.ctrlKey || e.metaKey) {
            const key = e.key ? e.key.toUpperCase() : '';
            const code = e.keyCode;
            if (e.shiftKey && (key === 'I' || key === 'J' || key === 'C' || code === 73 || code === 74 || code === 67)) {
                e.preventDefault();
                return false;
            }
            if (key === 'U' || code === 85) {
                e.preventDefault();
                return false;
            }
        }
    });

    // ----------------------------------------------------
    // 0. LOADING SCREEN DISMISSAL
    // ----------------------------------------------------
    const loaderScreen = document.getElementById('loaderScreen');
    function hideLoader() {
        if (loaderScreen && !loaderScreen.classList.contains('fade-out')) {
            loaderScreen.classList.add('fade-out');
            setTimeout(() => {
                if (loaderScreen) loaderScreen.style.display = 'none';
            }, 850);
        }
    }

    if (document.readyState === 'complete') {
        setTimeout(hideLoader, 200);
    } else {
        window.addEventListener('load', () => setTimeout(hideLoader, 200));
        setTimeout(hideLoader, 800);
    }

    // ----------------------------------------------------
    // 1. GUARANTEED LINK CLICK & TOUCH NAVIGATION HANDLER
    // ----------------------------------------------------
    function initClickHandlers() {
        const links = document.querySelectorAll('.icon-link-btn, .profile-footer, .page-corner-copyright');
        links.forEach(link => {
            const navigate = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = link.getAttribute('href');
                if (url && url !== '#') {
                    const target = link.getAttribute('target') || '_self';
                    if (target === '_blank') {
                        window.open(url, '_blank', 'noopener,noreferrer');
                    } else {
                        window.location.href = url;
                    }
                }
            };

            link.addEventListener('click', navigate);
            link.addEventListener('touchend', (e) => {
                e.preventDefault();
                navigate(e);
            }, { passive: false });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initClickHandlers);
    } else {
        initClickHandlers();
    }

    // ----------------------------------------------------
    // 2. CUSTOM AESTHETIC THEME CURSOR ENGINE
    // ----------------------------------------------------
    const cursorDot = document.getElementById('customCursorDot');
    const cursorRing = document.getElementById('customCursorRing');

    if (cursorDot && cursorRing) {
        let mouseX = -100;
        let mouseY = -100;
        let ringX = -100;
        let ringY = -100;

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            cursorDot.style.left = `${mouseX}px`;
            cursorDot.style.top = `${mouseY}px`;
        });

        // Smooth Lerp loop for magnetic ring follower
        function renderCursorRing() {
            ringX += (mouseX - ringX) * 0.22;
            ringY += (mouseY - ringY) * 0.22;

            cursorRing.style.left = `${ringX}px`;
            cursorRing.style.top = `${ringY}px`;

            requestAnimationFrame(renderCursorRing);
        }
        requestAnimationFrame(renderCursorRing);

        // Hover expansion over interactive elements
        function setupCursorHover() {
            document.querySelectorAll('a, button, .icon-link-btn, .page-corner-copyright').forEach(el => {
                el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
                el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupCursorHover);
        } else {
            setupCursorHover();
        }
    }

    // ----------------------------------------------------
    // 3. STAGGERED 7s+ LIFETIME PIXEL STARS WITH PARTICLE SCATTER
    // ----------------------------------------------------
    const canvas = document.getElementById('starfield');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const isBordo = document.body.classList.contains('theme-bordo');
    const dotGlowColor = isBordo ? '#ff2a6d' : '#60a5fa';

    function getStarVertices(outerRadius, rotation) {
        const innerRadius = outerRadius * 0.44;
        const numPoints = 5;
        const vertices = [];

        for (let i = 0; i < numPoints * 2; i++) {
            const angle = -Math.PI / 2 + (i * Math.PI) / numPoints + rotation;
            const r = (i % 2 === 0) ? outerRadius : innerRadius;
            vertices.push({
                x: Math.cos(angle) * r,
                y: Math.sin(angle) * r
            });
        }
        return vertices;
    }

    function getTrackDotPositions(vertices, dotSpacing) {
        const dots = [];
        for (let i = 0; i < vertices.length; i++) {
            const p1 = vertices[i];
            const p2 = vertices[(i + 1) % vertices.length];

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const segmentLen = Math.hypot(dx, dy);
            const numDots = Math.max(1, Math.floor(segmentLen / dotSpacing));

            for (let j = 0; j < numDots; j++) {
                const t = j / numDots;
                dots.push({
                    x: p1.x + dx * t,
                    y: p1.y + dy * t
                });
            }
        }
        return dots;
    }

    function drawDoubleLineDottedStar(ctx, x, y, outerRadius, rotation, alpha) {
        ctx.save();
        ctx.translate(x, y);

        const innerOffset = Math.max(3.5, outerRadius * 0.09);
        const verticesOuter = getStarVertices(outerRadius, rotation);
        const verticesInner = getStarVertices(Math.max(4, outerRadius - innerOffset), rotation);

        const dotSpacing = Math.max(3.2, outerRadius * 0.075);
        const dotSize = Math.max(1.8, Math.min(3.4, outerRadius * 0.048));

        ctx.shadowBlur = Math.min(14, outerRadius * 0.2);
        ctx.shadowColor = dotGlowColor;

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        const dotsOuter = getTrackDotPositions(verticesOuter, dotSpacing);
        for (let i = 0; i < dotsOuter.length; i++) {
            ctx.fillRect(dotsOuter[i].x - dotSize / 2, dotsOuter[i].y - dotSize / 2, dotSize, dotSize);
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.82})`;
        const dotsInner = getTrackDotPositions(verticesInner, dotSpacing);
        for (let i = 0; i < dotsInner.length; i++) {
            ctx.fillRect(dotsInner[i].x - dotSize / 2, dotsInner[i].y - dotSize / 2, dotSize * 0.9, dotSize * 0.9);
        }

        ctx.restore();
    }

    class FlyingDotParticle {
        constructor(x, y, vx, vy, size, alpha) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.size = size;
            this.alpha = alpha;
            this.friction = 0.97;
            this.decay = Math.random() * 0.016 + 0.012;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= this.friction;
            this.vy *= this.friction;
            this.alpha -= this.decay;
        }

        draw() {
            if (this.alpha > 0.01) {
                ctx.save();
                ctx.shadowBlur = 6;
                ctx.shadowColor = dotGlowColor;
                ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
                ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
                ctx.restore();
            }
        }
    }

    const flyingParticles = [];

    class ExplodingStar {
        constructor(x, y, initialDelaySeconds) {
            this.x = x;
            this.y = y;
            this.reset(x, y, initialDelaySeconds);
        }

        reset(x, y, customDelaySeconds) {
            this.x = x;
            this.y = y;

            const r = Math.random();
            if (r > 0.8) {
                this.baseRadius = Math.random() * 20 + 56;
            } else if (r > 0.4) {
                this.baseRadius = Math.random() * 14 + 36;
            } else {
                this.baseRadius = Math.random() * 10 + 20;
            }

            this.rotation = (Math.random() - 0.5) * 0.5;
            this.rotationSpeed = (Math.random() - 0.5) * 0.003;

            this.scale = 0;
            this.targetScale = 1;
            this.growthSpeed = Math.random() * 0.018 + 0.01;

            this.alpha = 0;
            this.targetAlpha = Math.random() * 0.35 + 0.6;

            const delaySec = customDelaySeconds !== undefined 
                ? customDelaySeconds 
                : (7 + Math.random() * 6);
                
            this.lifeTimer = Math.floor(delaySec * 60);
            this.exploded = false;
        }

        explode() {
            this.exploded = true;

            const innerOffset = Math.max(3.5, this.baseRadius * 0.09);
            const verticesOuter = getStarVertices(this.baseRadius, this.rotation);
            const verticesInner = getStarVertices(Math.max(4, this.baseRadius - innerOffset), this.rotation);
            const dotSpacing = Math.max(3.2, this.baseRadius * 0.075);
            const dotSize = Math.max(1.8, Math.min(3.4, this.baseRadius * 0.048));

            const dotsOuter = getTrackDotPositions(verticesOuter, dotSpacing);
            const dotsInner = getTrackDotPositions(verticesInner, dotSpacing);
            const allDots = [...dotsOuter, ...dotsInner];

            for (let i = 0; i < allDots.length; i++) {
                const worldX = this.x + allDots[i].x;
                const worldY = this.y + allDots[i].y;

                const angle = Math.atan2(allDots[i].y, allDots[i].x) + (Math.random() - 0.5) * 0.6;
                const speed = Math.random() * 3.8 + 2.0;

                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;

                flyingParticles.push(new FlyingDotParticle(worldX, worldY, vx, vy, dotSize, this.alpha));
            }

            this.reset(this.x, this.y);
        }

        update() {
            this.rotation += this.rotationSpeed;

            if (this.scale < this.targetScale) {
                this.scale += this.growthSpeed;
                if (this.scale > this.targetScale) this.scale = this.targetScale;
            }
            if (this.alpha < this.targetAlpha) {
                this.alpha += this.growthSpeed * 0.8;
                if (this.alpha > this.targetAlpha) this.alpha = this.targetAlpha;
            }

            this.lifeTimer--;
            if (this.lifeTimer <= 0 && !this.exploded) {
                this.explode();
            }
        }

        draw() {
            if (this.alpha > 0.01) {
                const currentR = this.baseRadius * this.scale;
                drawDoubleLineDottedStar(ctx, this.x, this.y, currentR, this.rotation, this.alpha);
            }
        }
    }

    const stars = [];
    const cols = 4;
    const rows = 4;
    const cellW = width / cols;
    const cellH = height / rows;
    let starIndex = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const px = c * cellW + Math.random() * (cellW * 0.7) + cellW * 0.15;
            const py = r * cellH + Math.random() * (cellH * 0.7) + cellH * 0.15;
            
            const initialDelaySec = 7 + (starIndex * 1.2) + (Math.random() * 1.5);
            stars.push(new ExplodingStar(px, py, initialDelaySec));
            starIndex++;
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        for (let i = flyingParticles.length - 1; i >= 0; i--) {
            const p = flyingParticles[i];
            p.update();
            p.draw();
            if (p.alpha <= 0.01) {
                flyingParticles.splice(i, 1);
            }
        }

        for (let i = 0; i < stars.length; i++) {
            stars[i].update();
            stars[i].draw();
        }
        requestAnimationFrame(animate);
    }
    animate();

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    // ----------------------------------------------------
    // 4. LIVE DISCORD LANYARD PRESENCE SYNC
    // ----------------------------------------------------
    const profileCard = document.querySelector('.profile-card');
    if (!profileCard) return;

    const discordUserId = profileCard.getAttribute('data-discord-id');
    if (!discordUserId) return;

    const avatarImg = document.getElementById('discordAvatar');
    const statusDot = document.getElementById('statusDot');
    const presenceText = document.getElementById('presenceText');
    const displayNameEl = document.getElementById('displayName');
    const usernameEl = document.getElementById('username');

    function updateDiscordUI(data) {
        if (!data) return;

        const { discord_user, discord_status, activities, spotify } = data;

        if (discord_user && discord_user.avatar) {
            const ext = discord_user.avatar.startsWith('a_') ? 'gif' : 'png';
            avatarImg.src = `https://cdn.discordapp.com/avatars/${discord_user.id}/${discord_user.avatar}.${ext}?size=256`;
        }

        if (discord_user) {
            if (discord_user.global_name && displayNameEl) {
                displayNameEl.textContent = discord_user.global_name;
            }
            if (discord_user.username && usernameEl) {
                usernameEl.textContent = '@' + discord_user.username;
            }
        }

        if (statusDot && discord_status) {
            statusDot.className = 'status-dot-badge ' + discord_status;
            statusDot.setAttribute('title', discord_status.toUpperCase());
        }

        if (presenceText) {
            if (spotify) {
                presenceText.innerHTML = `<i class="fab fa-spotify" style="color:#1db954"></i> Listening to <b>${escapeHtml(spotify.song)}</b> by ${escapeHtml(spotify.artist)}`;
            } else if (activities && activities.length > 0) {
                const customStatus = activities.find(a => a.type === 4);
                const gameActivity = activities.find(a => a.type !== 4);

                if (customStatus && customStatus.state) {
                    const emojiStr = customStatus.emoji ? `${customStatus.emoji.name} ` : '';
                    presenceText.textContent = `${emojiStr}${customStatus.state}`;
                } else if (gameActivity) {
                    const actionName = gameActivity.type === 1 ? 'Streaming' : 'Playing';
                    presenceText.textContent = `${actionName} ${gameActivity.name}`;
                } else {
                    presenceText.textContent = getStatusText(discord_status);
                }
            } else {
                presenceText.textContent = getStatusText(discord_status);
            }
        }
    }

    function getStatusText(status) {
        switch (status) {
            case 'online': return 'Online on Discord';
            case 'idle': return 'Idle / Away';
            case 'dnd': return 'Do Not Disturb';
            default: return 'Offline';
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }

    async function fetchNativePresenceData() {
        try {
            // Primary: Query native Zyrex API endpoint /api/presence/:id
            const resp = await fetch(`/api/presence/${discordUserId}`);
            if (resp.ok) {
                const json = await resp.json();
                if (json.success && json.data) {
                    const d = json.data;
                    updateDiscordUI({
                        discord_user: {
                            id: d.id,
                            username: d.username,
                            global_name: d.global_name,
                            avatar: d.avatar ? (d.avatar.split('/').pop()?.split('.')[0] || '') : null
                        },
                        discord_status: d.status,
                        activities: d.activities || [],
                        spotify: d.spotify || null
                    });
                    if (d.avatar && avatarImg) avatarImg.src = d.avatar;
                    return;
                }
            }
        } catch (e) {
            console.log('Native Presence API fallback:', e.message);
        }

        // Secondary Fallback: Direct Lanyard REST API
        try {
            const resp = await fetch(`https://api.lanyard.rest/v1/users/${discordUserId}`);
            if (resp.ok) {
                const json = await resp.json();
                if (json.success && json.data) {
                    updateDiscordUI(json.data);
                }
            }
        } catch (e) {}
    }
    fetchNativePresenceData();
    setInterval(fetchNativePresenceData, 6000);

    function connectLanyardWS() {
        let ws;
        try {
            ws = new WebSocket('wss://api.lanyard.rest/socket');
        } catch (e) {
            return;
        }

        ws.onopen = () => {
            ws.send(JSON.stringify({
                op: 2,
                d: { subscribe_to_id: discordUserId }
            }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.op === 1) {
                    setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ op: 3 }));
                        }
                    }, data.d.heartbeat_interval);
                } else if (data.t === 'INIT_STATE' || data.t === 'PRESENCE_UPDATE') {
                    updateDiscordUI(data.d);
                }
            } catch (err) {}
        };

        ws.onclose = () => {
            setTimeout(connectLanyardWS, 10000);
        };
    }
    connectLanyardWS();

    // ----------------------------------------------------
    // 5. FAST 3D PARALLAX TILT ENGINE
    // ----------------------------------------------------
    const neonCard = document.querySelector('.neon-card-container');
    if (neonCard) {
        let currentTiltX = 0;
        let currentTiltY = 0;
        let targetTiltX = 0;
        let targetTiltY = 0;

        function updateTiltPhysics() {
            currentTiltX += (targetTiltX - currentTiltX) * 0.24;
            currentTiltY += (targetTiltY - currentTiltY) * 0.24;

            neonCard.style.transform = `rotateX(${currentTiltX.toFixed(2)}deg) rotateY(${currentTiltY.toFixed(2)}deg)`;
            requestAnimationFrame(updateTiltPhysics);
        }
        requestAnimationFrame(updateTiltPhysics);

        window.addEventListener('mousemove', (e) => {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            const deltaX = (e.clientX - centerX) / centerX;
            const deltaY = (e.clientY - centerY) / centerY;

            const maxTilt = 22;
            targetTiltX = -deltaY * maxTilt;
            targetTiltY = deltaX * maxTilt;
        });

        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;

                const deltaX = (touch.clientX - centerX) / centerX;
                const deltaY = (touch.clientY - centerY) / centerY;

                targetTiltX = -deltaY * 16;
                targetTiltY = deltaX * 16;
            }
        });

        document.addEventListener('mouseleave', () => {
            targetTiltX = 0;
            targetTiltY = 0;
        });
    }

})();
