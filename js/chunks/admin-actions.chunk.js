/**
 * Zyrex Chunk Architecture — Admin Quick Actions Chunk
 * Dynamically loaded ONLY when an authenticated admin or uploader session is verified.
 * Keeps public pages lightweight and avoids exposing admin client code to regular visitors.
 */
(function(window) {
    'use strict';

    window.execQuickRejectRequest = async function(id) {
        if (!confirm('Mark this request as rejected? It will be removed from the community board.')) return;
        try {
            var resp = await fetch('/api/requests/' + id + '/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: 'rejected' })
            });
            var data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || 'Failed to reject');
            if (Array.isArray(window.currentRequests)) {
                window.currentRequests = window.currentRequests.filter(function(r) { return r.id !== id; });
            }
            if (typeof window.renderRequestsGrid === 'function') window.renderRequestsGrid();
            if (typeof window.fetchRequestsStats === 'function') window.fetchRequestsStats();
        } catch(e) {
            alert('Error: ' + e.message);
        }
    };
    window.quickRejectRequest = window.execQuickRejectRequest;

    window.execQuickDeleteRequest = async function(id) {
        if (!confirm('Permanently delete this request? This action cannot be undone.')) return;
        try {
            var resp = await fetch('/api/requests/' + id, {
                method: 'DELETE',
                credentials: 'include'
            });
            var data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || 'Failed to delete');
            if (Array.isArray(window.currentRequests)) {
                window.currentRequests = window.currentRequests.filter(function(r) { return r.id !== id; });
            }
            if (typeof window.renderRequestsGrid === 'function') window.renderRequestsGrid();
            if (typeof window.fetchRequestsStats === 'function') window.fetchRequestsStats();
        } catch(e) {
            alert('Error: ' + e.message);
        }
    };
    window.quickDeleteRequest = window.execQuickDeleteRequest;

    // Mark a request as completed, with optional resource URL input
    window.execQuickCompleteRequest = async function(id) {
        var req = Array.isArray(window.currentRequests) ? window.currentRequests.find(function(r) { return r.id === id; }) : null;

        // Build modal
        var modalId = 'adminCompleteModal_' + id;
        var existing = document.getElementById(modalId);
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = modalId;
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = `
            <div style="background:#0e0812;border:1px solid rgba(16,185,129,0.35);border-radius:20px;padding:28px;max-width:480px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,0.7);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                    <h3 style="margin:0;font-size:1.1rem;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px;"><i class="fas fa-circle-check" style="color:#34d399;"></i> Mark as Completed</h3>
                    <button onclick="document.getElementById('${modalId}').remove()" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.4rem;cursor:pointer;">&times;</button>
                </div>
                <p style="margin:0 0 16px;font-size:0.85rem;color:rgba(255,255,255,0.6);">Optionally enter the resource URL to link this request to a published resource.</p>
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <div>
                        <label style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;color:rgba(255,255,255,0.45);margin-bottom:5px;display:block;">Resource URL (optional)</label>
                        <input id="${modalId}_resourceUrl" type="text" placeholder="/resource?id=preset-abc123  or  https://..." value="${req && req.resource_url ? req.resource_url : ''}" style="width:100%;box-sizing:border-box;padding:9px 13px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-size:0.88rem;font-family:inherit;outline:none;">
                    </div>
                    <div>
                        <label style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;color:rgba(255,255,255,0.45);margin-bottom:5px;display:block;">Resource ID (optional)</label>
                        <input id="${modalId}_resourceId" type="text" placeholder="preset-abc123" value="${req && req.resource_id ? req.resource_id : ''}" style="width:100%;box-sizing:border-box;padding:9px 13px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-size:0.88rem;font-family:inherit;outline:none;">
                    </div>
                </div>
                <div id="${modalId}_err" style="display:none;margin-top:12px;padding:9px 13px;background:rgba(255,43,82,0.1);border:1px solid rgba(255,43,82,0.3);border-radius:9px;color:#ff6b87;font-size:0.83rem;"></div>
                <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
                    <button onclick="document.getElementById('${modalId}').remove()" style="padding:9px 18px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:rgba(255,255,255,0.6);font-size:0.86rem;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>
                    <button id="${modalId}_btn" onclick="window._doCompleteRequest('${id}','${modalId}')" style="padding:9px 22px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);border-radius:10px;color:#34d399;font-size:0.86rem;font-weight:700;cursor:pointer;font-family:inherit;"><i class="fas fa-check"></i> Confirm Complete</button>
                </div>
            </div>
        `;
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
        document.getElementById(modalId + '_resourceUrl').focus();
    };
    window.quickCompleteRequest = window.execQuickCompleteRequest;

    window._doCompleteRequest = async function(id, modalId) {
        var resourceUrl = (document.getElementById(modalId + '_resourceUrl') || {}).value || '';
        var resourceId = (document.getElementById(modalId + '_resourceId') || {}).value || '';
        var btn = document.getElementById(modalId + '_btn');
        var errEl = document.getElementById(modalId + '_err');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
        if (errEl) errEl.style.display = 'none';
        try {
            var body = { status: 'completed' };
            if (resourceUrl.trim()) body.resource_url = resourceUrl.trim();
            if (resourceId.trim()) body.resource_id = resourceId.trim();
            var resp = await fetch('/api/requests/' + id + '/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });
            var data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || 'Failed to complete');
            var overlay = document.getElementById(modalId);
            if (overlay) overlay.remove();
            // Update local state
            if (Array.isArray(window.currentRequests)) {
                var req = window.currentRequests.find(function(r) { return r.id === id; });
                if (req) {
                    req.status = 'completed';
                    if (data.request) Object.assign(req, data.request);
                    else {
                        if (body.resource_url) req.resource_url = body.resource_url;
                        if (body.resource_id) req.resource_id = body.resource_id;
                    }
                }
            }
            if (typeof window.renderRequestsGrid === 'function') window.renderRequestsGrid();
            if (typeof window.fetchRequestsStats === 'function') window.fetchRequestsStats();
        } catch(e) {
            if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirm Complete'; }
        }
    };

    // Edit request from board (opens inline edit modal)
    window.execQuickEditRequest = async function(id) {
        var req = Array.isArray(window.currentRequests) ? window.currentRequests.find(function(r) { return r.id === id; }) : null;
        if (!req) { alert('Request not found in current list.'); return; }

        var modalId = 'adminEditBoardModal_' + id;
        var existing = document.getElementById(modalId);
        if (existing) existing.remove();

        var typeOptions = ['preset','project-file','plugin','software','scenepack','other'].map(function(t) {
            return '<option value="' + t + '"' + (req.type === t || (t === 'project-file' && req.type === 'project_file') ? ' selected' : '') + '>' + t.replace('-',' ').replace(/\b\w/g, function(c){return c.toUpperCase();}) + '</option>';
        }).join('');
        var statusOptions = ['pending','in_progress','completed','rejected'].map(function(s) {
            return '<option value="' + s + '"' + (req.status === s ? ' selected' : '') + '>' + s.replace('_',' ').replace(/\b\w/g,function(c){return c.toUpperCase();}) + '</option>';
        }).join('');

        var overlay = document.createElement('div');
        overlay.id = modalId;
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = `
            <div style="background:#0e0812;border:1px solid rgba(255,43,82,0.3);border-radius:20px;padding:28px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,0.7);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                    <h3 style="margin:0;font-size:1.1rem;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px;"><i class="fas fa-edit" style="color:#ff4d6d;"></i> Edit Request</h3>
                    <button onclick="document.getElementById('${modalId}').remove()" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.4rem;cursor:pointer;">&times;</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <div><label style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;color:rgba(255,255,255,0.45);margin-bottom:5px;display:block;">Title *</label>
                        <input id="${modalId}_title" type="text" value="${(req.title||'').replace(/"/g,'&quot;')}" style="width:100%;box-sizing:border-box;padding:9px 13px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-size:0.88rem;font-family:inherit;outline:none;"></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div><label style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;color:rgba(255,255,255,0.45);margin-bottom:5px;display:block;">Type</label>
                            <select id="${modalId}_type" style="width:100%;box-sizing:border-box;padding:9px 13px;background:#1a0e22;border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-size:0.88rem;font-family:inherit;outline:none;">${typeOptions}</select></div>
                        <div><label style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;color:rgba(255,255,255,0.45);margin-bottom:5px;display:block;">Status</label>
                            <select id="${modalId}_status" style="width:100%;box-sizing:border-box;padding:9px 13px;background:#1a0e22;border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-size:0.88rem;font-family:inherit;outline:none;">${statusOptions}</select></div>
                    </div>
                    <div><label style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;color:rgba(255,255,255,0.45);margin-bottom:5px;display:block;">Description</label>
                        <textarea id="${modalId}_desc" rows="3" style="width:100%;box-sizing:border-box;padding:9px 13px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-size:0.88rem;font-family:inherit;outline:none;resize:vertical;">${(req.description||'').replace(/</g,'&lt;')}</textarea></div>
                    <div><label style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;color:rgba(255,255,255,0.45);margin-bottom:5px;display:block;">Price</label>
                        <input id="${modalId}_price" type="text" placeholder="e.g. $7.50 or Free" value="${(req.price||'').replace(/"/g,'&quot;')}" style="width:100%;box-sizing:border-box;padding:9px 13px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-size:0.88rem;font-family:inherit;outline:none;"></div>
                    <div><label style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;color:rgba(255,255,255,0.45);margin-bottom:5px;display:block;">Store URL</label>
                        <input id="${modalId}_productUrl" type="url" placeholder="https://..." value="${(req.product_url||'').replace(/"/g,'&quot;')}" style="width:100%;box-sizing:border-box;padding:9px 13px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-size:0.88rem;font-family:inherit;outline:none;"></div>
                    <div><label style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;color:rgba(255,255,255,0.45);margin-bottom:5px;display:block;">Resource URL (for completed)</label>
                        <input id="${modalId}_resourceUrl" type="text" placeholder="/resource?id=preset-abc123" value="${(req.resource_url||'').replace(/"/g,'&quot;')}" style="width:100%;box-sizing:border-box;padding:9px 13px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-size:0.88rem;font-family:inherit;outline:none;"></div>
                </div>
                <div id="${modalId}_err" style="display:none;margin-top:12px;padding:9px 13px;background:rgba(255,43,82,0.1);border:1px solid rgba(255,43,82,0.3);border-radius:9px;color:#ff6b87;font-size:0.83rem;"></div>
                <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
                    <button onclick="document.getElementById('${modalId}').remove()" style="padding:9px 18px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:rgba(255,255,255,0.6);font-size:0.86rem;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>
                    <button id="${modalId}_btn" onclick="window._doEditRequest('${id}','${modalId}')" style="padding:9px 22px;background:rgba(255,43,82,0.15);border:1px solid rgba(255,43,82,0.4);border-radius:10px;color:#ff6b87;font-size:0.86rem;font-weight:700;cursor:pointer;font-family:inherit;"><i class="fas fa-save"></i> Save Changes</button>
                </div>
            </div>
        `;
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    };
    window.quickEditRequest = window.execQuickEditRequest;

    window._doEditRequest = async function(id, modalId) {
        var btn = document.getElementById(modalId + '_btn');
        var errEl = document.getElementById(modalId + '_err');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
        if (errEl) errEl.style.display = 'none';
        try {
            var body = {
                title: (document.getElementById(modalId + '_title') || {}).value || '',
                type: (document.getElementById(modalId + '_type') || {}).value || 'other',
                status: (document.getElementById(modalId + '_status') || {}).value || 'pending',
                description: (document.getElementById(modalId + '_desc') || {}).value || '',
                price: (document.getElementById(modalId + '_price') || {}).value || '',
                product_url: (document.getElementById(modalId + '_productUrl') || {}).value || '',
                resource_url: (document.getElementById(modalId + '_resourceUrl') || {}).value || ''
            };
            if (!body.title.trim()) throw new Error('Title is required');
            var resp = await fetch('/api/requests/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });
            var data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || 'Save failed');
            var overlay = document.getElementById(modalId);
            if (overlay) overlay.remove();
            // Update local cache
            if (Array.isArray(window.currentRequests)) {
                var req = window.currentRequests.find(function(r) { return r.id === id; });
                if (req) Object.assign(req, body);
            }
            if (typeof window.renderRequestsGrid === 'function') window.renderRequestsGrid();
        } catch(e) {
            if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
        }
    };


    // =========================================================================
    // SYSTEM-WIDE DAILY QUOTA & DETAILED AUDIT TRACKING MODAL (ADMIN / UPLOADER)
    // =========================================================================
    var _adminTrackingActiveTab = 'users';

    window.execOpenAdminQuotaTracking = async function(targetDate) {
        var modalId = 'adminQuotaTrackingModal';
        var modalEl = document.getElementById(modalId);
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = modalId;
            modalEl.className = 'modal-overlay active';
            modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(5,2,8,0.85);backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';
            modalEl.onclick = function(e) {
                if (e.target === modalEl) modalEl.remove();
            };
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div style="background:#0f0914;border:1px solid rgba(255,43,82,0.3);border-radius:22px;width:100%;max-width:960px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 25px 60px rgba(0,0,0,0.8),0 0 40px rgba(255,43,82,0.15);color:#fff;overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif;">
                <div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;background:rgba(255,43,82,0.04);">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,43,82,0.15);border:1px solid rgba(255,43,82,0.3);display:flex;align-items:center;justify-content:center;color:#ff4d6d;font-size:1.1rem;">
                            <i class="fas fa-gauge-high"></i>
                        </div>
                        <div>
                            <h2 style="margin:0;font-size:1.25rem;font-weight:800;font-family:'Outfit',sans-serif;color:#fff;">Request Quotas & Audit Tracking</h2>
                            <p style="margin:2px 0 0;font-size:0.8rem;color:rgba(255,255,255,0.5);">User quotas, IP tracking, and live audit history (Max 3 requests/day)</p>
                        </div>
                    </div>
                    <button onclick="document.getElementById('${modalId}').remove()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.7);width:34px;height:34px;border-radius:10px;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;" onmouseover="this.style.color='#fff';this.style.background='rgba(255,43,82,0.2)'" onmouseout="this.style.color='rgba(255,255,255,0.7)';this.style.background='rgba(255,255,255,0.06)'">&times;</button>
                </div>
                <div id="adminTrackingContent" style="padding:24px;overflow-y:auto;flex:1;">
                    <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.5);">
                        <i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#ff2b52;margin-bottom:12px;"></i>
                        <div>Loading user quotas and system metrics...</div>
                    </div>
                </div>
            </div>
        `;

        try {
            var qUrl = '/api/requests/quota-tracking' + (targetDate ? ('?date=' + encodeURIComponent(targetDate)) : '');
            var resp = await fetch(qUrl, { credentials: 'include' });
            var data = await resp.json();

            if (!resp.ok || !data.success) {
                throw new Error(data.error || 'Failed to load data');
            }

            renderAdminTrackingView(data, modalId);
        } catch(err) {
            var c = document.getElementById('adminTrackingContent');
            if (c) {
                c.innerHTML = `
                    <div style="text-align:center;padding:30px;color:#f87171;">
                        <i class="fas fa-triangle-exclamation" style="font-size:2.2rem;margin-bottom:12px;"></i>
                        <div style="font-weight:700;margin-bottom:6px;">Authorization or Server Error</div>
                        <div style="font-size:0.85rem;color:rgba(255,255,255,0.6);">${err.message}</div>
                    </div>
                `;
            }
        }
    };

    function renderAdminTrackingView(data, modalId) {
        var c = document.getElementById('adminTrackingContent');
        if (!c) return;

        var sum = data.summary || { total_requests: 0, unique_users: 0, users_at_limit: 0 };
        var users = data.users || [];
        var audit = data.audit_log || [];
        var dates = data.available_dates || [data.date];

        var dateOptionsHtml = dates.map(function(d) {
            return `<option value="${d}" ${d === data.date ? 'selected' : ''}>${d} (UTC)</option>`;
        }).join('');

        var html = `
            <!-- Top Controls & Date Selector -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <label style="font-size:0.82rem;font-weight:700;color:rgba(255,255,255,0.7);"><i class="far fa-calendar"></i> Date:</label>
                    <select id="trackingDateSelector" onchange="window.openAdminQuotaTracking(this.value)" style="background:rgba(20,12,24,0.85);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:6px 14px;border-radius:10px;font-size:0.85rem;outline:none;">
                        ${dateOptionsHtml}
                    </select>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <button onclick="window.openAdminQuotaTracking('${data.date}')" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:6px 14px;border-radius:10px;font-size:0.82rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;"><i class="fas fa-rotate"></i> Refresh</button>
                </div>
            </div>

            <!-- Summary KPI Cards -->
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:14px;margin-bottom:24px;">
                <div style="background:rgba(255,43,82,0.06);border:1px solid rgba(255,43,82,0.22);border-radius:16px;padding:16px;text-align:center;">
                    <div style="font-size:1.8rem;font-weight:900;color:#ff4d6d;font-family:'Outfit',sans-serif;">${sum.total_requests}</div>
                    <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.5);font-weight:700;margin-top:4px;">Total Daily Requests</div>
                </div>
                <div style="background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.22);border-radius:16px;padding:16px;text-align:center;">
                    <div style="font-size:1.8rem;font-weight:900;color:#34d399;font-family:'Outfit',sans-serif;">${sum.unique_users}</div>
                    <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.5);font-weight:700;margin-top:4px;">Active Users</div>
                </div>
                <div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.22);border-radius:16px;padding:16px;text-align:center;">
                    <div style="font-size:1.8rem;font-weight:900;color:#fbbf24;font-family:'Outfit',sans-serif;">${sum.users_at_limit}</div>
                    <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.5);font-weight:700;margin-top:4px;">Users at Limit (3/3)</div>
                </div>
            </div>

            <!-- Tab Buttons -->
            <div style="display:flex;gap:10px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:16px;padding-bottom:10px;">
                <button id="tabBtnUsers" onclick="switchTrackingTab('users')" style="background:${_adminTrackingActiveTab === 'users' ? 'rgba(255,43,82,0.2)' : 'transparent'};border:1px solid ${_adminTrackingActiveTab === 'users' ? 'rgba(255,43,82,0.4)' : 'transparent'};color:${_adminTrackingActiveTab === 'users' ? '#ff758f' : 'rgba(255,255,255,0.6)'};padding:8px 18px;border-radius:10px;font-weight:700;font-size:0.85rem;cursor:pointer;"><i class="fas fa-users"></i> User Quotas (${users.length})</button>
                <button id="tabBtnAudit" onclick="switchTrackingTab('audit')" style="background:${_adminTrackingActiveTab === 'audit' ? 'rgba(255,43,82,0.2)' : 'transparent'};border:1px solid ${_adminTrackingActiveTab === 'audit' ? 'rgba(255,43,82,0.4)' : 'transparent'};color:${_adminTrackingActiveTab === 'audit' ? '#ff758f' : 'rgba(255,255,255,0.6)'};padding:8px 18px;border-radius:10px;font-weight:700;font-size:0.85rem;cursor:pointer;"><i class="fas fa-list-check"></i> Live Audit Trail (${audit.length})</button>
            </div>

            <!-- View: Users Table -->
            <div id="viewTrackingUsers" style="display:${_adminTrackingActiveTab === 'users' ? 'block' : 'none'};">
        `;

        if (users.length === 0) {
            html += `<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.4);">No requests or quota usage recorded for this date.</div>`;
        } else {
            html += `
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:0.84rem;text-align:left;">
                        <thead>
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);">
                                <th style="padding:10px;">User / ID</th>
                                <th style="padding:10px;">IP Address</th>
                                <th style="padding:10px;">Used / Limit</th>
                                <th style="padding:10px;">Remaining</th>
                                <th style="padding:10px;">Status</th>
                                <th style="padding:10px;">Requests</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            users.forEach(function(u) {
                var isLimitReached = !u.is_admin && u.remaining === 0;
                var statusBadge = u.is_admin
                    ? `<span style="background:rgba(168,85,247,0.15);color:#c084fc;border:1px solid rgba(168,85,247,0.3);padding:2px 8px;border-radius:6px;font-size:0.72rem;font-weight:700;">ADMIN</span>`
                    : (isLimitReached
                        ? `<span style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);padding:2px 8px;border-radius:6px;font-size:0.72rem;font-weight:700;">LIMIT REACHED (3/3)</span>`
                        : `<span style="background:rgba(52,211,153,0.15);color:#34d399;border:1px solid rgba(52,211,153,0.3);padding:2px 8px;border-radius:6px;font-size:0.72rem;font-weight:700;">ACTIVE (${u.count}/3)</span>`);

                var reqListHtml = (u.requests || []).map(function(r) {
                    return `<div style="font-size:0.76rem;color:rgba(255,255,255,0.75);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;" title="${r.title}">• [${r.type || 'req'}] ${r.title}</div>`;
                }).join('') || '<span style="color:rgba(255,255,255,0.3);font-size:0.75rem;">No requests</span>';

                html += `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:12px 10px;">
                            <div style="font-weight:700;color:#fff;">${u.user_name}</div>
                            <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);font-family:monospace;">${u.user_id}</div>
                        </td>
                        <td style="padding:12px 10px;font-family:monospace;color:rgba(255,255,255,0.65);">${u.client_ip}</td>
                        <td style="padding:12px 10px;font-weight:700;color:${isLimitReached ? '#ef4444' : '#fff'};">${u.count} / ${u.limit}</td>
                        <td style="padding:12px 10px;font-weight:700;color:${isLimitReached ? '#ef4444' : '#34d399'};">${u.is_admin ? '∞' : u.remaining}</td>
                        <td style="padding:12px 10px;">${statusBadge}</td>
                        <td style="padding:12px 10px;">${reqListHtml}</td>
                    </tr>
                `;
            });
            html += `</tbody></table></div>`;
        }
        html += `</div>`;

        // View: Audit Trail
        html += `
            <div id="viewTrackingAudit" style="display:${_adminTrackingActiveTab === 'audit' ? 'block' : 'none'};">
        `;
        if (audit.length === 0) {
            html += `<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.4);">No audit records logged.</div>`;
        } else {
            html += `
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:0.82rem;text-align:left;">
                        <thead>
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);">
                                <th style="padding:8px 10px;">Time (UTC)</th>
                                <th style="padding:8px 10px;">Event</th>
                                <th style="padding:8px 10px;">User</th>
                                <th style="padding:8px 10px;">IP Address</th>
                                <th style="padding:8px 10px;">Request Title</th>
                                <th style="padding:8px 10px;">Details</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            audit.forEach(function(ev) {
                var isBlocked = ev.event_type === 'submit_blocked_limit';
                var badge = isBlocked
                    ? `<span style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);padding:2px 7px;border-radius:5px;font-size:0.7rem;font-weight:700;"><i class="fas fa-ban"></i> BLOCKED</span>`
                    : `<span style="background:rgba(52,211,153,0.15);color:#34d399;border:1px solid rgba(52,211,153,0.3);padding:2px 7px;border-radius:5px;font-size:0.7rem;font-weight:700;"><i class="fas fa-check"></i> ACCEPTED</span>`;

                var timeStr = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '-';

                html += `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                        <td style="padding:10px;color:rgba(255,255,255,0.5);white-space:nowrap;">${timeStr}</td>
                        <td style="padding:10px;">${badge}</td>
                        <td style="padding:10px;font-weight:600;color:#fff;">${ev.user_name || ev.user_id}</td>
                        <td style="padding:10px;font-family:monospace;color:rgba(255,255,255,0.55);">${ev.client_ip || '-'}</td>
                        <td style="padding:10px;color:rgba(255,255,255,0.85);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ev.request_title || '-'}</td>
                        <td style="padding:10px;color:${isBlocked ? '#fca5a5' : '#86efac'};font-size:0.76rem;">${isBlocked ? (ev.note || 'Daily limit exceeded') : `Today: ${ev.count_today || 1}/3`}</td>
                    </tr>
                `;
            });
            html += `</tbody></table></div>`;
        }
        html += `</div>`;

        c.innerHTML = html;

        window.switchTrackingTab = function(tab) {
            _adminTrackingActiveTab = tab;
            var vUsers = document.getElementById('viewTrackingUsers');
            var vAudit = document.getElementById('viewTrackingAudit');
            var bUsers = document.getElementById('tabBtnUsers');
            var bAudit = document.getElementById('tabBtnAudit');
            if (vUsers && vAudit) {
                vUsers.style.display = tab === 'users' ? 'block' : 'none';
                vAudit.style.display = tab === 'audit' ? 'block' : 'none';
            }
            if (bUsers && bAudit) {
                bUsers.style.background = tab === 'users' ? 'rgba(255,43,82,0.2)' : 'transparent';
                bUsers.style.borderColor = tab === 'users' ? 'rgba(255,43,82,0.4)' : 'transparent';
                bUsers.style.color = tab === 'users' ? '#ff758f' : 'rgba(255,255,255,0.6)';

                bAudit.style.background = tab === 'audit' ? 'rgba(255,43,82,0.2)' : 'transparent';
                bAudit.style.borderColor = tab === 'audit' ? 'rgba(255,43,82,0.4)' : 'transparent';
                bAudit.style.color = tab === 'audit' ? '#ff758f' : 'rgba(255,255,255,0.6)';
            }
        };
    };
    window.openAdminQuotaTracking = window.execOpenAdminQuotaTracking;

    console.log('[ChunkStore] Admin actions chunk loaded.');
})(window);

