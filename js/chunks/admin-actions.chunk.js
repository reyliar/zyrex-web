/**
 * Zyrex Chunk Architecture — Admin Quick Actions Chunk
 * Dynamically loaded ONLY when an authenticated admin or uploader session is verified.
 * Keeps public pages lightweight and avoids exposing admin client code to regular visitors.
 */
(function(window) {
    'use strict';

    window.quickRejectRequest = async function(id) {
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

    window.quickDeleteRequest = async function(id) {
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

    console.log('[ChunkStore] Admin actions chunk loaded.');
})(window);

