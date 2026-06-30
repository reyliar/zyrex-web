
    /* ===================== PRODUCT PAGE RENDER ===================== */
    document.addEventListener('DOMContentLoaded', async () => {
        const params = new URLSearchParams(window.location.search);
        const productId = params.get('id');

        const container = document.getElementById('productContainer');
        const loading = document.getElementById('productLoading');

        if (!productId) {
            showError("Product ID missing");
            return;
        }

        let product = null;
        let isDbProduct = false;

        // 1. Try to fetch from backend database first
        try {
            const resp = await fetch(`/api/products?id=${productId}`);
            if (resp.ok) {
                const dbProduct = await resp.json();
                if (dbProduct && dbProduct.id) {
                    product = dbProduct;
                    isDbProduct = true;
                }
            }
        } catch(e) {
            console.warn("Could not load product from DB:", e);
        }

        // 2. Fallback to local static arrays
        if (!product) {
            product = window.pluginsData ? window.pluginsData.find(p => p.id === productId) : null;
            if (!product) {
                product = window.presetsData ? window.presetsData.find(p => p.id === productId) : null;
            }
            // 3. Fallback to newly published products (from admin-upload)
            if (!product) {
                try {
                    const newProducts = JSON.parse(localStorage.getItem('zyrex_new_products') || '[]');
                    product = newProducts.find(p => p.id === productId);
                    if (product) isDbProduct = false; // local product, mark as non-DB
                } catch(e) {}
            }
        }

        if (!product) {
            showError("Product not found");
            return;
        }

        // Apply any local edits from admin
        try {
            const edits = JSON.parse(localStorage.getItem('zyrex_edited_products') || '{}');
            if (edits[productId]) {
                const e = edits[productId];
                product.name = e.name || product.name;
                product.type = e.type || product.type;
                product.category = e.category || product.category;
                product.platform = e.platform || product.platform;
                product.description = e.description || product.description;
                product.desc = e.description || product.desc;
                product.password = e.password !== undefined ? e.password : product.password;
                product.links = e.links || product.links;
                product.notes = e.notes || product.notes;
            }
        } catch(e) {}

        renderProductDetail(product, isDbProduct);

        // â”€â”€ ADMIN CONTROLS â”€â”€
        let currentUser = null;
        try {
            const meResp = await fetch('/api/me', { credentials: 'include' });
            if (meResp.ok) currentUser = await meResp.json();
        } catch(e) {}

        if (currentUser && currentUser.is_admin && productId) {
            const adminBar = document.createElement('div');
            adminBar.className = 'admin-bar';
            adminBar.innerHTML = `
                <button class="btn-admin btn-admin-edit" onclick="openEditModal()"><i class="fas fa-pen"></i> Edit</button>
                <button class="btn-admin btn-admin-delete" onclick="confirmDelete()"><i class="fas fa-trash"></i> Delete</button>
            `;
            container.appendChild(adminBar);

            window._productData = { product, isDbProduct, productId };

            // Edit modal
            window.openEditModal = function() {
                const p = window._productData.product;
                const modal = document.createElement('div');
                modal.className = 'admin-modal-overlay';
                modal.id = 'editModal';
                modal.innerHTML = `
                    <div class="admin-modal">
                        <h3><i class="fas fa-pen" style="color:#ffb400"></i> Edit Product</h3>
                        <div class="form-group"><label>Name</label><input id="edName" value="${(p.name||'').replace(/"/g,'&quot;')}"></div>
                        <div class="form-group"><label>Category</label><select id="edCat">
                            <option value="software" ${p.category==='software'?'selected':''}>Software</option>
                            <option value="after-effects" ${p.category==='after-effects'?'selected':''}>After Effects Plugin</option>
                            <option value="premiere-pro" ${p.category==='premiere-pro'?'selected':''}>Premiere Pro Plugin</option>
                            <option value="photoshop" ${p.category==='photoshop'?'selected':''}>Photoshop Plugin</option>
                            <option value="others" ${p.category==='others'?'selected':''}>Other</option>
                        </select></div>
                        <div class="form-group"><label>Platform</label><select id="edPlat">
                            <option value="win" ${p.platform==='win'?'selected':''}>Windows</option>
                            <option value="mac" ${p.platform==='mac'?'selected':''}>Mac</option>
                            <option value="both" ${p.platform==='both'?'selected':''}>Both</option>
                        </select></div>
                        <div class="form-group"><label>Description</label><textarea id="edDesc">${(p.desc||p.description||'').replace(/"/g,'&quot;')}</textarea></div>
                        <div class="form-group"><label>ZIP Password</label><input id="edPw" value="${p.password||''}"></div>
                        <div class="form-group"><label>Download URL</label><input id="edUrl" value="${(p.links&&p.links[0]?p.links[0].url:p.downloadUrl||'')}"></div>
                        <div class="form-group"><label>Notes</label><input id="edNotes" value="${(p.notes||'').replace(/"/g,'&quot;')}"></div>
                        <div style="display:flex;gap:10px;margin-top:20px">
                            <button class="btn-admin btn-admin-edit" style="flex:1;justify-content:center" onclick="submitEdit()"><i class="fas fa-save"></i> Save Changes</button>
                            <button class="btn-admin btn-admin-delete" style="flex:1;justify-content:center" onclick="document.getElementById('editModal').remove()"><i class="fas fa-times"></i> Cancel</button>
                        </div>
                    </div>`;
                document.body.appendChild(modal);
                modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
            };

            window.submitEdit = async function() {
                const p = window._productData.product;
                const data = {
                    id: productId,
                    name: document.getElementById('edName').value.trim(),
                    type: p.type || 'plugin',
                    category: document.getElementById('edCat').value,
                    platform: document.getElementById('edPlat').value,
                    description: document.getElementById('edDesc').value.trim(),
                    password: document.getElementById('edPw').value.trim() || (p.password || null),
                    links: [{ url: document.getElementById('edUrl').value.trim(), label: 'Download' }],
                    notes: document.getElementById('edNotes').value.trim() || null
                };
                try {
                    const resp = await fetch(`/api/products/edit/${productId}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data), credentials: 'include'
                    });
                    if (resp.ok) {
                        // Persist edit to localStorage so it survives static JS reload
                        try {
                            const key = 'zyrex_edited_products';
                            const edits = JSON.parse(localStorage.getItem(key) || '{}');
                            edits[productId] = data;
                            localStorage.setItem(key, JSON.stringify(edits));
                        } catch(e) {}
                        alert('Updated! Reloading...'); location.reload();
                    }
                    else alert('Update failed: ' + (await resp.text()));
                } catch(e) { alert('Error: ' + e.message); }
            };

            window.confirmDelete = function() {
                if (confirm('Delete "' + product.name + '"? This cannot be undone.')) {
                    fetch('/api/products/delete', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: productId }), credentials: 'include'
                    }).then(r => {
                        if (r.ok) {
                            // Persist deletion in localStorage so it survives static data reloads
                            try {
                                const key = 'zyrex_deleted_products';
                                const ids = JSON.parse(localStorage.getItem(key) || '[]');
                                if (!ids.includes(productId)) { ids.push(productId); localStorage.setItem(key, JSON.stringify(ids)); }
                            } catch(e) {}
                            alert('Deleted!');
                            location.href = 'resources';
                        } else alert('Delete failed');
                    });
                }
            };
        }

        function showError(msg) {
            loading.innerHTML = `
                <div class="product-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>${msg}</h3>
                    <p style="margin-top:10px;color:var(--gray-dark)">The requested product could not be loaded.</p>
                    <a href="resources" class="btn btn-primary" style="margin-top:20px;display:inline-flex">Back to Resources</a>
                </div>
            `;
        }

        function renderProductDetail(p, isDb) {
            let backLink = 'plugins';
            // Only DB presets go to resources
            if (isDb && p.type === 'preset') backLink = 'resources';
            // Non-DB products without type default to plugins
            if (!isDb && !p.type) backLink = 'plugins';

            const platformTags = [];
            if (p.platform === 'win' || p.platform === 'both') platformTags.push('<span class="tag-win"><i class="fab fa-windows"></i> WIN</span>');
            if (p.platform === 'mac' || p.platform === 'both') platformTags.push('<span class="tag-mac"><i class="fab fa-apple"></i> MAC</span>');

            const categoryLabels = {
                'software': 'Software',
                'adobe-plugins': 'Adobe Plugin',
                'ofx-plugins': 'OFX Plugin',
                'after-effects': 'After Effects',
                'premiere-pro': 'Premiere Pro',
                'photoshop': 'Photoshop',
                'video-star': 'Video Star',
                'topaz-labs': 'Topaz Labs',
                'others': 'Others'
            };

            const notesHtml = p.notes 
                ? `<div class="product-notes"><i class="fas fa-circle-info"></i> ${p.notes}</div>`
                : '';

            // Handle thumbnail
            let thumbHtml = '';
            if (p.thumbnail) {
                thumbHtml = `<img src="${p.thumbnail}" alt="" style="width:100%;height:100%;object-fit:cover">`;
            } else {
                const favicon = p.links && p.links[0]?.url 
                    ? `https://www.google.com/s2/favicons?domain=${new URL(p.links[0].url).hostname}&sz=64`
                    : '';
                thumbHtml = favicon 
                    ? `<img src="${favicon}" alt="" onerror="this.parentElement.innerHTML='<div class=\\'thumb-fallback\\'><i class=\\'fas fa-cube\\'></i></div>'">`
                    : `<div class="thumb-fallback"><i class="fas fa-cube"></i></div>`;
            }

            // Creator details (original preset author)
            const creatorNickname = p.creator_nickname || p.author_name || 'Zyrex';
            const creatorAvatarHtml = p.creator_avatar 
                ? `<img src="${p.creator_avatar}" style="width:100%;height:100%;object-fit:cover">` 
                : `<i class="fas fa-user" style="color:var(--light);font-size:1.4rem"></i>`;
            const creatorSocialHtml = p.creator_social_url 
                ? `<a href="${p.creator_social_url}" target="_blank" style="font-size:0.78rem;color:var(--cherry);text-decoration:underline;display:inline-flex;align-items:center;gap:4px;margin-top:2px"><i class="fas fa-external-link-alt" style="font-size:0.7rem"></i> View Profile</a>` 
                : '';

            // Uploader details (Discord user who leaked)
            const uploaderName = p.uploader_name || '';
            const uploaderAvatarUrl = p.uploader_avatar || '';
            const uploaderAvatarHtml = uploaderAvatarUrl
                ? `<img src="${uploaderAvatarUrl}" style="width:100%;height:100%;object-fit:cover">`
                : `<i class="fab fa-discord" style="color:var(--light);font-size:1.3rem"></i>`;

            // Build downloads block
            let dlHtml = '';
            if (isDb && p.file_path) {
                const filename = p.file_path.split('/').pop() || 'Download File';
                dlHtml = `
                    <a href="https://dl.zyrexediting.xyz/?id=${p.id}" target="_blank" rel="noopener" class="product-dl-btn" style="background:var(--gradient-accent) !important;border:1px solid rgba(var(--cherry-rgb),0.15) !important;box-shadow:0 4px 15px rgba(var(--cherry-rgb),0.35), inset 0 1px 1px rgba(var(--cherry-rgb),0.3) !important;">
                        <div class="dl-icon default" style="background:rgba(var(--cherry-rgb),0.1)">
                            <i class="fas fa-cloud-arrow-down" style="color:var(--light)"></i>
                        </div>
                        <div class="dl-info">
                            <strong style="color:var(--light)">Download ZIP / Resource</strong>
                            <span style="color:var(--gray)">${filename}</span>
                        </div>
                        <i class="fas fa-arrow-right dl-arrow" style="color:var(--light)"></i>
                    </a>
                `;
            } else if (p.links && p.links.length) {
                function getDlClass(label) {
                    const l = label.toLowerCase();
                    if (l.includes('pixel')) return 'pixeldrain';
                    if (l.includes('gofile') || l.includes('go')) return 'gofile';
                    if (l.includes('media')) return 'mediafire';
                    return 'default';
                }
                function getDlIcon(label) {
                    const l = label.toLowerCase();
                    if (l.includes('pixel')) return 'fa-cloud-arrow-down';
                    if (l.includes('gofile') || l.includes('go')) return 'fa-cloud';
                    if (l.includes('media')) return 'fa-file-zipper';
                    return 'fa-download';
                }
                dlHtml = p.links.map(link => `
                    <a href="${link.url}" target="_blank" rel="noopener" class="product-dl-btn">
                        <div class="dl-icon ${getDlClass(link.label)}">
                            <i class="fas ${getDlIcon(link.label)}"></i>
                        </div>
                        <div class="dl-info">
                            <strong>${link.label}</strong>
                            <span>${new URL(link.url).hostname}</span>
                        </div>
                        <i class="fas fa-arrow-right dl-arrow"></i>
                    </a>
                `).join('');
            } else {
                dlHtml = `<div style="color:var(--gray-dark);font-size:0.85rem">No download links available for this product.</div>`;
            }

            container.innerHTML = `
                <div style="max-width:960px;margin:0 auto">
                    <a href="${backLink}" class="product-back">
                        <i class="fas fa-arrow-left"></i> Back to ${backLink === 'plugins' ? 'Plugins' : 'Resources'}
                    </a>
                    
                    <div class="product-card glass-card-enhanced shimmer-sweep">
                        <!-- Left Column (Metadata) -->
                        <div class="product-left-col">
                            <div class="product-thumb-large">${thumbHtml}</div>
                            <div style="text-align:center">
                                <span class="product-category-badge">${categoryLabels[p.category] || p.category}</span>
                            </div>
                            
                            ${platformTags.length ? `
                            <div style="margin-top:10px">
                                <div style="font-size:0.75rem;font-weight:700;color:var(--gray-dark);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Compatibility</div>
                                <div class="product-platform-tags" style="justify-content:flex-start">${platformTags.join('')}</div>
                            </div>
                            ` : ''}
                            
                            <!-- Creator profile block -->
                            <div style="margin-top:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.05)">
                                <div style="font-size:0.75rem;font-weight:700;color:var(--gray-dark);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Developer</div>
                                <div style="display:flex;align-items:center;gap:12px">
                                    <div style="width:38px;height:38px;border-radius:50%;background:rgba(var(--cherry-rgb),0.15);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(var(--cherry-rgb),0.25)">
                                        ${creatorAvatarHtml}
                                    </div>
                                    <div style="min-width:0;flex:1">
                                        <strong style="font-size:0.88rem;color:var(--light);display:block">${creatorNickname}</strong>
                                        ${creatorSocialHtml}
                                    </div>
                                </div>
                            </div>

                            ${uploaderName ? `
                            <!-- Uploader profile block -->
                            <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05)">
                                <div style="font-size:0.75rem;font-weight:700;color:var(--gray-dark);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Shared by</div>
                                <div style="display:flex;align-items:center;gap:12px">
                                    <div style="width:38px;height:38px;border-radius:50%;background:rgba(88,101,242,0.08);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(88,101,242,0.15)">
                                        ${uploaderAvatarHtml}
                                    </div>
                                    <div style="min-width:0;flex:1">
                                        <strong style="font-size:0.85rem;color:var(--light);display:flex;align-items:center;gap:4px"><i class="fab fa-discord" style="color:#5865F2;font-size:0.75rem"></i> ${uploaderName}</strong>
                                    </div>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        
                        <!-- Right Column (Details & Download) -->
                        <div class="product-right-col">
                            <div>
                                <h1 style="font-size:2.2rem;font-weight:900;margin:0 0 10px;letter-spacing:-0.5px;line-height:1.2;color:#fff">${p.name}</h1>
                                ${p.description || p.desc ? `<p class="product-desc" style="font-size:0.92rem;line-height:1.6;color:var(--gray);margin:0">${p.description || p.desc}</p>` : ''}
                            </div>
                            
                            ${p.password ? `
                            <div style="display:flex;align-items:center;gap:15px;flex-wrap:wrap">
                                <div class="product-password-box" style="margin-bottom:0;padding:8px 18px">
                                    <i class="fas fa-lock"></i>
                                    <span>Zip Password:</span>
                                    <code onclick="navigator.clipboard.writeText('${p.password.replace(/'/g,"\\'")}');this.textContent='Copied!';setTimeout(()=>this.textContent='${p.password.replace(/'/g,"\\'")}',1500)">${p.password}</code>
                                </div>
                            </div>
                            ` : ''}
                            
                            ${notesHtml}
                            
                            <div style="margin-top:10px">
                                <div class="product-downloads-title" style="margin-bottom:12px"><i class="fas fa-cloud-arrow-down"></i> Installation Package</div>
                                <div class="product-downloads">
                                    ${dlHtml}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
