/**
 * Zyrex Chunk Architecture — Comments & Discord Community Feed Chunk
 * On-demand loaded chunk for real-time Discord comments, sticker/GIF pickers,
 * mention autocomplete, Markdown parsing, and thread replies.
 */
// Comment author names regularly contain apostrophes, so the reply handler never embeds
// them in its source: the name travels in a data attribute instead.
window.zyrexReplyToComment = function (button) {
    if (!button || !button.dataset) return;
    if (typeof window.toggleReplyBox !== 'function') return;
    window.toggleReplyBox(button.dataset.commentId || '', button.dataset.author || '');
};


(function(window) {
    'use strict';

    // Shared helpers kept from the original chunk so existing comments, markdown,
    // stickers and GIFs keep rendering exactly as before.
    var currentCommentsPresetId = null;
    var currentUserData = null;
    var activeCommentInputId = 'mainCommentText';
    var MEDIA_SERVICE_ERROR_MSG = 'An issue occurred with our GIF and sticker service. (Error Code: ERR_MEDIA_SERVICE_UNAVAILABLE)';
    var GIPHY_API_KEY = 'dc6zaTOxFJmzC';

function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

function formatTimeAgo(timestamp) {
        if (!timestamp) return 'Just now';
        var now = Date.now();
        var time = new Date(timestamp).getTime();
        var diffSec = Math.floor((now - time) / 1000);
        if (diffSec < 60) return 'Just now';
        var diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return diffMin + 'm ago';
        var diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return diffHours + 'h ago';
        var diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return diffDays + 'd ago';
        return new Date(timestamp).toLocaleDateString();
    }

function hasCorruptedMediaBlock(text) {
        if (!text) return false;
        return /(?:<u\b[^>]*>)?(?:__|@{1,3})?(?:DC|ZYREX)_MEDIA_BLOCK_\d+(?:__|@{1,3})?(?:<\/u>)?/i.test(text);
    }

function autoResizeCommentTextarea(textarea) {
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(38, textarea.scrollHeight) + 'px';
    }

function formatCommentContentWithMentions(rawContent) {
        if (!rawContent) return '';
        var escaped = escapeHtml(rawContent);

        // 1. Code blocks
        var codeBlocks = [];
        escaped = escaped.replace(/```(?:([a-zA-Z0-9_-]+)?\n)?([\s\S]*?)```/g, function(match, lang, code) {
            var placeholder = '\uE000CB' + codeBlocks.length + '\uE000';
            codeBlocks.push('<pre class="discord-code-block"><code>' + code + '</code></pre>');
            return placeholder;
        });

        // 2. Inline code
        var inlineCodes = [];
        escaped = escaped.replace(/`([^`\n]+)`/g, function(match, code) {
            var placeholder = '\uE000IC' + inlineCodes.length + '\uE000';
            inlineCodes.push('<code class="discord-inline-code">' + code + '</code>');
            return placeholder;
        });

        // 3. Spoilers
        escaped = escaped.replace(/\|\|([\s\S]+?)\|\|/g, '<span class="discord-spoiler" onclick="this.classList.toggle(\'revealed\')" title="Click to reveal spoiler">$1</span>');

        // 4. Protected Media Blocks
        var mediaBlocks = [];
        function addMediaBlock(html) {
            var placeholder = '\uE000MB' + mediaBlocks.length + '\uE000';
            mediaBlocks.push(html);
            return placeholder;
        }

        escaped = escaped.replace(/(?:\r?\n|\s)*!\[sticker:(.*?)\]\((https?:\/\/[^\s\)\"'>]+)\)(?:\r?\n|\s)*/g, function(match, name, url) {
            return addMediaBlock('<div class="comment-media-wrap"><img src="' + url + '" alt="' + name + '" class="comment-media-embed comment-sticker-embed" loading="lazy"></div>');
        });

        escaped = escaped.replace(/(?:\r?\n|\s)*!\[gif\]\((https?:\/\/[^\s\)\"'>]+)\)(?:\r?\n|\s)*/g, function(match, url) {
            var tenorMatch = url.match(/tenor\.com\/(?:view\/[a-zA-Z0-9_\-]+-|embed\/|)(\d+)/);
            if (tenorMatch) {
                return addMediaBlock('<div class="comment-media-wrap"><iframe src="https://tenor.com/embed/' + tenorMatch[1] + '" class="comment-tenor-embed" frameborder="0" scrolling="no" allowfullscreen></iframe></div>');
            }
            return addMediaBlock('<div class="comment-media-wrap"><img src="' + url + '" alt="GIF" class="comment-media-embed" loading="lazy" onclick="window.open(this.src,\'_blank\')"></div>');
        });

        escaped = escaped.replace(/(?:\r?\n|\s)*!\[(.*?)\]\((https?:\/\/[^\s\)\"'>]+)\)(?:\r?\n|\s)*/g, function(match, alt, url) {
            return addMediaBlock('<div class="comment-media-wrap"><img src="' + url + '" alt="' + alt + '" class="comment-media-embed" loading="lazy" onclick="window.open(this.src,\'_blank\')"></div>');
        });

        escaped = escaped.replace(/(?:\r?\n|\s)*(?:https?:\/\/(?:www\.)?tenor\.com\/(?:view\/[a-zA-Z0-9_\-]+-|embed\/|)(\d+)[^\s<]*)(?:\r?\n|\s)*/gi, function(match, tid) {
            return addMediaBlock('<div class="comment-media-wrap"><iframe src="https://tenor.com/embed/' + tid + '" class="comment-tenor-embed" frameborder="0" scrolling="no" allowfullscreen></iframe></div>');
        });

        escaped = escaped.replace(/(?:\r?\n|\s)*(https?:\/\/[^\s<]+?\.(?:gif|png|jpe?g|webp)(\?[^\s<]*)?|https?:\/\/media\.tenor\.com\/[^\s<]+|https?:\/\/media[0-9]?\.giphy\.com\/media\/[^\s<]+)(?:\r?\n|\s)*/gi, function(match, url) {
            return addMediaBlock('<div class="comment-media-wrap"><img src="' + url + '" class="comment-media-embed" loading="lazy" onclick="window.open(this.src,\'_blank\')"></div>');
        });

        escaped = escaped.replace(/&lt;(a?):([a-zA-Z0-9_]+):(\d{17,20})&gt;/g, function(match, animated, name, id) {
            var ext = animated ? 'gif' : 'png';
            return '<img class="discord-custom-emoji" src="https://cdn.discordapp.com/emojis/' + id + '.' + ext + '?size=48" alt=":' + name + ':" title=":' + name + ':">';
        });

        escaped = escaped.replace(/&lt;#(\d{17,20})&gt;/g, '<span class="discord-channel-pill"><i class="fas fa-hashtag"></i>channel</span>');
        escaped = escaped.replace(/&lt;@!?(\d{17,20})&gt;/g, '<span class="mention-tag"><i class="fas fa-at" style="font-size:0.75em;opacity:0.75"></i>User</span>');
        escaped = escaped.replace(/@([a-zA-Z0-9_\.\-]+)/g, '<span class="mention-tag"><i class="fas fa-at" style="font-size:0.75em;opacity:0.75"></i>$1</span>');

        escaped = escaped.replace(/(?:^|\n)&gt;&gt;&gt;\s*([\s\S]+)$/g, function(match, quote) {
            return '<blockquote class="discord-quote">' + quote.replace(/\n/g, '<br>') + '</blockquote>';
        });
        escaped = escaped.replace(/(?:^|\n)&gt;\s*([^\n]+)/g, '<blockquote class="discord-quote">$1</blockquote>');
        escaped = escaped.replace(/(?:^|\n)-#\s*([^\n]+)/g, '<small class="discord-subtext">$1</small>');

        escaped = escaped.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/__(.*?)__/g, '<u>$1</u>');
        escaped = escaped.replace(/\*([^\*\n]+)\*/g, '<em>$1</em>');
        escaped = escaped.replace(/\b_([^_\n]+)_\b/g, '<em>$1</em>');
        escaped = escaped.replace(/~~(.*?)~~/g, '<s>$1</s>');

        mediaBlocks.forEach(function(mb, idx) {
            escaped = escaped.replace('\uE000MB' + idx + '\uE000', mb);
        });
        codeBlocks.forEach(function(cb, idx) {
            escaped = escaped.replace('\uE000CB' + idx + '\uE000', cb);
        });
        inlineCodes.forEach(function(ic, idx) {
            escaped = escaped.replace('\uE000IC' + idx + '\uE000', ic);
        });

        var corruptedMediaBadge = '<div class="comment-media-wrap"><div style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(var(--zr-rgb-255-43-82, 255, 43, 82),0.1);border:1px solid rgba(var(--zr-rgb-255-43-82, 255, 43, 82),0.3);border-radius:8px;color:var(--zr-accent-soft, rgba(var(--zr-rgb-255-107-139, 255, 107, 139), 1));font-size:0.8rem"><i class="fas fa-triangle-exclamation"></i> <span>' + MEDIA_SERVICE_ERROR_MSG + '</span></div></div>';
        escaped = escaped.replace(/(?:&lt;u&gt;|<u>)?(?:__|@{1,3})?(?:DC|ZYREX)_MEDIA_BLOCK_\d+(?:__|@{1,3})?(?:&lt;\/u&gt;|<\/u>)?/gi, corruptedMediaBadge);
        escaped = escaped.replace(/\uE000(?:MB|CB|IC)\d+\uE000/g, corruptedMediaBadge);

        escaped = escaped.replace(/\n/g, '<br>');
        escaped = escaped.replace(/(?:<br>\s*)+<div class="comment-media-wrap">/g, '<div class="comment-media-wrap">');
        escaped = escaped.replace(/<\/div>(?:\s*<br>)+/g, '</div>');
        return escaped;
    }

function closePickerPopover() {
        document.querySelectorAll('.popover-card').forEach(function(p) { p.style.display = 'none'; });
        document.querySelectorAll('.comment-tool-btn').forEach(function(b) { b.classList.remove('active'); });
        var mediaModal = document.getElementById('commentMediaModal');
        if (mediaModal) mediaModal.hidden = true;
        document.body.classList.remove('pf-modal-open');
    }

    // Keep the comment picker in lockstep with the feed post media modal.
    var commentMediaState = { kind: '', targetId: 'mainCommentText', timer: 0, stickers: null, request: 0 };
    var COMMENT_GIPHY_KEY = 'hF2tiiF3deZinjO4V7X75pc1q1CwLTkp';
    function commentMediaEscape(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
    }
    function ensureCommentMediaModal() {
        var modal = document.getElementById('commentMediaModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'pf-media-modal';
        modal.id = 'commentMediaModal';
        modal.hidden = true;
        modal.innerHTML = '<div class="pf-media-modal-backdrop" data-comment-media-close></div>' +
            '<div class="pf-media-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="commentMediaTitle">' +
            '<div class="pf-media-modal-head"><strong id="commentMediaTitle">Discord stickers</strong>' +
            '<button type="button" class="pf-media-modal-close" data-comment-media-close aria-label="Close"><i class="fas fa-xmark"></i></button></div>' +
            '<input class="pf-feed-gif-search" id="commentGifSearch" placeholder="Search GIFs..." autocomplete="off" hidden>' +
            '<div class="pf-media-modal-grid" id="commentMediaGrid"></div>' +
            '<p class="pf-media-modal-note" id="commentMediaNote" aria-live="polite"></p></div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (event) {
            var choice = event.target.closest('[data-comment-media-pick]');
            if (choice) { chooseCommentMedia(choice.getAttribute('data-comment-media-pick'), choice.getAttribute('data-name') || 'Sticker'); return; }
            if (event.target.closest('[data-comment-media-close]')) closePickerPopover();
        });
        modal.querySelector('#commentGifSearch').addEventListener('input', function () {
            var query = this.value.trim();
            clearTimeout(commentMediaState.timer);
            commentMediaState.timer = setTimeout(function () { loadCommentGifs(query); }, 250);
        });
        return modal;
    }
    function commentMediaNote(message, error) {
        var note = document.getElementById('commentMediaNote');
        if (!note) return;
        note.textContent = message || '';
        note.classList.toggle('is-error', Boolean(error));
    }
    function renderCommentMediaLoading(message) {
        var grid = document.getElementById('commentMediaGrid');
        if (grid) grid.innerHTML = '<span class="pf-media-modal-empty">' + commentMediaEscape(message) + '</span>';
    }
    function loadCommentStickers() {
        var grid = document.getElementById('commentMediaGrid');
        var request = ++commentMediaState.request;
        var promise = commentMediaState.stickers ? Promise.resolve(commentMediaState.stickers) :
            fetch('/api/guild/stickers', { credentials: 'include' }).then(function (response) { return response.json(); }).then(function (data) {
                commentMediaState.stickers = Array.isArray(data.stickers) ? data.stickers : [];
                return commentMediaState.stickers;
            });
        promise.then(function (items) {
            if (request !== commentMediaState.request || commentMediaState.kind !== 'stickers') return;
            var usable = (items || []).filter(function (item) { return item && /^https:\/\//i.test(item.url || '') && /\.(?:png|gif|webp|apng)(?:\?|$)/i.test(item.url); });
            if (!usable.length) { renderCommentMediaLoading('No server stickers found.'); return; }
            grid.innerHTML = usable.map(function (item) {
                return '<button type="button" class="pf-media-modal-item is-sticker" data-comment-media-pick="' + commentMediaEscape(item.url.split('?')[0]) + '" data-name="' + commentMediaEscape(item.name || 'Sticker') + '" title="' + commentMediaEscape(item.name || 'Sticker') + '"><img src="' + commentMediaEscape(item.url) + '" alt="" loading="lazy"></button>';
            }).join('');
        }).catch(function () { if (request === commentMediaState.request) renderCommentMediaLoading('Could not load server stickers.'); });
    }
    function loadCommentGifs(query) {
        var grid = document.getElementById('commentMediaGrid');
        var request = ++commentMediaState.request;
        renderCommentMediaLoading(query ? 'Searching GIFs…' : 'Loading GIFs…');
        var url = 'https://api.giphy.com/v1/gifs/' + (query ? 'search' : 'trending') + '?api_key=' + COMMENT_GIPHY_KEY + '&limit=24&rating=pg-13' + (query ? '&q=' + encodeURIComponent(query) : '');
        fetch(url).then(function (response) { return response.json(); }).then(function (data) {
            if (request !== commentMediaState.request || commentMediaState.kind !== 'gifs') return;
            var gifs = (Array.isArray(data.data) ? data.data : []).map(function (item) {
                var images = item.images || {};
                var preview = images.fixed_height_small && images.fixed_height_small.url || images.fixed_height && images.fixed_height.url || '';
                var full = images.fixed_height && images.fixed_height.url || images.fixed_width && images.fixed_width.url || images.downsized_medium && images.downsized_medium.url || preview;
                return { preview: preview, url: full };
            }).filter(function (gif) { return /^https:\/\//i.test(gif.preview) && /^https:\/\//i.test(gif.url); });
            if (!gifs.length) { renderCommentMediaLoading('No GIFs found.'); return; }
            grid.innerHTML = gifs.map(function (gif) { return '<button type="button" class="pf-media-modal-item" data-comment-media-pick="' + commentMediaEscape(gif.url) + '" data-name="GIF" title="GIF"><img src="' + commentMediaEscape(gif.preview) + '" alt="" loading="lazy"></button>'; }).join('');
        }).catch(function () { if (request === commentMediaState.request) renderCommentMediaLoading('Could not load GIFs.'); });
    }
    function storeCommentSticker(url) {
        return fetch(url, { mode: 'cors' }).then(function (response) { if (!response.ok) throw new Error('sticker'); return response.blob(); }).then(function (blob) {
            if (!blob.size || blob.size > 3 * 1024 * 1024) return '';
            return new Promise(function (resolve) {
                var reader = new FileReader();
                reader.onload = function () { resolve(String(reader.result || '')); };
                reader.onerror = function () { resolve(''); };
                reader.readAsDataURL(blob);
            });
        }).then(function (data) {
            if (!data) return '';
            return fetch('/api/profile/media', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: data, kind: 'post' }) }).then(function (response) { return response.json(); }).then(function (result) { return result && result.success && result.url ? result.url : ''; });
        }).catch(function () { return ''; });
    }
    function chooseCommentMedia(url, name) {
        var targetId = commentMediaState.targetId;
        var kind = commentMediaState.kind;
        var modal = document.getElementById('commentMediaModal');
        if (kind === 'stickers') {
            commentMediaNote('Adding sticker…');
            storeCommentSticker(url).then(function (stored) {
                if (modal) modal.hidden = true;
                document.body.classList.remove('pf-modal-open');
                window.insertStickerToComment(name, stored || url, targetId);
            });
        } else {
            if (modal) modal.hidden = true;
            document.body.classList.remove('pf-modal-open');
            window.insertGifToComment(url, targetId);
        }
    }
    function openCommentMediaPicker(kind, button, targetId) {
        var modal = ensureCommentMediaModal();
        commentMediaState.kind = kind;
        commentMediaState.targetId = targetId || 'mainCommentText';
        commentMediaState.request += 1;
        modal.hidden = false;
        document.body.classList.add('pf-modal-open');
        modal.querySelector('#commentMediaTitle').textContent = kind === 'stickers' ? 'Discord stickers' : 'GIFs';
        var search = modal.querySelector('#commentGifSearch');
        search.hidden = kind !== 'gifs';
        search.value = '';
        commentMediaNote('');
        renderCommentMediaLoading('Loading…');
        if (kind === 'stickers') loadCommentStickers(); else loadCommentGifs('');
    }
    window.toggleStickerPicker = function (button, targetId) { openCommentMediaPicker('stickers', button, targetId); };
    window.toggleGifPicker = function (button, targetId) { openCommentMediaPicker('gifs', button, targetId); };
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closePickerPopover(); });

    // The picker target is captured when the picker opens, so a late click can never
    // fall back to the main composer while a reply box was the intended field.
    var activePickerTargetId = 'mainCommentText';

    function rememberPickerTarget(targetId) {
        activePickerTargetId = targetId || 'mainCommentText';
        activeCommentInputId = activePickerTargetId;
        window.activeCommentInputId = activePickerTargetId;
        return activePickerTargetId;
    }
    window.rememberPickerTarget = rememberPickerTarget;

function insertStickerToComment(name, url, targetId) {
        var txt = document.getElementById(targetId || activePickerTargetId || activeCommentInputId || 'mainCommentText');
        if (!txt) return;
        var tag = '![sticker:' + name + '](' + url + ')';
        txt.value = txt.value.trim() ? (txt.value.trim() + '\n' + tag) : tag;
        closePickerPopover();
        autoResizeCommentTextarea(txt);
        txt.focus();
    }

function insertGifToComment(url, targetId) {
        var txt = document.getElementById(targetId || activePickerTargetId || activeCommentInputId || 'mainCommentText');
        if (!txt) return;
        var tag = '![gif](' + url + ')';
        txt.value = txt.value.trim() ? (txt.value.trim() + '\n' + tag) : tag;
        closePickerPopover();
        autoResizeCommentTextarea(txt);
        txt.focus();
    }

    window.formatCommentContentWithMentions = formatCommentContentWithMentions;
    window.autoResizeCommentTextarea = autoResizeCommentTextarea;
    window.closePickerPopover = closePickerPopover;
    window.insertStickerToComment = insertStickerToComment;
    window.insertGifToComment = insertGifToComment;

    document.addEventListener('click', function (event) {
        var openPopover = document.querySelector('.popover-card[style*="display: block"]');
        if (!openPopover) return;
        if (!openPopover.contains(event.target) && !event.target.closest('.comment-tool-btn, [data-picker]')) {
            closePickerPopover();
        }
    });

    // ── Rebuilt comments UI ────────────────────────────────────────────────
    // Everything below renders the discussion panel on /leak. The markdown and
    // @mention helpers above are reused unchanged so old comments still render
    // exactly as before.

    var commentState = {
        comments: [],
        total: 0,
        sort: 'new',
        loading: false,
        loaded: false,
        error: '',
        requestSeq: 0
    };

    function commentsTreeEl() { return document.getElementById('commentsTreeContainer'); }
    function commentsBadgeEl() { return document.getElementById('commentsCountBadge'); }

    function parseCommentTime(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        var text = String(value).trim();
        if (!text) return 0;
        var normalised = text.indexOf('T') === -1 ? text.replace(' ', 'T') : text;
        if (!/(Z|[+-]\d{2}:?\d{2})$/.test(normalised)) normalised += 'Z';
        var stamp = Date.parse(normalised);
        return isNaN(stamp) ? 0 : stamp;
    }

    function replyCount(comment) {
        return Array.isArray(comment && comment.replies) ? comment.replies.length : 0;
    }

    function countComments(comments) {
        return (comments || []).reduce(function (total, comment) {
            return total + 1 + replyCount(comment);
        }, 0);
    }

    function commentToast(message, kind) {
        if (window.showStatusAlert) {
            window.showStatusAlert(message, kind === 'error');
            return;
        }
        var panel = document.getElementById('commentsSection');
        if (!panel) return;
        var toast = document.getElementById('commentsToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'commentsToast';
            toast.className = 'lk-cmt-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            panel.appendChild(toast);
        }
        var icon = kind === 'error' ? 'fa-circle-exclamation' : (kind === 'success' ? 'fa-circle-check' : 'fa-circle-info');
        toast.className = 'lk-cmt-toast is-visible' + (kind ? ' is-' + kind : '');
        toast.innerHTML = '<i class="fas ' + icon + '"></i><span>' + escapeHtml(message) + '</span>';
        clearTimeout(commentToast.timer);
        commentToast.timer = setTimeout(function () {
            toast.className = 'lk-cmt-toast';
        }, 3800);
    }
    window.commentToast = commentToast;

    function renderCommentSkeleton() {
        var tree = commentsTreeEl();
        if (!tree) return;
        var widths = [[46, 82], [38, 66], [52, 74]];
        tree.innerHTML = widths.map(function (pair, index) {
            return '<div class="lk-cmt-skeleton" aria-hidden="true">' +
                '<span class="lk-sk-avatar"></span>' +
                '<div class="lk-sk-lines">' +
                '<span class="lk-sk-line" style="width:' + pair[0] + '%"></span>' +
                '<span class="lk-sk-line is-long" style="width:' + pair[1] + '%"></span>' +
                '</div>' +
                '</div>';
        }).join('');
        if (commentsBadgeEl() && !commentState.loaded) commentsBadgeEl().textContent = '0';
    }

    function renderCommentEmpty() {
        var tree = commentsTreeEl();
        if (!tree) return;
        var signedIn = Boolean(currentUserData);
        tree.innerHTML = '<div class="lk-cmt-empty">' +
            '<span class="lk-cmt-empty-ring"><i class="far fa-comments"></i></span>' +
            '<strong>No comments yet</strong>' +
            '<span>' + (signedIn
                ? 'Start the conversation — ask a question or leave feedback for the creator.'
                : 'No one has commented on this leak yet.') + '</span>' +
            (signedIn ? '<button type="button" class="lk-cmt-empty-cta" data-comment-focus>Write the first comment</button>' : '') +
            '</div>';
    }

    function renderCommentError(message) {
        var tree = commentsTreeEl();
        if (!tree) return;
        tree.innerHTML = '<div class="lk-cmt-empty is-error">' +
            '<span class="lk-cmt-empty-ring"><i class="fas fa-triangle-exclamation"></i></span>' +
            '<strong>Discussion unavailable</strong>' +
            '<span>' + escapeHtml(message || 'We could not load the comments right now.') + '</span>' +
            '<button type="button" class="lk-cmt-empty-cta" data-comment-retry>Try again</button>' +
            '</div>';
    }

    function sortedRootComments() {
        var list = (commentState.comments || []).slice();
        list.sort(function (a, b) {
            return parseCommentTime(b && b.created_at) - parseCommentTime(a && a.created_at);
        });
        return list;
    }

    function sortedReplies(comment) {
        var replies = Array.isArray(comment && comment.replies) ? comment.replies.slice() : [];
        replies.sort(function (a, b) {
            return parseCommentTime(a && a.created_at) - parseCommentTime(b && b.created_at);
        });
        return replies;
    }

    function commentAuthorAvatar(comment, size) {
        var avatar = (comment && comment.user_avatar) || window.DEFAULT_AVATAR;
        var name = (comment && comment.user_name) || 'Member';
        return '<img src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(name) + '"' +
            (size ? ' width="' + size + '" height="' + size + '"' : '') +
            ' class="comment-avatar' + (isStaffComment(comment) ? ' admin-glow' : '') + '"' +
            ' loading="lazy" onerror="window.handleAvatarError(this)">';
    }

    function isStaffComment(comment) {
        if (!comment) return false;
        if (comment.is_admin) return true;
        return String(comment.user_id || '') === '1421177012814614548';
    }

    function canManageComment(comment) {
        if (!currentUserData || !comment) return false;
        if (String(currentUserData.id || '') === String(comment.user_id || '')) return true;
        return Boolean(currentUserData.is_admin) || String(currentUserData.id || '') === '1421177012814614548';
    }

    function renderReplyBox(comment) {
        var id = escapeHtml(comment.id);
        return '<div id="replyBox-' + id + '" class="reply-box-inline" hidden>' +
            '<form data-comment-form="reply" data-id="' + id + '" novalidate>' +
            '<textarea id="replyText-' + id + '" class="comment-textarea mentionable-input" rows="1" maxlength="1000"' +
            ' placeholder="Reply to ' + escapeHtml(comment.user_name || 'this comment') + '…" aria-label="Write a reply"></textarea>' +
            '<div class="comment-tools-row">' +
            '<div class="comment-tools-left">' +
            '<button type="button" class="comment-tool-btn" data-picker="sticker" data-input="replyText-' + id + '" data-popover="replyPicker-' + id + '" title="Send a Discord sticker"><i class="fas fa-face-smile"></i><span>Sticker</span></button>' +
            '<button type="button" class="comment-tool-btn" data-picker="gif" data-input="replyText-' + id + '" data-popover="replyPicker-' + id + '" title="Send a GIF"><i class="fas fa-film"></i><span>GIF</span></button>' +
            '</div>' +
            '<div class="cmt-composer-meta">' +
            '<button type="button" class="comment-act-btn" data-act="cancel-reply" data-id="' + id + '">Cancel</button>' +
            '<button type="submit" class="comment-btn-submit"><i class="fas fa-paper-plane"></i>Reply</button>' +
            '</div>' +
            '</div>' +
            '<div id="replyPicker-' + id + '" class="popover-card" style="display:none"></div>' +
            '</form>' +
            '</div>';
    }

    function renderEditBox(comment) {
        var id = escapeHtml(comment.id);
        return '<div id="editBox-' + id + '" class="reply-box-inline is-edit" hidden>' +
            '<form data-comment-form="edit" data-id="' + id + '" novalidate>' +
            '<textarea id="editText-' + id + '" class="comment-textarea mentionable-input" rows="1" maxlength="1000" aria-label="Edit comment">' +
            escapeHtml(comment.content || '') + '</textarea>' +
            '<div class="comment-tools-row">' +
            '<span class="cmt-edit-hint"><i class="fas fa-pen"></i> Editing your comment</span>' +
            '<div class="cmt-composer-meta">' +
            '<button type="button" class="comment-act-btn" data-act="cancel-edit" data-id="' + id + '">Cancel</button>' +
            '<button type="submit" class="comment-btn-submit" id="btnSaveEdit-' + id + '"><i class="fas fa-check"></i>Save</button>' +
            '</div>' +
            '</div>' +
            '</form>' +
            '</div>';
    }

    function renderSingleComment(comment, isReply) {
        if (!comment || !comment.id) return '';
        var id = escapeHtml(comment.id);
        var authorName = comment.user_name || 'Member';
        var staff = isStaffComment(comment);
        var mine = canManageComment(comment);
        var fromDiscord = comment.source === 'discord';
        var profileId = String(comment.user_id || comment.author_id || '').trim();
        var profileHref = !comment.is_anonymous && /^\d{15,25}$/.test(profileId)
            ? '/profile?id=' + encodeURIComponent(profileId)
            : '';
        var created = comment.created_at || '';
        var replies = sortedReplies(comment);

        var replyButtons = currentUserData
            ? '<button type="button" class="comment-act-btn reply-btn" data-act="reply" data-id="' + id + '" data-author="' + escapeHtml(authorName) + '">' +
              '<i class="fas fa-reply"></i><span>Reply</span></button>'
            : '';
        var manageButtons = mine
            ? '<button type="button" class="comment-act-btn" data-act="edit" data-id="' + id + '"><i class="fas fa-pen-to-square"></i><span>Edit</span></button>' +
              '<button type="button" class="comment-act-btn delete-btn" data-act="delete" data-id="' + id + '"><i class="fas fa-trash-can"></i><span>Delete</span></button>'
            : '';
        var actions = (replyButtons || manageButtons)
            ? '<div class="comment-actions">' + replyButtons + manageButtons + '</div>'
            : '';

        var repliesHtml = replies.length
            ? '<div class="replies-branch">' + replies.map(function (reply) { return renderSingleComment(reply, true); }).join('') + '</div>'
            : '';

        return '<article class="comment-item' + (isReply ? ' reply-item' : '') + '" id="comment-' + id + '" data-comment-item="' + id + '">' +
            '<div class="comment-avatar-wrap">' + commentAuthorAvatar(comment) + '</div>' +
            '<div class="comment-body-wrap">' +
            '<header class="comment-header">' +
            '<div class="comment-user-title">' +
            (profileHref
                ? '<a class="cmt-name cmt-profile-link" data-profile-preview data-profile-id="' + escapeHtml(profileId) + '" href="' + profileHref + '">' + escapeHtml(authorName) + '</a>'
                : '<span class="cmt-name">' + escapeHtml(authorName) + '</span>') +
            (staff ? '<span class="cmt-badge-staff" title="Zyrex staff"><i class="fas fa-circle-check"></i></span>' : '') +
            (fromDiscord ? '<span class="source-pill-dc" title="Sent from Discord"><i class="fab fa-discord"></i>Discord</span>' : '') +
            '</div>' +
            '<time class="comment-time" datetime="' + escapeHtml(created) + '">' + formatTimeAgo(created) + '</time>' +
            '</header>' +
            '<div class="comment-content" id="commentText-' + id + '">' + formatCommentContentWithMentions(comment.content) + '</div>' +
            actions +
            (mine ? renderEditBox(comment) : '') +
            (currentUserData ? renderReplyBox(comment) : '') +
            repliesHtml +
            '</div>' +
            '</article>';
    }

    function renderCommentsTree(comments) {
        var tree = commentsTreeEl();
        if (!tree) return;
        if (Array.isArray(comments)) commentState.comments = comments;
        commentState.total = countComments(commentState.comments);

        var badge = commentsBadgeEl();
        if (badge) {
            badge.textContent = String(commentState.total);
            badge.setAttribute('aria-label', commentState.total + (commentState.total === 1 ? ' comment' : ' comments'));
        }

        if (!commentState.comments.length) {
            renderCommentEmpty();
            bindMentionAutocompleteToAllInputs();
            return;
        }

        tree.innerHTML = sortedRootComments().map(function (comment) { return renderSingleComment(comment); }).join('');
        bindMentionAutocompleteToAllInputs();
        document.querySelectorAll('#commentsTreeContainer textarea').forEach(autoResizeCommentTextarea);
    }
    window.renderCommentsTree = renderCommentsTree;

    function renderCommentInputBox() {
        var box = document.getElementById('commentInputContainer');
        if (!box) return;

        if (!currentUserData) {
            var redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
            box.innerHTML = '<div class="lk-cmt-guest">' +
                '<span class="lk-cmt-guest-icon"><i class="fab fa-discord"></i></span>' +
                '<div class="lk-cmt-guest-copy"><strong>Join the discussion</strong>' +
                '<span>Sign in with Discord to comment, reply and send stickers on this leak.</span></div>' +
                '<a class="lk-cmt-guest-btn" href="/api/login?redirect=' + redirectUrl + '"><i class="fab fa-discord"></i>Sign in</a>' +
                '</div>';
            return;
        }

        var avatarUrl = currentUserData.avatar
            ? (String(currentUserData.avatar).indexOf('http') === 0
                ? currentUserData.avatar
                : 'https://cdn.discordapp.com/avatars/' + currentUserData.id + '/' + currentUserData.avatar + '.png?size=64')
            : 'https://cdn.discordapp.com/embed/avatars/' + ((parseInt(currentUserData.id, 10) || 0) % 5) + '.png';
        var displayName = currentUserData.global_name || currentUserData.displayName || currentUserData.username || 'Zyrex Member';

        box.innerHTML = '<form id="mainCommentForm" class="cmt-composer" novalidate>' +
            '<div class="cmt-composer-top">' +
            '<img src="' + escapeHtml(avatarUrl) + '" alt="' + escapeHtml(displayName) + '" class="cmt-composer-avatar" onerror="window.handleAvatarError(this)">' +
            '<div class="cmt-composer-field">' +
            '<textarea id="mainCommentText" class="comment-textarea mentionable-input" rows="1" maxlength="1000"' +
            ' placeholder="Write your comment..." aria-label="Write your comment"></textarea>' +
            '<div class="comment-tools-row">' +
            '<div class="comment-tools-left">' +
            '<button type="button" class="comment-tool-btn" id="btnStickerPicker" data-picker="sticker" data-input="mainCommentText" data-popover="commentPickerPopover" title="Send a Discord sticker"><i class="fas fa-face-smile"></i><span>Sticker</span></button>' +
            '<button type="button" class="comment-tool-btn" id="btnGifPicker" data-picker="gif" data-input="mainCommentText" data-popover="commentPickerPopover" title="Send a GIF"><i class="fas fa-film"></i><span>GIF</span></button>' +
            '</div>' +
            '<div class="cmt-composer-meta">' +
            '<span class="cmt-counter" id="mainCommentCounter">0/1000</span>' +
            '<button type="submit" id="btnSubmitComment" class="comment-btn-submit" disabled><i class="fas fa-paper-plane"></i>Post</button>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div id="commentPickerPopover" class="popover-card" style="display:none"></div>' +
            '</form>';

        var textarea = document.getElementById('mainCommentText');
        var counter = document.getElementById('mainCommentCounter');
        var submit = document.getElementById('btnSubmitComment');
        function syncComposer() {
            if (!textarea) return;
            autoResizeCommentTextarea(textarea);
            if (counter) counter.textContent = textarea.value.length + '/1000';
            if (submit) submit.disabled = !textarea.value.trim() || commentState.loading;
        }
        if (textarea) {
            textarea.addEventListener('input', syncComposer);
            textarea.addEventListener('keydown', function (event) {
                window.handleCommentKeydown(event, textarea);
            });
        }
        syncComposer();
        setTimeout(bindMentionAutocompleteToAllInputs, 40);
    }

    async function loadCommentsData(productId, options) {
        var opts = options || {};
        var tree = commentsTreeEl();
        if (!tree) return;
        var targetId = productId || currentCommentsPresetId;
        if (!targetId) return;
        if (commentState.loading && !opts.force) return;

        commentState.loading = true;
        commentState.error = '';
        var seq = ++commentState.requestSeq;
        var refreshBtn = document.getElementById('commentsRefreshBtn');
        tree.setAttribute('aria-busy', 'true');
        if (refreshBtn) refreshBtn.classList.add('is-busy');
        if (!commentState.loaded) renderCommentSkeleton();

        try {
            var res = await fetch('/api/comments?preset_id=' + encodeURIComponent(targetId), { credentials: 'include' });
            if (seq !== commentState.requestSeq) return;
            if (!res.ok) throw new Error('HTTP ' + res.status);
            var data = await res.json();
            var list = Array.isArray(data) ? data : (Array.isArray(data && data.comments) ? data.comments : null);
            if (!list) throw new Error((data && data.error) || 'Unexpected response');

            commentState.comments = list;
            commentState.loaded = true;
            commentState.error = '';
            renderCommentsTree(list);
            if (opts.highlightId && document.getElementById('comment-' + opts.highlightId)) {
                var posted = document.getElementById('comment-' + opts.highlightId);
                posted.classList.add('is-new');
                setTimeout(function () { posted.classList.remove('is-new'); }, 2200);
            }
        } catch (error) {
            if (seq !== commentState.requestSeq) return;
            commentState.error = error && error.message ? error.message : 'network';
            if (!commentState.loaded) renderCommentError('We could not load the comments. Check your connection and retry.');
            else commentToast('Could not refresh the comments.', 'error');
        } finally {
            if (seq === commentState.requestSeq) {
                commentState.loading = false;
                tree.setAttribute('aria-busy', 'false');
                if (refreshBtn) refreshBtn.classList.remove('is-busy');
                var submitBtn = document.getElementById('btnSubmitComment');
                var mainText = document.getElementById('mainCommentText');
                if (submitBtn && mainText) submitBtn.disabled = !mainText.value.trim();
            }
        }
    }
    window.loadCommentsData = loadCommentsData;

    function openReplyBox(commentId, authorName) {
        var box = document.getElementById('replyBox-' + commentId);
        if (!box) return;
        document.querySelectorAll('#commentsTreeContainer .reply-box-inline[data-open]').forEach(function (other) {
            if (other !== box) {
                other.hidden = true;
                other.removeAttribute('data-open');
            }
        });
        box.hidden = false;
        box.setAttribute('data-open', 'true');
        var textarea = document.getElementById('replyText-' + commentId);
        if (textarea) {
            if (authorName && !textarea.value.trim()) textarea.value = '@' + authorName + ' ';
            autoResizeCommentTextarea(textarea);
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
    }

    function closeInlineBox(commentId, kind) {
        var prefix = kind === 'edit' ? 'editBox-' : 'replyBox-';
        var box = document.getElementById(prefix + commentId);
        if (!box) return;
        box.hidden = true;
        box.removeAttribute('data-open');
        if (kind !== 'edit') closePickerPopover();
    }

    var commentsWired = false;
    function wireCommentsPanel() {
        if (commentsWired) return;
        commentsWired = true;

        var refreshBtn = document.getElementById('commentsRefreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                loadCommentsData(currentCommentsPresetId, { force: true });
            });
        }

        document.addEventListener('click', function (event) {
            var pickerBtn = event.target.closest('[data-picker]');
            if (pickerBtn) {
                event.preventDefault();
                var target = rememberPickerTarget(pickerBtn.getAttribute('data-input'));
                activeCommentPopoverId = pickerBtn.getAttribute('data-popover') || 'commentPickerPopover';
                window.activeCommentPopoverId = activeCommentPopoverId;
                if (pickerBtn.getAttribute('data-picker') === 'sticker' && typeof window.toggleStickerPicker === 'function') {
                    window.toggleStickerPicker(pickerBtn, target, activeCommentPopoverId);
                } else if (typeof window.toggleGifPicker === 'function') {
                    window.toggleGifPicker(pickerBtn, target, activeCommentPopoverId);
                }
                return;
            }

            var actionBtn = event.target.closest('[data-act]');
            if (actionBtn) {
                var action = actionBtn.getAttribute('data-act');
                var id = actionBtn.getAttribute('data-id') || '';
                if (action === 'reply') {
                    openReplyBox(id, actionBtn.getAttribute('data-author') || '');
                } else if (action === 'cancel-reply') {
                    closeInlineBox(id, 'reply');
                } else if (action === 'edit') {
                    var editBox = document.getElementById('editBox-' + id);
                    if (editBox) {
                        editBox.hidden = false;
                        editBox.setAttribute('data-open', 'true');
                        var editText = document.getElementById('editText-' + id);
                        if (editText) {
                            autoResizeCommentTextarea(editText);
                            editText.focus();
                            editText.setSelectionRange(editText.value.length, editText.value.length);
                        }
                    }
                } else if (action === 'cancel-edit') {
                    closeInlineBox(id, 'edit');
                } else if (action === 'delete') {
                    window.deleteComment(id);
                }
                return;
            }

            var focusBtn = event.target.closest('[data-comment-focus]');
            if (focusBtn) {
                var mainText = document.getElementById('mainCommentText');
                if (mainText) {
                    mainText.focus();
                    mainText.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
                return;
            }

            var retryBtn = event.target.closest('[data-comment-retry]');
            if (retryBtn) {
                commentState.loaded = false;
                loadCommentsData(currentCommentsPresetId, { force: true });
            }
        });

        document.addEventListener('submit', function (event) {
            var form = event.target;
            if (!form || !form.getAttribute) return;
            if (form.id === 'mainCommentForm') {
                event.preventDefault();
                window.handleCommentSubmit(event);
                return;
            }
            var kind = form.getAttribute('data-comment-form');
            if (kind === 'reply') {
                event.preventDefault();
                window.handleReplySubmit(event, form.getAttribute('data-id'));
            } else if (kind === 'edit') {
                event.preventDefault();
                window.handleEditSubmit(event, form.getAttribute('data-id'));
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && event.target && event.target.id && event.target.id.indexOf('replyText-') === 0) {
                closeInlineBox(event.target.id.replace('replyText-', ''), 'reply');
            }
        });
    }

    window.toggleReplyBox = function (commentId, authorName) {
        var box = document.getElementById('replyBox-' + commentId);
        if (!box) return;
        if (box.hidden) openReplyBox(commentId, authorName);
        else closeInlineBox(commentId, 'reply');
    };

    window.toggleEditBox = function (commentId) {
        var box = document.getElementById('editBox-' + commentId);
        if (!box) return;
        if (box.hidden) {
            box.hidden = false;
            box.setAttribute('data-open', 'true');
            var textarea = document.getElementById('editText-' + commentId);
            if (textarea) {
                autoResizeCommentTextarea(textarea);
                textarea.focus();
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
        } else {
            closeInlineBox(commentId, 'edit');
        }
    };

    window.handleCommentKeydown = function (event, textarea) {
        if (window.isMentionPopupActive && window.isMentionPopupActive()) return;
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            var form = textarea && textarea.closest('form');
            if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    };

    window.handleReplyKeydown = function (event, parentId) {
        window.handleCommentKeydown(event, event.target);
        if (event.key === 'Escape') closeInlineBox(parentId, 'reply');
    };

    window.handleEditKeydown = function (event, commentId) {
        window.handleCommentKeydown(event, event.target);
    };

    function renderSubmitSpinner(button, label) {
        if (!button) return null;
        var original = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>' + (label || 'Sending');
        return function () {
            button.disabled = false;
            button.innerHTML = original;
        };
    }

    async function postComment(payload) {
        var res = await fetch('/api/comments', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        var data = await res.json().catch(function () { return {}; });
        return { ok: res.ok && data && data.success !== false, data: data || {} };
    }

    window.handleCommentSubmit = async function (event) {
        if (event && event.preventDefault) event.preventDefault();
        var textarea = document.getElementById('mainCommentText');
        if (!textarea || !textarea.value.trim()) return;
        if (!currentCommentsPresetId) {
            commentToast('This leak could not be identified. Refresh the page and try again.', 'error');
            return;
        }
        if (commentState.loading) return;
        if (hasCorruptedMediaBlock(textarea.value)) {
            commentToast(MEDIA_SERVICE_ERROR_MSG, 'error');
            return;
        }
        var restore = renderSubmitSpinner(document.getElementById('btnSubmitComment'), 'Posting');
        commentState.loading = true;
        try {
            var result = await postComment({ preset_id: currentCommentsPresetId, content: textarea.value.trim() });
            if (!result.ok) {
                commentToast(result.data.error || 'Could not post your comment.', 'error');
                return;
            }
            textarea.value = '';
            autoResizeCommentTextarea(textarea);
            var counter = document.getElementById('mainCommentCounter');
            if (counter) counter.textContent = '0/1000';
            closePickerPopover();
            commentToast('Comment posted.', 'success');
            var newId = result.data && result.data.comment && result.data.comment.id;
            await loadCommentsData(currentCommentsPresetId, { force: true, highlightId: newId });
        } catch (error) {
            commentToast('Network error — your comment was not posted.', 'error');
        } finally {
            commentState.loading = false;
            if (restore) restore();
            var submit = document.getElementById('btnSubmitComment');
            if (submit) submit.disabled = !textarea.value.trim();
        }
    };

    window.handleReplySubmit = async function (event, parentId) {
        if (event && event.preventDefault) event.preventDefault();
        var textarea = document.getElementById('replyText-' + parentId);
        if (!textarea || !textarea.value.trim() || !currentCommentsPresetId) return;
        if (hasCorruptedMediaBlock(textarea.value)) {
            commentToast(MEDIA_SERVICE_ERROR_MSG, 'error');
            return;
        }
        var form = textarea.closest('form');
        var restore = renderSubmitSpinner(form ? form.querySelector('button[type="submit"]') : null, 'Replying');
        try {
            var result = await postComment({
                preset_id: currentCommentsPresetId,
                parent_id: parentId,
                content: textarea.value.trim()
            });
            if (!result.ok) {
                commentToast(result.data.error || 'Could not post your reply.', 'error');
                return;
            }
            textarea.value = '';
            closeInlineBox(parentId, 'reply');
            closePickerPopover();
            commentToast('Reply posted.', 'success');
            await loadCommentsData(currentCommentsPresetId, { force: true });
        } catch (error) {
            commentToast('Network error — your reply was not posted.', 'error');
        } finally {
            if (restore) restore();
        }
    };

    window.handleEditSubmit = async function (event, commentId) {
        if (event && event.preventDefault) event.preventDefault();
        var textarea = document.getElementById('editText-' + commentId);
        if (!textarea || !textarea.value.trim() || !commentId) return;
        if (hasCorruptedMediaBlock(textarea.value)) {
            commentToast(MEDIA_SERVICE_ERROR_MSG, 'error');
            return;
        }
        var restore = renderSubmitSpinner(document.getElementById('btnSaveEdit-' + commentId), 'Saving');
        try {
            var res = await fetch('/api/comments/' + encodeURIComponent(commentId), {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: commentId, content: textarea.value.trim() })
            });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || (data && data.success === false)) {
                commentToast((data && data.error) || 'Could not save your changes.', 'error');
                return;
            }
            closeInlineBox(commentId, 'edit');
            commentToast('Comment updated.', 'success');
            await loadCommentsData(currentCommentsPresetId, { force: true });
        } catch (error) {
            commentToast('Network error — your changes were not saved.', 'error');
        } finally {
            if (restore) restore();
        }
    };

    window.deleteComment = async function (commentId) {
        if (!commentId) return;
        if (!window.confirm('Delete this comment? This cannot be undone.')) return;
        try {
            var res = await fetch('/api/comments/' + encodeURIComponent(commentId), {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!res.ok) {
                commentToast('Could not delete the comment.', 'error');
                return;
            }
            commentToast('Comment deleted.', 'success');
            await loadCommentsData(currentCommentsPresetId, { force: true });
        } catch (error) {
            commentToast('Network error — the comment was not deleted.', 'error');
        }
    };

    window.initCommentsComponent = async function (productId) {
        currentCommentsPresetId = productId;
        commentState.comments = [];
        commentState.total = 0;
        commentState.loaded = false;

        try {
            var raw = localStorage.getItem('zyrex_auth_user');
            if (raw) {
                var parsed = JSON.parse(raw);
                currentUserData = parsed && parsed.data ? parsed.data : (parsed && (parsed.id || parsed.username) ? parsed : null);
            }
        } catch (error) { /* keep the anonymous view */ }
        if (!currentUserData && (window.currentUser || window._currentUser)) {
            currentUserData = window.currentUser || window._currentUser;
        }

        wireCommentsPanel();
        renderCommentInputBox();
        renderCommentSkeleton();
        await loadCommentsData(productId, { force: true });

        try {
            var authRes = await fetch('/api/me', { credentials: 'include' });
            if (!authRes.ok) return;
            var user = await authRes.json();
            if (!user || !(user.id || user.username)) return;
            var changed = !currentUserData || String(currentUserData.id) !== String(user.id);
            currentUserData = user;
            renderCommentInputBox();
            if (changed && commentState.comments.length) renderCommentsTree(commentState.comments);
        } catch (error) { /* guest view stays */ }
    };
    window.initPresetComments = window.initCommentsComponent;


    /* ===================== @ MENTION AUTOCOMPLETE ===================== */
    var mentionPopupEl = null;
    var activeMentionTextarea = null;
    var activeMentionQuery = '';
    var activeMentionIndex = 0;
    var cachedMentionMembers = [];
    var mentionSearchTimeout = null;

    function getOrCreateMentionPopup() {
        if (!mentionPopupEl) {
            mentionPopupEl = document.createElement('div');
            mentionPopupEl.id = 'mentionAutocompletePopup';
            mentionPopupEl.className = 'mention-autocomplete-popup';
            document.body.appendChild(mentionPopupEl);

            document.addEventListener('click', function(e) {
                if (mentionPopupEl && !mentionPopupEl.contains(e.target) && e.target !== activeMentionTextarea) {
                    closeMentionPopup();
                }
            });
        }
        return mentionPopupEl;
    }

    window.isMentionPopupActive = function() {
        return mentionPopupEl && mentionPopupEl.classList.contains('active');
    };

    function closeMentionPopup() {
        if (mentionPopupEl) {
            mentionPopupEl.classList.remove('active');
            mentionPopupEl.innerHTML = '';
        }
        activeMentionTextarea = null;
        activeMentionQuery = '';
        activeMentionIndex = 0;
    }

    async function searchMentionMembers(query) {
        try {
            var res = await fetch('/api/guild/members?q=' + encodeURIComponent(query));
            if (res.ok) {
                var data = await res.json();
                if (data.success && Array.isArray(data.members)) {
                    return data.members;
                }
            }
        } catch(e) {}
        return [];
    }

    function positionMentionPopup(textarea) {
        var popup = getOrCreateMentionPopup();
        var rect = textarea.getBoundingClientRect();
        var top = window.scrollY + rect.top - popup.offsetHeight - 8;
        var left = window.scrollX + rect.left;
        popup.style.top = Math.max(10, top) + 'px';
        popup.style.left = Math.max(10, left) + 'px';
    }

    function renderMentionSuggestions(members) {
        var popup = getOrCreateMentionPopup();
        cachedMentionMembers = members;
        if (!members || members.length === 0) {
            popup.innerHTML = '<div style="padding:10px;font-size:0.78rem;color:var(--text-sub);text-align:center">No members found</div>';
            popup.classList.add('active');
            return;
        }

        popup.innerHTML = members.map(function(m, idx) {
            var isSelected = idx === activeMentionIndex;
            var avatar = m.avatar || window.DEFAULT_AVATAR;
            var dName = m.display_name || m.username;
            var handle = m.username ? ('@' + m.username) : '';
            return '<div class="mention-user-item ' + (isSelected ? 'selected' : '') + '" data-idx="' + idx + '" onmousedown="selectMentionUser(' + idx + ')">' +
                '<img src="' + avatar + '" class="mention-user-avatar" onerror="window.handleAvatarError(this)">' +
                '<div class="mention-user-info">' +
                '<div class="mention-user-name">' +
                '<span>' + escapeHtml(dName) + '</span>' +
                (m.is_admin ? '<i class="fas fa-circle-check" style="color:#38bdf8;font-size:0.75rem" title="Admin"></i>' : '') +
                '</div>' +
                '<span class="mention-user-handle">' + escapeHtml(handle) + '</span>' +
                '</div>' +
                '</div>';
        }).join('');

        popup.classList.add('active');
        if (activeMentionTextarea) positionMentionPopup(activeMentionTextarea);
    }

    window.selectMentionUser = function(idx) {
        if (!activeMentionTextarea || !cachedMentionMembers[idx]) return;
        var user = cachedMentionMembers[idx];
        var val = activeMentionTextarea.value;
        var cursor = activeMentionTextarea.selectionStart;

        var lastAt = val.lastIndexOf('@', cursor - 1);
        if (lastAt !== -1) {
            var tagText = '@' + (user.username || user.display_name.replace(/\s+/g, '_')) + ' ';
            var newVal = val.slice(0, lastAt) + tagText + val.slice(cursor);
            activeMentionTextarea.value = newVal;
            var newCursor = lastAt + tagText.length;
            activeMentionTextarea.focus();
            activeMentionTextarea.setSelectionRange(newCursor, newCursor);
        }
        closeMentionPopup();
    };

    function attachMentionAutocomplete(textarea) {
        if (!textarea || textarea.dataset.mentionAttached) return;
        textarea.dataset.mentionAttached = 'true';

        textarea.addEventListener('input', function(e) {
            var val = textarea.value;
            var cursor = textarea.selectionStart;
            var textBeforeCursor = val.slice(0, cursor);
            var atMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\.\-]*)$/);

            if (atMatch) {
                activeMentionTextarea = textarea;
                activeMentionQuery = atMatch[1];
                activeMentionIndex = 0;

                clearTimeout(mentionSearchTimeout);
                mentionSearchTimeout = setTimeout(async function() {
                    var members = await searchMentionMembers(activeMentionQuery);
                    if (activeMentionTextarea === textarea) {
                        renderMentionSuggestions(members);
                    }
                }, 120);
            } else {
                closeMentionPopup();
            }
        });

        textarea.addEventListener('keydown', function(e) {
            if (!window.isMentionPopupActive()) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (cachedMentionMembers.length > 0) {
                    activeMentionIndex = (activeMentionIndex + 1) % cachedMentionMembers.length;
                    renderMentionSuggestions(cachedMentionMembers);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (cachedMentionMembers.length > 0) {
                    activeMentionIndex = (activeMentionIndex - 1 + cachedMentionMembers.length) % cachedMentionMembers.length;
                    renderMentionSuggestions(cachedMentionMembers);
                }
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                if (cachedMentionMembers.length > 0) {
                    e.preventDefault();
                    window.selectMentionUser(activeMentionIndex);
                }
            } else if (e.key === 'Escape') {
                closeMentionPopup();
            }
        });

        textarea.addEventListener('blur', function() {
            setTimeout(closeMentionPopup, 200);
        });
    }

    function bindMentionAutocompleteToAllInputs() {
        var mainTa = document.getElementById('mainCommentText');
        if (mainTa) attachMentionAutocomplete(mainTa);
        document.querySelectorAll('.mentionable-input').forEach(attachMentionAutocomplete);
    }


    console.log('[ChunkStore] Comments chunk ready.');
})(window);
