
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const productId = params.get('id');
        let downloadToken = null;
        let product = null;
        let resolvedFilePath = '';
        let countdownInterval = null;
        let tokenExpiryTime = null;

        function showState(id) {
            document.querySelectorAll('.state').forEach(s => s.classList.remove('active'));
            const el = document.getElementById(id);
            if (el) el.classList.add('active');
        }

        function showError(msg) {
            document.getElementById('errMsg').textContent = msg;
            showState('st-err');
        }

        // Countdown
        function updateCountdown() {
            const timerEl = document.getElementById('countdownTimer');
            const rowEl = document.getElementById('countdownRow');
            if (!timerEl || !rowEl) return;
            if (!tokenExpiryTime) { timerEl.textContent = '--:--'; return; }
            
            const remaining = Math.max(0, Math.floor((tokenExpiryTime - Date.now()) / 1000));
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            timerEl.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
            
            rowEl.classList.remove('warning', 'expired');
            if (remaining <= 0) {
                rowEl.classList.add('expired');
                timerEl.textContent = 'Expired';
                const btn = document.getElementById('dlBtn');
                if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-clock"></i> Link Expired'; }
                if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
            } else if (remaining <= 60) {
                rowEl.classList.add('warning');
            }
        }

        function startCountdown(expiresInSeconds) {
            tokenExpiryTime = Date.now() + (expiresInSeconds * 1000);
            updateCountdown();
            if (countdownInterval) clearInterval(countdownInterval);
            countdownInterval = setInterval(updateCountdown, 1000);
        }

        const iconMap = {"after-effects":"fa-film","premiere-pro":"fa-video","photoshop":"fa-image","video-star":"fa-star","topaz-labs":"fa-gem","others":"fa-folder"};
        const catLabels = {"after-effects":"After Effects","premiere-pro":"Premiere Pro","photoshop":"Photoshop","video-star":"Video Star","topaz-labs":"Topaz Labs","others":"Others"};

        async function fetchDiscordAvatar(userId) {
            if (!userId) return '';
            try {
                const resp = await fetch('/api/discord-user?userId=' + userId);
                const data = await resp.json();
                if (data.success && data.user && data.user.avatar) {
                    const ext = data.user.avatar.startsWith('a_') ? 'gif' : 'png';
                    return '/api/avatar/' + userId + '/' + data.user.avatar + '.' + ext + '?size=64';
                }
            } catch(e) {}
            let defIdx = 0;
            try { defIdx = Number((BigInt(userId) >> 22n) % 6n); } catch(e) { defIdx = parseInt(userId) % 5; }
            return '/api/avatar/default/' + defIdx + '.png';
        }

        // Init
        (async function init() {
            if (!token && !productId) {
                showState('st-404');
                return;
            }

            if (token) {
                try {
                    const resp = await fetch('/api/downloads/validate?token=' + encodeURIComponent(token) + '&peek=1');
                    const data = await resp.json();
                    if (data.success) {
                        downloadToken = token;
                        resolvedFilePath = data.file_path || '';
                        const expiresIn = data.expires_in || 0;
                        await loadProduct(data.product_id);
                        if (product && resolvedFilePath && !product.file_path) product.file_path = resolvedFilePath;
                        if (product) { await render(); if (expiresIn > 0) startCountdown(expiresIn); return; }
                    }
                    showError("This download link is invalid or has expired. Please generate a new one.");
                } catch (e) { showError("Unable to validate download token."); }
                return;
            }

            if (!productId) { showState('st-404'); return; }
            await loadProduct(productId);
            if (!product) { showError("Product not found."); return; }
            await render();
        })();

        async function loadProduct(pid) {
            try {
                const r = await fetch('/api/products?id=' + pid);
                if (r.ok) { const j = await r.json(); if (j && j.id) product = j; }
            } catch(e) {}
            if (!product) {
                const all = [...(window.presetsData || []), ...(window.pluginsData || [])];
                product = all.find(p => p.id === pid);
            }
        }

        async function render() {
            showState('st-main');
            document.title = (product.name || 'Download') + ' - Zyrex';

            const p = product;
            const ic = iconMap[p.category] || 'fa-folder';
            const cat = catLabels[p.category] || 'Others';
            const av = p.creator_avatar || '';
            const nick = p.creator_nickname || p.author_name || 'Zyrex Creator';
            const desc = p.description || p.desc || '';
            const authorId = p.author_id || '';
            const uploaderName = p.uploader_name || '';

            let displayUploaderAv = await fetchDiscordAvatar(authorId);
            if (p.uploader_avatar && (p.uploader_avatar.includes('discordapp.com') || p.uploader_avatar.includes('discord.com'))) {
                displayUploaderAv = p.uploader_avatar;
            }

            let html = '';

            // Thumbnail
            html += '<div class="thumb-wrap">';
            if (p.thumbnail) {
                html += '<img src="' + p.thumbnail + '" alt="' + p.name + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">';
            }
            html += '<i class="fas ' + ic + ' ph-icon" style="' + (p.thumbnail ? 'display:none' : '') + '"></i>';
            html += '<div class="thumb-badges"><span class="tbadge"><i class="fas ' + ic + '"></i> ' + cat + '</span><span class="tbadge free"><i class="fas fa-circle-check"></i> Free</span></div>';
            html += '</div>';

            // Title
            html += '<h1 class="product-title">' + p.name + '</h1>';
            html += '<div class="product-meta"><i class="fas ' + ic + '"></i> ' + cat + ' <span class="sep"></span> <i class="fas fa-download"></i> <span id="dlCount">0</span> downloads</div>';

            // Creator
            html += '<div class="creator-row">';
            html += av ? '<img src="' + av + '" alt="">' : '<div class="cav-fb"><i class="fas fa-user"></i></div>';
            html += '<strong>' + nick + '</strong>';
            if (p.creator_social_url) html += '<a href="' + p.creator_social_url + '" target="_blank"><i class="fas fa-external-link-alt"></i> Profile</a>';
            html += '</div>';

            // Uploader
            if (uploaderName) {
                html += '<div class="uploader-row">';
                html += displayUploaderAv ? '<img src="' + displayUploaderAv + '" alt="">' : '<div class="uav-fb"><i class="fab fa-discord"></i></div>';
                html += '<div><strong>' + uploaderName + '</strong><span>Community Uploader</span></div>';
                html += '</div>';
            }

            // Description
            if (desc) {
                html += '<div class="desc-block"><div class="desc-label"><i class="fas fa-align-left"></i> Description</div>' + desc.replace(/\n/g, '<br>') + '</div>';
            }

            // Files (exclude watermarks) - fetch from API if not in product data
            const watermarkNames = ['LEAKED BY ZYREX.txt', 'Visit for more resources!.url'];
            let fileList = p.files || [];
            
            if (fileList.length === 0 && (p.id || p.file_path || resolvedFilePath)) {
                try {
                    const fp = resolvedFilePath || p.file_path || '';
                    let listUrl = '/api/files/list-path?product_id=' + encodeURIComponent(p.id || '');
                    if (fp) listUrl += '&path=' + encodeURIComponent(fp);
                    const filesResp = await fetch(listUrl);
                    const filesData = await filesResp.json();
                    if (filesData.success && filesData.files) {
                        fileList = filesData.files;
                        if (filesData.prefix && !resolvedFilePath) resolvedFilePath = filesData.prefix;
                    }
                } catch(e) {}
            }
            
            const realFiles = fileList.filter(function(f) { return !watermarkNames.includes(f.name); });
                
                if (realFiles.length > 0) {
                    html += '<div class="files-block"><div class="files-label"><div><i class="fas fa-folder-open"></i> Files in this pack (' + realFiles.length + ')</div><div class="files-label-right"><button class="select-all-btn" onclick="toggleSelectAll(this)">Select All</button></div></div>';
                    html += '<div class="files-scroll">';
                    realFiles.forEach(function(f, idx) {
                        const sz = f.size ? (f.size > 1048576 ? (f.size/1048576).toFixed(1)+' MB' : (f.size/1024).toFixed(1)+' KB') : '--';
                        const fi = f.name.endsWith('.mp4')||f.name.endsWith('.mov')?'fa-file-video':f.name.endsWith('.mp3')||f.name.endsWith('.wav')?'fa-file-audio':f.name.endsWith('.png')||f.name.endsWith('.jpg')||f.name.endsWith('.jpeg')?'fa-file-image':'fa-file-lines';
                        html += '<div class="file-item"><div class="fl"><input type="checkbox" class="file-cb" checked onchange="updateSelectedCount()" data-filename="' + f.name.replace(/"/g, '&quot;') + '"><i class="fas ' + fi + '"></i><span title="' + f.name + '">' + f.name + '</span></div><span class="fs">' + sz + '</span></div>';
                    });
                    html += '</div>'; // close files-scroll
                    html += '</div>'; // close files-block
                }

            // Download card
            if (productId || downloadToken) {
                html += '<div class="dl-card">';
                html += '<button class="dl-btn" id="dlBtn" onclick="triggerDownload()"><i class="fas fa-cloud-arrow-down"></i> Download Full Package (ZIP)</button>';
                html += '<div class="countdown-row" id="countdownRow"><i class="fas fa-hourglass-half"></i> <span>Expires in</span> <span class="timer" id="countdownTimer">--:--</span></div>';
                html += '</div>';
            }

            // Back link
            html += '<a href="https://zyrexediting.xyz/resources" class="back-link"><i class="fas fa-arrow-left"></i> Back to Resources</a>';

            document.getElementById('st-main').innerHTML = html;
            setTimeout(function() {
                // Sync from persistent API first, then update display
                (async function() {
                    try {
                        var dl = JSON.parse(localStorage.getItem('zyrex_downloads') || '{}');
                        var r = await fetch('/api/downloads/counts');
                        var d = await r.json();
                        if (d.success && d.counts) {
                            for (var k in d.counts) {
                                if (d.counts[k] > (dl[k] || 0)) dl[k] = d.counts[k];
                            }
                        }
                        // Merge cross-domain cookies
                        var cookies = document.cookie.split(';');
                        for (var i = 0; i < cookies.length; i++) {
                            var c = cookies[i].trim();
                            var m = c.match(/^zyrex_dl_(.+?)=(.+)$/);
                            if (m) { var cid = m[1]; var cv = parseInt(m[2]) || 0; dl[cid] = Math.max(cv, dl[cid] || 0); }
                        }
                        localStorage.setItem('zyrex_downloads', JSON.stringify(dl));
                    } catch(e) {}
                    updateDownloadCount();
                })();
            }, 100);
            setTimeout(updateSelectedCount, 150);
        }

        // File selection helpers
        function toggleSelectAll(btn) {
            const cbs = document.querySelectorAll('.file-cb');
            const allChecked = Array.from(cbs).every(function(cb) { return cb.checked; });
            cbs.forEach(function(cb) { cb.checked = !allChecked; });
            btn.textContent = allChecked ? 'Select All' : 'Deselect All';
            updateSelectedCount();
        }

        function updateSelectedCount() {
            const cbs = document.querySelectorAll('.file-cb');
            const checked = document.querySelectorAll('.file-cb:checked');
            const label = document.querySelector('.files-label div:first-child');
            if (label && cbs.length > 0) {
                const iconHtml = '<i class="fas fa-folder-open"></i> ';
                label.innerHTML = iconHtml + 'Files selected (' + checked.length + '/' + cbs.length + ')';
            }
            const selectAllBtn = document.querySelector('.select-all-btn');
            if (selectAllBtn && cbs.length > 0) {
                selectAllBtn.textContent = checked.length === cbs.length ? 'Deselect All' : 'Select All';
            }
            updateButtonText();
        }

        function updateButtonText() {
            const btn = document.getElementById('dlBtn');
            if (!btn) return;
            const allCbs = document.querySelectorAll('.file-cb');
            const checked = document.querySelectorAll('.file-cb:checked');
            const total = allCbs.length;
            const sel = checked.length;
            let icon = '<i class="fas fa-cloud-arrow-down"></i> ';
            if (total === 0 || sel === total) {
                btn.innerHTML = icon + 'Download Full Package (ZIP)';
            } else if (sel === 1) {
                btn.innerHTML = icon + 'Download Selected File';
            } else {
                btn.innerHTML = icon + 'Download Selected (' + sel + ' files)';
            }
        }

        // Helper: read a specific cookie by name
        function getCookie(name) {
            var match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/+^])/g, '\\$1') + '=([^;]*)'));
            return match ? decodeURIComponent(match[1]) : null;
        }

        // Download tracking
        function trackDownload() {
            if (!product || !product.id) return;
            var pid = product.id;
            // LocalStorage
            try {
                var key = 'zyrex_downloads';
                var downloads = JSON.parse(localStorage.getItem(key) || '{}');
                downloads[pid] = (downloads[pid] || 0) + 1;
                localStorage.setItem(key, JSON.stringify(downloads));
                updateDownloadCount();
            } catch(e) {}
            // Cross-domain cookie (shared across zyrexediting.xyz + dl.zyrexediting.xyz)
            try {
                var ckey = 'zyrex_dl_' + pid;
                var curr = parseInt(getCookie(ckey)) || 0;
                document.cookie = ckey + '=' + (curr + 1) + ';domain=.zyrexediting.xyz;path=/;max-age=31536000;SameSite=Lax';
            } catch(e) {}
            // Persistent API (cross-domain)
            try {
                fetch('/api/downloads/track', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({productId: pid})
                }).catch(function(){});
            } catch(e) {}
        }

        function updateDownloadCount() {
            const el = document.getElementById('dlCount');
            if (!el || !product) return;
            try {
                const downloads = JSON.parse(localStorage.getItem('zyrex_downloads') || '{}');
                el.textContent = downloads[product.id] || 0;
            } catch(e) {}
        }

        // Shared helper: read download count from localStorage or cross-domain cookie
        function getDownloadCount(productId) {
            // Try localStorage first
            try {
                const downloads = JSON.parse(localStorage.getItem('zyrex_downloads') || '{}');
                if (downloads[productId]) return downloads[productId];
            } catch(e) {}
            // Fallback: read from cross-domain cookie
            try {
                const match = document.cookie.match(new RegExp('(?:^|; )zyrex_dl_' + productId + '=([^;]*)'));
                if (match) return parseInt(match[1]) || 0;
            } catch(e) {}
            return 0;
        }

        // Progress UI
        function showProgress(text, detail) {
            document.getElementById('progText').textContent = text || 'Preparing download...';
            document.getElementById('progDetail').textContent = detail || '';
            document.getElementById('progBar').style.width = '0%';
            document.getElementById('progOverlay').classList.add('active');
        }
        function updateProgress(percent, detail) {
            document.getElementById('progBar').style.width = percent + '%';
            if (detail) document.getElementById('progDetail').textContent = detail;
        }
        function hideProgress() {
            document.getElementById('progOverlay').classList.remove('active');
        }
        function formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
            return (bytes/1048576).toFixed(1) + ' MB';
        }

        async function downloadWithProgress(url, filename) {
            showProgress('Connecting...', '');
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error('Download failed: ' + resp.status);
                
                const contentLength = resp.headers.get('Content-Length');
                const total = contentLength ? parseInt(contentLength) : 0;
                let received = 0;
                const reader = resp.body.getReader();
                const chunks = [];
                
                updateProgress(0, total ? '0 / ' + formatSize(total) : 'Downloading...');
                
                while (true) {
                    const result = await reader.read();
                    if (result.done) break;
                    chunks.push(result.value);
                    received += result.value.length;
                    if (total > 0) {
                        updateProgress(Math.round((received / total) * 100), formatSize(received) + ' / ' + formatSize(total));
                    }
                    document.getElementById('progText').textContent = 'Downloading...';
                }
                
                updateProgress(100, 'Saving...');
                document.getElementById('progText').textContent = 'Saving to your computer...';
                
                const blob = new Blob(chunks);
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename || 'download.zip';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                
                hideProgress();
                trackDownload();
            } catch(e) {
                hideProgress();
                alert('Download failed: ' + e.message);
            }
        }

        function getSelectedFiles() {
            const cbs = document.querySelectorAll('.file-cb');
            const allCbs = document.querySelectorAll('.file-cb');
            if (allCbs.length === 0) return '';
            const checked = document.querySelectorAll('.file-cb:checked');
            // Only filter if some are unchecked (otherwise send all)
            if (checked.length === allCbs.length) return '';
            return Array.from(checked).map(function(cb) { return cb.dataset.filename; });
        }

        async function triggerDownload() {
            const btn = document.getElementById('dlBtn');
            if (!btn) return;
            
            const selectedFiles = getSelectedFiles();
            const fileParam = Array.isArray(selectedFiles) && selectedFiles.length
                ? selectedFiles.map(function(name) { return '&file=' + encodeURIComponent(name); }).join('')
                : '';
            const titleParam = product ? '&title=' + encodeURIComponent(product.name) : '';
            
            if (downloadToken) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
                await downloadWithProgress('/api/downloads/download?token=' + downloadToken + fileParam + titleParam, (product ? product.name : 'download') + '.zip');
                btn.innerHTML = '<i class="fas fa-arrow-rotate-right"></i> Link Used';
                btn.disabled = true;
                return;
            }

            if (!productId) return;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating token...';
            
            try {
                const fpHint = resolvedFilePath || (product && product.file_path ? product.file_path : '');
                const tokenUrl = '/api/downloads/request-token/' + productId + (fpHint ? '?file_path=' + encodeURIComponent(fpHint) : '');
                const tokenResp = await fetch(tokenUrl);
                if (!tokenResp.ok) {
                    const d = await tokenResp.json();
                    if (tokenResp.status === 401) {
                        window.location.href = '/api/login?redirect=' + encodeURIComponent(location.pathname + location.search);
                        return;
                    }
                    alert(d.error || 'Unable to acquire download ticket.');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-cloud-arrow-down"></i> Download Full Package (ZIP)';
                    return;
                }
                const tokenData = await tokenResp.json();
                if (tokenData.success && tokenData.token) {
                    downloadToken = tokenData.token;
                    if (tokenData.file_path) {
                        resolvedFilePath = tokenData.file_path;
                        if (product) product.file_path = tokenData.file_path;
                    }
                    if (tokenData.expires_in) startCountdown(tokenData.expires_in);
                    btn.innerHTML = '<i class="fas fa-circle-check"></i> Starting download...';
                    await downloadWithProgress('/api/downloads/download?token=' + tokenData.token + fileParam + titleParam, (product ? product.name : 'download') + '.zip');
                    btn.innerHTML = '<i class="fas fa-arrow-rotate-right"></i> Link Used';
                    btn.disabled = true;
                } else {
                    alert('Ticket generation failed.');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-cloud-arrow-down"></i> Download Full Package (ZIP)';
                }
            } catch (e) {
                console.error('Download error:', e);
                alert('Network error. Please try again.');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-cloud-arrow-down"></i> Download Full Package (ZIP)';
            }
        }

        async function triggerFileDownload(filePath, btn) {
            if (!productId) return;
            const origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            try {
                const fpHint = resolvedFilePath || (product && product.file_path ? product.file_path : '');
                const tokenUrl = '/api/downloads/request-token/' + productId + (fpHint ? '?file_path=' + encodeURIComponent(fpHint) : '');
                const tokenResp = await fetch(tokenUrl);
                if (!tokenResp.ok) {
                    const d = await tokenResp.json();
                    alert(d.error || 'Unable to acquire download ticket.');
                    btn.disabled = false;
                    btn.innerHTML = origHtml;
                    return;
                }
                const tokenData = await tokenResp.json();
                if (tokenData.success && tokenData.token) {
                    trackDownload();
                    window.location.href = '/api/downloads/download?token=' + tokenData.token + '&file=' + encodeURIComponent(filePath);
                    setTimeout(function() { btn.disabled = false; btn.innerHTML = origHtml; }, 3000);
                } else {
                    alert('Ticket generation failed.');
                    btn.disabled = false;
                    btn.innerHTML = origHtml;
                }
            } catch (e) {
                console.error('File download error:', e);
                alert('Network error. Please try again.');
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
        }
    
