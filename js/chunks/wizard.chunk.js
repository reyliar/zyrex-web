/**
 * Zyrex Chunk Architecture — Creator Studio Wizard Chunk
 * Dynamic on-demand loaded chunk for creator social resolution,
 * store discovery (Payhip, Boosty, Patreon, Linktree), and catalog product picker.
 */
(function(window) {
    'use strict';

    // Resolve Social & Open Creator Studio Wizard
    window.execResolveReqSocial = async function() {
        var rawInput = (document.getElementById('modalCreatorUrl') || {}).value || '';
        rawInput = rawInput.trim();
        if (!rawInput) {
            window.execOpenCreatorWizard('');
            return;
        }

        var url = rawInput;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            if (/^(payhip|boosty|patreon|linktr|guns|beacons)\./i.test(url)) {
                url = 'https://' + url;
            }
        }

        var rawUser = '';
        try {
            rawUser = url.split('?')[0].replace(/\/$/, '').split('/').pop().replace('@', '');
        } catch(e) {}

        if (rawUser) {
            var nameEl = document.getElementById('modalCreatorName');
            if (nameEl) nameEl.value = rawUser;
        }

        var badge = document.getElementById('creatorLiveBadge');
        var badgeStatus = document.getElementById('badgeStatus');
        if (badge) {
            badge.style.display = 'flex';
            var bt = document.getElementById('badgeTitle');
            if (bt) bt.textContent = rawUser || 'Creator';
            var bu = document.getElementById('badgeUrl');
            if (bu) bu.textContent = url;
            if (badgeStatus) badgeStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
        }

        window.execOpenCreatorWizard(url);
    };
    window.resolveReqSocial = window.execResolveReqSocial;

    window.triggerCreatorSocialLookup = function(ev) {
        window.execResolveReqSocial();
    };

    window.execOpenCreatorWizard = function(initialUrl) {
        var modal = document.getElementById('creatorWizardModal');
        if (!modal) return;

        var ov = document.getElementById('wizCheckOverlay');
        if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
        var modalContainer = document.getElementById('wizModalContainer');
        if (modalContainer) {
            var children = modalContainer.children;
            for (var i = 0; i < children.length; i++) {
                children[i].classList.remove('wiz-content-lift');
            }
        }

        modal.classList.add('open');

        var val = (initialUrl !== undefined && initialUrl !== null) ? initialUrl : ((document.getElementById('modalCreatorUrl') || {}).value || '');
        var inp = document.getElementById('wizUrlInput');
        if (inp) {
            if (val) inp.value = val;
            inp.focus();
        }
        if (val) {
            window.startCreatorWizard();
        }
    };

    window.closeCreatorWizard = function() {
        var modal = document.getElementById('creatorWizardModal');
        if (modal) modal.classList.remove('open');
        var ov = document.getElementById('wizCheckOverlay');
        if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
        var modalContainer = document.getElementById('wizModalContainer');
        if (modalContainer) {
            var children = modalContainer.children;
            for (var i = 0; i < children.length; i++) {
                children[i].classList.remove('wiz-content-lift');
            }
        }
    };

    window.setWizStep = function(stepNum) {
        for (var i = 1; i <= 3; i++) {
            var circle = document.getElementById('wzCircle' + i);
            var label = document.getElementById('wzLabel' + i);
            if (!circle || !label) continue;

            circle.className = 'wiz-step-circle';
            label.className = 'wiz-step-label';

            if (i < stepNum) {
                circle.classList.add('done');
                circle.innerHTML = '<i class="fas fa-check"></i>';
                label.classList.add('done');
            } else if (i === stepNum) {
                circle.classList.add('active');
                circle.textContent = i;
                label.classList.add('active');
            } else {
                circle.textContent = i;
            }
        }

        var fillA = document.getElementById('wzLineA_fill');
        var fillB = document.getElementById('wzLineB_fill');
        if (fillA) {
            fillA.className = 'wiz-step-line-fill';
            if (stepNum > 1) fillA.classList.add('full');
            else if (stepNum === 1) fillA.classList.add('half');
        }
        if (fillB) {
            fillB.className = 'wiz-step-line-fill';
            if (stepNum > 2) fillB.classList.add('full');
            else if (stepNum === 2) fillB.classList.add('half');
        }
    };

    window.startCreatorWizard = async function(overridePlat) {
        var rawInput = (document.getElementById('wizUrlInput') || {}).value || '';
        rawInput = rawInput.trim();
        if (!rawInput) {
            alert('Please enter a social media URL or @username');
            return;
        }

        var statusEl = document.getElementById('wizStatus');
        var bodyEl = document.getElementById('wizBody');
        var btn = document.getElementById('btnWizStart');

        var isFullUrl = rawInput.startsWith('http://') || rawInput.startsWith('https://') || /^(payhip|boosty|patreon|linktr|guns|beacons|tiktok|instagram|youtube|twitter|x)\./i.test(rawInput);

        if (!isFullUrl && !overridePlat) {
            var cleanHandle = rawInput.replace(/^@/, '');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.className = 'wiz-status scanning';
                statusEl.innerHTML = '<i class="fas fa-layer-group"></i> <div><h4>Select Platform</h4><p>Where can we find <strong>@' + cleanHandle + '</strong>?</p></div>';
            }

            var platPickerHtml = '<div class="wiz-platform-grid">' +
                '<div class="wiz-platform-card" onclick="startCreatorWizard(\'tiktok\')">' +
                '<div class="wiz-plat-icon tt"><i class="fab fa-tiktok"></i></div>' +
                '<div class="wiz-plat-info"><strong>TikTok</strong><span>tiktok.com/@' + cleanHandle + '</span></div>' +
                '</div>' +
                '<div class="wiz-platform-card" onclick="startCreatorWizard(\'instagram\')">' +
                '<div class="wiz-plat-icon ig"><i class="fab fa-instagram"></i></div>' +
                '<div class="wiz-plat-info"><strong>Instagram</strong><span>instagram.com/' + cleanHandle + '</span></div>' +
                '</div>' +
                '<div class="wiz-platform-card" onclick="startCreatorWizard(\'youtube\')">' +
                '<div class="wiz-plat-icon yt"><i class="fab fa-youtube"></i></div>' +
                '<div class="wiz-plat-info"><strong>YouTube</strong><span>youtube.com/@' + cleanHandle + '</span></div>' +
                '</div>' +
                '<div class="wiz-platform-card" onclick="startCreatorWizard(\'twitter\')">' +
                '<div class="wiz-plat-icon x"><i class="fab fa-x-twitter"></i></div>' +
                '<div class="wiz-plat-info"><strong>X / Twitter</strong><span>x.com/' + cleanHandle + '</span></div>' +
                '</div>' +
                '</div>';

            if (bodyEl) bodyEl.innerHTML = platPickerHtml;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-bolt"></i> Scan Profile';
            }
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }
        if (statusEl) {
            statusEl.style.display = 'block';
        }
        if (bodyEl) bodyEl.innerHTML = '';

        var socialUrl = rawInput;
        if (!isFullUrl) {
            var handle = rawInput.replace(/^@/, '');
            var selectedPlat = overridePlat || window.selectedPlatform || 'tiktok';
            if (selectedPlat === 'instagram') socialUrl = 'https://www.instagram.com/' + handle;
            else if (selectedPlat === 'youtube') socialUrl = 'https://www.youtube.com/@' + handle;
            else if (selectedPlat === 'twitter' || selectedPlat === 'x') socialUrl = 'https://x.com/' + handle;
            else socialUrl = 'https://www.tiktok.com/@' + handle;
        }   

        // Direct Payhip / Boosty Product Link
        if (socialUrl.includes('payhip.com/b/') || socialUrl.includes('boosty.to/p/')) {
            window.setWizStep(1);
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.className = 'wiz-status scanning';
                statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <div><h4>Scraping Product Page</h4><p>Fetching title, price, description &amp; images...</p></div>';
            }

            var prodUrlInput = document.getElementById('modalProductUrl');
            if (prodUrlInput) prodUrlInput.value = socialUrl;
            if (typeof window.handleProductUrlBlur === 'function') {
                await window.handleProductUrlBlur(socialUrl);
            }

            if (bodyEl) {
                bodyEl.innerHTML = '<div class="wiz-status success"><i class="fas fa-check-circle"></i> <div><h4>Product Auto-Filled!</h4><p>Title, price &amp; thumbnail have been populated in the request form.</p></div></div>';
            }
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-rotate"></i> Re-Scan';
            }
            setTimeout(window.closeCreatorWizard, 1200);
            return;
        }

        // Step 1: Resolve avatar & name
        window.setWizStep(1);
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.className = 'wiz-status scanning';
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <div><h4>Step 1: Resolving Profile</h4><p>Fetching creator name &amp; avatar...</p></div>';
        }

        let profileData = null;
        try {
            var r1 = await fetch('/api/hlx/resolve?url=' + encodeURIComponent(socialUrl), { credentials: 'include' });
            profileData = await r1.json();
        } catch(e) {}

        var cleanUserFallback = rawInput.replace(/^@/, '').split('?')[0].replace(/\/$/, '').split('/').pop();
        var creatorName = (profileData && profileData.nickname) || cleanUserFallback;
        if (!creatorName || creatorName.toLowerCase() === 'instagram' || creatorName.toLowerCase().includes('instagram') || creatorName.toLowerCase() === 'tiktok' || creatorName.toLowerCase() === 'youtube') {
            creatorName = cleanUserFallback;
        }
        var creatorAv = (profileData && profileData.avatar) || '';
        var creatorPlat = (profileData && profileData.platform) || '';

        // Fill form fields
        var elCu = document.getElementById('modalCreatorUrl');
        if (elCu) elCu.value = socialUrl;
        var elCn = document.getElementById('modalCreatorName');
        if (elCn) elCn.value = creatorName;
        var elCa = document.getElementById('modalCreatorAvatar');
        if (elCa && creatorAv) elCa.value = creatorAv;
        var elCp = document.getElementById('modalCreatorPlatform');
        if (elCp && creatorPlat) elCp.value = creatorPlat;

        // Update live badge in modal
        var badge = document.getElementById('creatorLiveBadge');
        if (badge) badge.style.display = 'flex';
        var badgeAv = document.getElementById('badgeAvatar');
        if (badgeAv && creatorAv) badgeAv.src = creatorAv;
        var badgeTitle = document.getElementById('badgeTitle');
        if (badgeTitle) badgeTitle.textContent = creatorName;
        var badgeUrl = document.getElementById('badgeUrl');
        if (badgeUrl) badgeUrl.textContent = socialUrl;
        var badgeStatus = document.getElementById('badgeStatus');
        if (badgeStatus) {
            badgeStatus.innerHTML = '<i class="fas fa-check-circle"></i> Profile Set';
            badgeStatus.style.color = '#00e676';
            badgeStatus.style.background = 'rgba(0,200,100,0.1)';
            badgeStatus.style.borderColor = 'rgba(0,200,100,0.2)';
        }

        // Render creator card in wizard
        var cardHtml = '<div class="wiz-creator-card">';
        if (creatorAv) {
            cardHtml += '<img src="' + creatorAv + '" alt="" referrerpolicy="no-referrer">';
        } else {
            cardHtml += '<div class="wiz-cc-avatar-placeholder"><i class="fas fa-user"></i></div>';
        }
        cardHtml += '<div class="wiz-cc-info">';
        cardHtml += '<div class="wiz-cc-name">' + creatorName + '</div>';
        cardHtml += '<div class="wiz-cc-url">' + socialUrl + '</div>';
        cardHtml += '</div>';
        cardHtml += '<div class="wiz-cc-badge ok"><i class="fas fa-check-circle"></i> Profile Set</div>';
        cardHtml += '</div>';
        if (bodyEl) bodyEl.innerHTML = cardHtml;

        // Step 2: Scan links (bio + aggregators)
        window.setWizStep(2);
        if (statusEl) {
            statusEl.className = 'wiz-status scanning';
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <div><h4>Step 2: Scanning Profile Links</h4><p>Checking bio, Linktree, Guns.lol &amp; more for stores...</p></div>';
        }

        let scanData = null;
        try {
            var r2 = await fetch('/api/scan-creator-links?url=' + encodeURIComponent(socialUrl));
            scanData = await r2.json();
        } catch(e) {}

        if (scanData && scanData.success && scanData.found && scanData.storeUrl) {
            var storeUrl = scanData.storeUrl;
            var platformName = scanData.platform === 'boosty' ? 'Boosty' : scanData.platform === 'patreon' ? 'Patreon' : 'Payhip';

            if (statusEl) {
                statusEl.className = 'wiz-status success';
                statusEl.innerHTML = '<i class="fas fa-store"></i> <div><h4>' + platformName + ' Store Found!</h4><p><strong>' + storeUrl + '</strong></p></div>';
            }

            var storeCardHtml = '<div class="wiz-store-card">';
            storeCardHtml += '<div class="wiz-store-icon"><i class="fas fa-store"></i></div>';
            storeCardHtml += '<div style="flex:1;min-width:0;">';
            storeCardHtml += '<div style="font-size:0.88rem;font-weight:800;color:#fff;">' + platformName + ' Store</div>';
            storeCardHtml += '<div style="font-size:0.72rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + storeUrl + '</div>';
            storeCardHtml += '</div>';
            storeCardHtml += '<span class="wiz-cc-badge ok"><i class="fas fa-check-circle"></i> Connected</span>';
            storeCardHtml += '</div>';
            if (bodyEl) bodyEl.innerHTML += storeCardHtml;

            var prods = scanData.products || [];
            if (prods.length === 0 && storeUrl) {
                try {
                    var storeScanResp = await fetch('/api/scan-creator-links?url=' + encodeURIComponent(storeUrl));
                    var storeScanData = await storeScanResp.json();
                    if (storeScanData && storeScanData.products && storeScanData.products.length > 0) {
                        prods = storeScanData.products;
                    }
                } catch(e) {}
            }

            if (prods.length > 0) {
                window.setWizStep(3);
                window.initWizProductPagination(prods);
            } else {
                if (bodyEl) {
                    bodyEl.innerHTML += '<div class="wiz-status warning" style="margin-top:10px;">' +
                        '<i class="fas fa-info-circle"></i> <div><h4>Store Detected — No Products Listed</h4><p>Found <strong>' + storeUrl + '</strong> but could not list products. Paste a direct product link:</p></div>' +
                        '</div>' +
                        '<div class="wiz-input-row" style="margin-top:8px;">' +
                        '<input type="url" id="directProdLinkInput" placeholder="https://payhip.com/b/xxxxx">' +
                        '<button type="button" class="wiz-btn wiz-btn-primary wiz-btn-sm" onclick="confirmDirectProductLink()"><i class="fas fa-check"></i> Set</button>' +
                        '</div>';
                }
            }
        } else {
            if (statusEl) {
                statusEl.className = 'wiz-status warning';
                statusEl.innerHTML = '<i class="fas fa-search"></i> <div><h4>No Store Found in Bio</h4><p>No Payhip / Boosty / Patreon link was detected automatically.</p></div>';
            }

            var manualHtml = '<div class="wiz-manual-section">' +
                '<label><i class="fas fa-link"></i> Enter Store or Product URL</label>' +
                '<div class="wiz-input-row">' +
                '<input type="url" id="manualStoreInput" placeholder="https://payhip.com/yourname or /b/xxxxx">' +
                '<button type="button" class="wiz-btn wiz-btn-primary wiz-btn-sm" onclick="scanManualStore()"><i class="fas fa-magic"></i> Load</button>' +
                '</div>' +
                '</div>';
            if (bodyEl) bodyEl.innerHTML = (bodyEl.innerHTML || '') + manualHtml;
        }

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-rotate"></i> Re-Scan';
        }
    };

    window.scanManualStore = async function() {
        var urlInput = document.getElementById('manualStoreInput');
        if (!urlInput || !urlInput.value.trim()) {
            alert('Please enter a Payhip / Store URL');
            return;
        }
        var storeUrl = urlInput.value.trim();

        var statusEl = document.getElementById('wizStatus');
        var bodyEl = document.getElementById('wizBody');

        if (storeUrl.includes('/b/')) {
            var modalProd = document.getElementById('modalProductUrl');
            if (modalProd) modalProd.value = storeUrl;
            if (typeof window.handleProductUrlBlur === 'function') {
                await window.handleProductUrlBlur(storeUrl);
            }
            window.closeCreatorWizard();
            return;
        }

        if (statusEl) {
            statusEl.className = 'wiz-status scanning';
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <div><h4>Scanning Store Products</h4><p>Fetching catalog from ' + storeUrl + '</p></div>';
        }

        try {
            var r = await fetch('/api/scan-creator-links?url=' + encodeURIComponent(storeUrl));
            var scanData = await r.json();
            if (scanData && scanData.products && scanData.products.length > 0) {
                window.setWizStep(3);
                window.initWizProductPagination(scanData.products);

                if (statusEl) {
                    statusEl.className = 'wiz-status success';
                    statusEl.innerHTML = '<i class="fas fa-check-circle"></i> <div><h4>Products Loaded!</h4><p>Click any product below to auto-fill the request form.</p></div>';
                }
            } else {
                if (statusEl) {
                    statusEl.className = 'wiz-status warning';
                    statusEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> <div><h4>No Products Found</h4><p>Could not load products. Paste a direct product link:</p></div>';
                }
                if (bodyEl) {
                    bodyEl.innerHTML = '<div class="wiz-input-row" style="margin-top:10px;">' +
                        '<input type="url" id="directProdLinkInput" placeholder="https://payhip.com/b/xxxxx">' +
                        '<button type="button" class="wiz-btn wiz-btn-primary wiz-btn-sm" onclick="confirmDirectProductLink()"><i class="fas fa-check"></i> Set</button>' +
                        '</div>';
                }
            }
        } catch(e) {
            alert('Failed to scan store');
        }
    };

    window.confirmDirectProductLink = async function() {
        var inp = document.getElementById('directProdLinkInput');
        if (!inp || !inp.value.trim()) {
            alert('Please enter a valid product link');
            return;
        }
        var prodUrl = inp.value.trim();
        var mp = document.getElementById('modalProductUrl');
        if (mp) mp.value = prodUrl;
        if (typeof window.handleProductUrlBlur === 'function') {
            await window.handleProductUrlBlur(prodUrl);
        }
        window.closeCreatorWizard();
    };

    window.initWizProductPagination = function(prods, preservePage) {
        window.scannedProducts = prods || [];
        if (!preservePage && typeof window.wizProdPage !== 'number') {
            window.wizProdPage = 1;
            window.wizSearchQuery = '';
        }
        window.renderWizProductsContainer();
    };

    window.filterWizProducts = function(query) {
        var newQuery = (query || '').trim().toLowerCase();
        if (newQuery === (window.wizSearchQuery || '')) return;
        window.wizSearchQuery = newQuery;
        window.wizProdPage = 1;
        var clearBtn = document.getElementById('wizClearSearchBtn');
        if (clearBtn) clearBtn.style.display = window.wizSearchQuery ? 'inline-flex' : 'none';
        window.renderWizProductsGrid();
    };

    window.clearWizSearch = function() {
        var inp = document.getElementById('wizSearchInput');
        if (inp) inp.value = '';
        window.wizSearchQuery = '';
        window.wizProdPage = 1;
        var clearBtn = document.getElementById('wizClearSearchBtn');
        if (clearBtn) clearBtn.style.display = 'none';
        window.renderWizProductsGrid();
    };

    window.changeWizPage = function(delta) {
        if (window.event) {
            try {
                window.event.preventDefault();
                window.event.stopPropagation();
            } catch(e) {}
        }
        var curr = parseInt(window.wizProdPage, 10) || 1;
        var targetPage = curr + delta;
        if (targetPage < 1) targetPage = 1;
        window.wizProdPage = targetPage;
        window.renderWizProductsGrid();
        var gridEl = document.getElementById('wizProductGridSelect');
        if (gridEl) gridEl.scrollTop = 0;
    };

    window.renderWizProductsContainer = function() {
        var bodyEl = document.getElementById('wizBody');
        if (!bodyEl) return;

        if (document.getElementById('wizProductGridSelect')) {
            window.renderWizProductsGrid();
            return;
        }

        var sectionHtml = '<div style="margin-top:6px;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
            '<div class="wiz-section-title"><i class="fas fa-store"></i> Select Store Product</div>' +
            '<span id="wizProdCountBadge" class="wiz-count-badge"></span>' +
            '</div>' +
            '<div class="wiz-search-wrap">' +
            '<i class="fas fa-search" style="color:var(--muted);font-size:0.85rem;flex-shrink:0;"></i>' +
            '<input type="text" id="wizSearchInput" placeholder="Search products..." oninput="filterWizProducts(this.value)">' +
            '<button type="button" id="wizClearSearchBtn" onclick="clearWizSearch()" class="wiz-search-clear"><i class="fas fa-times-circle"></i></button>' +
            '</div>' +
            '</div>' +
            '<div id="wizProductGridSelect" class="wiz-product-grid"></div>' +
            '<div id="wizPaginationBar" class="wiz-pagination"></div>';

        bodyEl.innerHTML += sectionHtml;
        window.renderWizProductsGrid();
    };

    window.renderWizProductsGrid = function() {
        var gridEl = document.getElementById('wizProductGridSelect');
        var pagEl = document.getElementById('wizPaginationBar');
        var badgeEl = document.getElementById('wizProdCountBadge');
        if (!gridEl) return;

        var all = window.scannedProducts || [];
        var q = window.wizSearchQuery || '';

        var filtered = all.filter(function(p, origIdx) {
            p._origIdx = origIdx;
            if (!q) return true;
            var t = (p.title || '').toLowerCase();
            var u = (p.url || '').toLowerCase();
            return t.includes(q) || u.includes(q);
        });

        var total = filtered.length;
        var pageSize = 6;
        var totalPages = Math.ceil(total / pageSize) || 1;

        var reqPage = parseInt(window.wizProdPage, 10);
        if (isNaN(reqPage) || reqPage < 1) reqPage = 1;
        if (reqPage > totalPages) reqPage = totalPages;
        window.wizProdPage = reqPage;

        var currentPage = window.wizProdPage;
        var startIdx = (currentPage - 1) * pageSize;
        var endIdx = Math.min(startIdx + pageSize, total);
        var pageItems = filtered.slice(startIdx, endIdx);

        if (badgeEl) {
            if (total === 0) badgeEl.textContent = 'No products found';
            else badgeEl.textContent = 'Showing ' + (startIdx + 1) + '-' + endIdx + ' of ' + total + (q ? ' (filtered)' : '');
        }

        if (pageItems.length === 0) {
            gridEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px 16px;color:var(--muted);font-size:0.82rem;">' +
                '<i class="fas fa-search" style="font-size:2rem;margin-bottom:10px;display:block;opacity:0.3;"></i>' +
                'No products matching &quot;' + q + '&quot;</div>';
        } else {
            var cardHtml = '';
            pageItems.forEach(function(prod) {
                var idx = prod._origIdx;
                var cardTitle = (prod.title && prod.title !== 'Product') ? prod.title : ('Product #' + (idx + 1) + (prod.url ? ' (' + prod.url.split('/').pop() + ')' : ''));
                cardHtml += '<div class="wiz-product-card" data-orig-idx="' + idx + '" onclick="selectWizProduct(' + idx + ')">';
                cardHtml += '<div class="wiz-product-img-wrap">';
                if (prod.image) {
                    cardHtml += '<img src="' + prod.image + '" referrerpolicy="no-referrer" loading="lazy" alt="">';
                } else {
                    cardHtml += '<div class="wiz-product-img-placeholder"><i class="fas fa-box"></i></div>';
                }
                cardHtml += '</div>';
                cardHtml += '<div class="wiz-product-body">';
                cardHtml += '<div class="wiz-product-title">' + cardTitle + '</div>';
                if (prod.price) cardHtml += '<div class="wiz-product-price">' + prod.price + '</div>';
                cardHtml += '<div class="wiz-product-select-bar"><i class="fas fa-check-circle"></i> Select Product</div>';
                cardHtml += '</div>';
                cardHtml += '</div>';
            });
            gridEl.innerHTML = cardHtml;
        }

        if (pagEl) {
            if (totalPages <= 1) {
                pagEl.style.display = 'none';
            } else {
                pagEl.style.display = 'flex';
                var pagHtml = '<button type="button" class="wiz-page-btn" onclick="changeWizPage(-1)" ' + (currentPage <= 1 ? 'disabled' : '') + '><i class="fas fa-chevron-left"></i> Prev</button>';
                pagHtml += '<span class="wiz-page-info">Page <strong style="color:#fff">' + currentPage + '</strong> of ' + totalPages + '</span>';
                pagHtml += '<button type="button" class="wiz-page-btn" onclick="changeWizPage(1)" ' + (currentPage >= totalPages ? 'disabled' : '') + '>Next <i class="fas fa-chevron-right"></i></button>';
                pagEl.innerHTML = pagHtml;
            }
        }

        window.enrichWizardProductCards();
    };

    window.enrichWizardProductCards = async function() {
        if (!window.scannedProducts || !window.scannedProducts.length) return;
        var prods = window.scannedProducts;
        for (var idx = 0; idx < prods.length; idx++) {
            var prod = prods[idx];
            if (!prod.title || prod.title === 'Product' || prod.title === 'Patreon Post' || prod.title.indexOf('Post #') === 0 || !prod.image) {
                try {
                    var r = await fetch('/api/scrape?url=' + encodeURIComponent(prod.url));
                    var data = await r.json();
                    if (data && data.success) {
                        if (data.title) prod.title = data.title;
                        if (data.image || (data.thumbnails && data.thumbnails[0])) prod.image = data.image || data.thumbnails[0];
                        if (data.price) prod.price = data.price;
                        
                        var cardEl = document.querySelector('#wizProductGridSelect .wiz-product-card[data-orig-idx="' + idx + '"]');
                        if (cardEl) {
                            var titleEl = cardEl.querySelector('.wiz-product-title');
                            if (titleEl && data.title) titleEl.textContent = data.title;
                            var priceEl = cardEl.querySelector('.wiz-product-price');
                            if (priceEl && data.price) {
                                priceEl.textContent = data.price;
                            } else if (!priceEl && data.price) {
                                var newPrice = document.createElement('div');
                                newPrice.className = 'wiz-product-price';
                                newPrice.textContent = data.price;
                                var bEl = cardEl.querySelector('.wiz-product-body');
                                if (bEl) {
                                    var selectBar = bEl.querySelector('.wiz-product-select-bar');
                                    if (selectBar) bEl.insertBefore(newPrice, selectBar);
                                    else bEl.appendChild(newPrice);
                                }
                            }
                            var imgWrap = cardEl.querySelector('.wiz-product-img-wrap');
                            if (imgWrap && (data.image || (data.thumbnails && data.thumbnails[0]))) {
                                var imgUrl = data.image || data.thumbnails[0];
                                var existingImg = imgWrap.querySelector('img');
                                if (existingImg) {
                                    existingImg.setAttribute('referrerpolicy', 'no-referrer');
                                    existingImg.src = imgUrl;
                                } else {
                                    imgWrap.innerHTML = '<img src="' + imgUrl + '" referrerpolicy="no-referrer" alt="">';
                                }
                            }
                        }
                    }
                } catch(e) {}
            }
        }
    };

    window.selectWizProduct = async function(idx) {
        if (!window.scannedProducts || !window.scannedProducts[idx]) return;
        var prod = window.scannedProducts[idx];
        
        var elPu = document.getElementById('modalProductUrl');
        if (elPu && prod.url) elPu.value = prod.url;
        var elT = document.getElementById('modalTitle');
        if (elT && prod.title && prod.title !== 'Product') elT.value = prod.title;
        var elPr = document.getElementById('modalPrice');
        if (elPr && prod.price) elPr.value = prod.price;
        var elTh = document.getElementById('modalThumbnail');
        if (elTh && prod.image) elTh.value = prod.image;

        var prev = document.getElementById('lookupPreview');
        if (prev) {
            prev.style.display = 'flex';
            var pt = document.getElementById('previewThumb');
            if (pt && prod.image) pt.src = prod.image;
            var ptitle = document.getElementById('previewTitle');
            if (ptitle && prod.title) ptitle.textContent = prod.title;
            var pc = document.getElementById('previewCreator');
            if (pc) pc.textContent = (document.getElementById('modalCreatorName') || {}).value || 'Creator';
            var pp = document.getElementById('previewPrice');
            if (pp) pp.textContent = prod.price || 'Free';
        }

        var modalContainer = document.getElementById('wizModalContainer');
        if (modalContainer) {
            var children = modalContainer.children;
            for (var i = 0; i < children.length; i++) {
                if (children[i].id !== 'wizCheckOverlay') {
                    children[i].classList.add('wiz-content-lift');
                }
            }

            var overlay = document.createElement('div');
            overlay.className = 'wiz-check-overlay';
            overlay.id = 'wizCheckOverlay';
            overlay.innerHTML = '<div class="wiz-check-circle"><i class="fas fa-check"></i></div>' +
                '<div style="font-size:1.1rem;font-weight:800;color:#fff;text-align:center;">Product Selected!</div>' +
                '<div style="font-size:0.78rem;color:rgba(255,255,255,0.6);max-width:280px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (prod.title || 'Auto-filling details...') + '</div>';
            modalContainer.appendChild(overlay);
        }

        if (prod.url && typeof window.handleProductUrlBlur === 'function') {
            window.handleProductUrlBlur(prod.url);
        }
        
        setTimeout(function() {
            window.closeCreatorWizard();
        }, 900);
    };
    window.openCreatorWizard = window.execOpenCreatorWizard;

    console.log('[ChunkStore] Wizard chunk loaded.');
})(window);

