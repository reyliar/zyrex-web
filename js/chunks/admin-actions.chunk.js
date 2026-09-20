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

