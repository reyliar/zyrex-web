/**
 * Zyrex Chunk Architecture — Comments & Discord Community Feed Chunk
 * On-demand loaded chunk for real-time Discord comments, sticker/GIF pickers,
 * mention autocomplete, Markdown parsing, and thread replies.
 */
(function(window) {
    'use strict';

    var currentCommentsPresetId = null;
    var currentUserData = null;
    var activeCommentInputId = 'mainCommentText';
    var MEDIA_SERVICE_ERROR_MSG = "Medya servisi şu anda kullanılamıyor.";
    var GIPHY_API_KEY = "dc6zaTOxFJmzC";

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
    window.autoResizeCommentTextarea = autoResizeCommentTextarea;

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

        var corruptedMediaBadge = '<div class="comment-media-wrap"><div style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,43,82,0.1);border:1px solid rgba(255,43,82,0.3);border-radius:8px;color:#ff6b8b;font-size:0.8rem"><i class="fas fa-triangle-exclamation"></i> <span>' + MEDIA_SERVICE_ERROR_MSG + '</span></div></div>';
        escaped = escaped.replace(/(?:&lt;u&gt;|<u>)?(?:__|@{1,3})?(?:DC|ZYREX)_MEDIA_BLOCK_\d+(?:__|@{1,3})?(?:&lt;\/u&gt;|<\/u>)?/gi, corruptedMediaBadge);
        escaped = escaped.replace(/\uE000(?:MB|CB|IC)\d+\uE000/g, corruptedMediaBadge);

        escaped = escaped.replace(/\n/g, '<br>');
        escaped = escaped.replace(/(?:<br>\s*)+<div class="comment-media-wrap">/g, '<div class="comment-media-wrap">');
        escaped = escaped.replace(/<\/div>(?:\s*<br>)+/g, '</div>');
        return escaped;
    }
    window.formatCommentContentWithMentions = formatCommentContentWithMentions;

    async function loadCommentsData(productId) {
        var tree = document.getElementById('commentsTreeContainer');
        if (!tree) return;

        try {
            var res = await fetch('/api/comments?preset_id=' + encodeURIComponent(productId));
            if (res.ok) {
                var data = await res.json();
                if (data.success) {
                    var comments = data.comments || [];
                    var badge = document.getElementById('commentsCountBadge');
                    if (badge) badge.textContent = data.total || comments.length;
                    renderCommentsTree(comments);
                }
            } else {
                tree.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-sub)">No comments yet. Be the first to start the discussion!</div>';
            }
        } catch(e) {
            tree.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.4)">Unable to load comments.</div>';
        }
    }
    window.loadCommentsData = loadCommentsData;

    function renderCommentsTree(comments) {
        var tree = document.getElementById('commentsTreeContainer');
        if (!tree) return;

        if (!comments || comments.length === 0) {
            tree.innerHTML = '<div style="text-align:center;padding:36px 0;color:var(--text-sub)">' +
                '<i class="far fa-comments" style="font-size:2rem;opacity:0.3;margin-bottom:10px;display:block"></i>' +
                '<div>No comments yet. Be the first to start the discussion!</div>' +
                '</div>';
            return;
        }

        tree.innerHTML = comments.map(function(c) { return renderSingleComment(c); }).join('');
        bindMentionAutocompleteToAllInputs();
    }
    window.renderCommentsTree = renderCommentsTree;

    function renderSingleComment(c, isReply) {
        var timeAgo = formatTimeAgo(c.created_at);
        var isAdmin = c.is_admin || (c.user_id && ["1421177012814614548"].includes(String(c.user_id)));
        var isCurrentAuthor = currentUserData && (String(currentUserData.id) === String(c.user_id) || (currentUserData.id && ["1421177012814614548"].includes(String(currentUserData.id))));
        var avatar = c.user_avatar || window.DEFAULT_AVATAR;
        var sourceLabel = c.source === 'discord' ? '<span class="source-pill-dc" title="Sent from Discord"><i class="fab fa-discord"></i> Discord</span>' : '';
        var rawAuthorName = c.user_name || 'User';

        var repliesHtml = (c.replies && c.replies.length > 0) 
            ? '<div class="replies-branch">' + c.replies.map(function(r) { return renderSingleComment(r, true); }).join('') + '</div>'
            : '';

        return '<div class="comment-item ' + (isReply ? 'reply-item' : '') + '" id="comment-' + c.id + '">' +
            '<div class="comment-avatar-wrap">' +
            '<img src="' + avatar + '" alt="' + escapeHtml(rawAuthorName) + '" class="comment-avatar ' + (isAdmin ? 'admin-glow' : '') + '" onerror="window.handleAvatarError(this)">' +
            '</div>' +
            '<div class="comment-body-wrap">' +
            '<div class="comment-header">' +
            '<div class="comment-user-title">' +
            '<span>' + escapeHtml(rawAuthorName) + '</span>' +
            (isAdmin ? '<i class="fas fa-circle-check" style="color:#38bdf8;font-size:0.8rem" title="Admin"></i>' : '') +
            sourceLabel +
            '</div>' +
            '<span class="comment-time">' + timeAgo + '</span>' +
            '</div>' +
            '<div class="comment-content" id="commentText-' + c.id + '">' + formatCommentContentWithMentions(c.content) + '</div>' +
            '<div class="comment-actions">' +
            (currentUserData ? '<button class="comment-act-btn reply-btn" onclick="toggleReplyBox(\'' + c.id + '\', \'' + escapeHtml(rawAuthorName).replace(/'/g, "\\'") + '\')"><i class="fas fa-reply"></i> Reply</button>' : '') +
            (isCurrentAuthor ? '<button class="comment-act-btn edit-btn" onclick="toggleEditBox(\'' + c.id + '\')"><i class="fas fa-pen-to-square"></i> Edit</button><button class="comment-act-btn delete-btn" onclick="deleteComment(\'' + c.id + '\')"><i class="fas fa-trash-can"></i> Delete</button>' : '') +
            '</div>' +
            '<div id="editBox-' + c.id + '" class="reply-box-inline" style="display:none;background:rgba(255,43,82,0.05);border-color:rgba(255,43,82,0.25)">' +
            '<form onsubmit="handleEditSubmit(event, \'' + c.id + '\')" style="margin:0">' +
            '<div style="font-size:0.75rem;color:var(--cherry-neon);margin-bottom:6px;font-weight:600"><i class="fas fa-pen"></i> Edit comment:</div>' +
            '<textarea id="editText-' + c.id + '" class="comment-textarea mentionable-input" style="min-height:55px;font-size:0.85rem" required maxlength="1000" oninput="autoResizeCommentTextarea(this)" onkeydown="handleEditKeydown(event, \'' + c.id + '\')">' + escapeHtml(c.content) + '</textarea>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px">' +
            '<span id="editCooldownNotice-' + c.id + '" style="font-size:0.72rem;color:#ff6b8b"></span>' +
            '<div style="display:flex;gap:8px">' +
            '<button type="button" class="comment-act-btn" onclick="toggleEditBox(\'' + c.id + '\')">Cancel</button>' +
            '<button type="submit" id="btnSaveEdit-' + c.id + '" class="comment-btn-submit" style="padding:6px 16px;font-size:0.78rem"><i class="fas fa-check"></i> Save</button>' +
            '</div>' +
            '</div>' +
            '</form>' +
            '</div>' +
            '<div id="replyBox-' + c.id + '" class="reply-box-inline" style="display:none;position:relative">' +
            '<form onsubmit="handleReplySubmit(event, \'' + c.id + '\')" style="margin:0">' +
            '<textarea id="replyText-' + c.id + '" class="comment-textarea mentionable-input" style="min-height:48px;font-size:0.85rem" placeholder="Write a reply... (Type @ to mention, Shift+Enter for new line)" required maxlength="1000" oninput="autoResizeCommentTextarea(this)" onkeydown="handleReplyKeydown(event, \'' + c.id + '\')"></textarea>' +
            '<div class="comment-tools-row" style="margin-top:8px">' +
            '<div class="comment-tools-left">' +
            '<button type="button" class="comment-tool-btn" onclick="toggleStickerPicker(this, \'replyText-' + c.id + '\', \'replyPicker-' + c.id + '\')" title="Discord Server Stickers"><i class="fas fa-face-smile"></i> <span>Sticker</span></button>' +
            '<button type="button" class="comment-tool-btn" onclick="toggleGifPicker(this, \'replyText-' + c.id + '\', \'replyPicker-' + c.id + '\')" title="Search GIFs via Giphy"><i class="fas fa-film"></i> <span>GIF</span></button>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px">' +
            '<button type="button" class="comment-act-btn" onclick="toggleReplyBox(\'' + c.id + '\')">Cancel</button>' +
            '<button type="submit" class="comment-btn-submit" style="padding:6px 16px;font-size:0.78rem"><i class="fas fa-paper-plane"></i> Reply</button>' +
            '</div>' +
            '</div>' +
            '<div id="replyPicker-' + c.id + '" class="popover-card" style="display:none"></div>' +
            '</form>' +
            '</div>' +
            repliesHtml +
            '</div>' +
            '</div>';
    }

    var commentEditTimers = {};

    window.toggleEditBox = function(commentId) {
        var box = document.getElementById('editBox-' + commentId);
        if (!box) return;
        var isHidden = box.style.display === 'none';
        box.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            var ta = document.getElementById('editText-' + commentId);
            if (ta) {
                ta.focus();
                ta.setSelectionRange(ta.value.length, ta.value.length);
            }
        }
    };

    window.handleEditKeydown = function(e, commentId) {
        if (window.isMentionPopupActive && window.isMentionPopupActive()) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            var form = e.target.closest('form');
            if (form) {
                if (typeof form.requestSubmit === 'function') form.requestSubmit();
                else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        }
    };

    window.handleEditSubmit = async function(e, commentId) {
        e.preventDefault();
        var ta = document.getElementById('editText-' + commentId);
        var btn = document.getElementById('btnSaveEdit-' + commentId);
        if (!ta || !ta.value.trim() || !commentId) return;

        if (hasCorruptedMediaBlock(ta.value)) {
            alert(MEDIA_SERVICE_ERROR_MSG);
            return;
        }

        btn.disabled = true;
        var origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            var res = await fetch('/api/comments/' + encodeURIComponent(commentId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: commentId, content: ta.value.trim() })
            });
            var data = await res.json();
            if (res.ok && data.success) {
                window.toggleEditBox(commentId);
                await loadCommentsData(currentCommentsPresetId);
            } else {
                alert(data.error || 'Failed to update comment');
            }
        } catch(err) {
            alert('Failed to edit comment. Please try again.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    };

    window.handleCommentKeydown = function(e, textarea) {
        if (window.isMentionPopupActive && window.isMentionPopupActive()) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            var form = textarea.closest('form');
            if (form) {
                if (typeof form.requestSubmit === 'function') form.requestSubmit();
                else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        }
    };

    window.handleReplyKeydown = function(e, parentId) {
        if (window.isMentionPopupActive && window.isMentionPopupActive()) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            var form = e.target.closest('form');
            if (form) {
                if (typeof form.requestSubmit === 'function') form.requestSubmit();
                else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        }
    };

    window.toggleReplyBox = function(commentId, authorName) {
        var box = document.getElementById('replyBox-' + commentId);
        if (!box) return;
        var isHidden = box.style.display === 'none';
        box.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            var ta = document.getElementById('replyText-' + commentId);
            if (ta) {
                if (authorName && !ta.value.trim()) {
                    ta.value = '@' + authorName + ' ';
                }
                ta.focus();
                ta.setSelectionRange(ta.value.length, ta.value.length);
            }
        } else {
            closePickerPopover();
        }
    };

    window.handleCommentSubmit = async function(e) {
        e.preventDefault();
        var ta = document.getElementById('mainCommentText');
        var btn = document.getElementById('btnSubmitComment');
        if (!ta || !ta.value.trim() || !currentCommentsPresetId) return;

        if (hasCorruptedMediaBlock(ta.value)) {
            alert(MEDIA_SERVICE_ERROR_MSG);
            return;
        }

        btn.disabled = true;
        var origText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

        try {
            var res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preset_id: currentCommentsPresetId, content: ta.value.trim() })
            });
            var data = await res.json();
            if (res.ok && data.success) {
                ta.value = '';
                ta.style.height = '38px';
                closePickerPopover();
                await loadCommentsData(currentCommentsPresetId);
            } else {
                alert(data.error || 'Failed to post comment');
            }
        } catch(err) {
            alert('Failed to submit comment. Please check your connection.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    };

    window.handleReplySubmit = async function(e, parentId) {
        e.preventDefault();
        var ta = document.getElementById('replyText-' + parentId);
        if (!ta || !ta.value.trim() || !currentCommentsPresetId) return;

        if (hasCorruptedMediaBlock(ta.value)) {
            alert(MEDIA_SERVICE_ERROR_MSG);
            return;
        }

        var btn = e.target.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;

        try {
            var res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preset_id: currentCommentsPresetId, parent_id: parentId, content: ta.value.trim() })
            });
            var data = await res.json();
            if (res.ok && data.success) {
                ta.value = '';
                closePickerPopover();
                window.toggleReplyBox(parentId);
                await loadCommentsData(currentCommentsPresetId);
            } else {
                alert(data.error || 'Failed to post reply');
            }
        } catch(err) {
            alert('Failed to submit reply. Please check your connection.');
        } finally {
            if (btn) btn.disabled = false;
        }
    };

    window.deleteComment = async function(commentId) {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        try {
            var res = await fetch('/api/comments/' + commentId, { method: 'DELETE' });
            if (res.ok) {
                await loadCommentsData(currentCommentsPresetId);
            } else {
                alert('Failed to delete comment.');
            }
        } catch(e) {
            alert('Error deleting comment.');
        }
    };

    window.initPresetComments = async function(productId) {
        currentCommentsPresetId = productId;
        
        try {
            var raw = localStorage.getItem('zyrex_auth_user');
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && parsed.data) currentUserData = parsed.data;
                else if (parsed && (parsed.id || parsed.username)) currentUserData = parsed;
            }
        } catch(e) {}

        renderCommentInputBox();
        loadCommentsData(productId);

        try {
            var authRes = await fetch('/api/me', { credentials: 'include' });
            if (authRes.ok) {
                var u = await authRes.json();
                if (u && (u.id || u.username)) {
                    currentUserData = u;
                    renderCommentInputBox();
                }
            }
        } catch(e) {}
    };

    function renderCommentInputBox() {
        var box = document.getElementById('commentInputContainer');
        if (!box) return;

        if (currentUserData && (currentUserData.id || currentUserData.username)) {
            var avatarUrl = currentUserData.avatar
                ? (currentUserData.avatar.startsWith('http') ? currentUserData.avatar : 'https://cdn.discordapp.com/avatars/' + currentUserData.id + '/' + currentUserData.avatar + '.png?size=64')
                : 'https://cdn.discordapp.com/embed/avatars/' + ((parseInt(currentUserData.id) || 0) % 5) + '.png';
            var dName = currentUserData.global_name || currentUserData.displayName || currentUserData.username || 'Zyrex Member';

            box.innerHTML = '<form id="mainCommentForm" onsubmit="handleCommentSubmit(event)" style="margin:0;position:relative">' +
                '<div style="display:flex;align-items:flex-start;gap:12px">' +
                '<img src="' + avatarUrl + '" alt="' + dName + '" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,0.12)" onerror="window.handleAvatarError(this)">' +
                '<div style="flex:1;min-width:0">' +
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:0.8rem;color:var(--text-sub)">' +
                '<strong style="color:#fff">' + dName + '</strong>' +
                '</div>' +
                '<textarea id="mainCommentText" class="comment-textarea" placeholder="Write a comment... (Shift+Enter for new line)" required maxlength="1000" oninput="autoResizeCommentTextarea(this)" onkeydown="handleCommentKeydown(event, this)"></textarea>' +
                '<div class="comment-tools-row">' +
                '<div class="comment-tools-left">' +
                '<button type="button" class="comment-tool-btn" id="btnStickerPicker" onclick="toggleStickerPicker(this)" title="Discord Server Stickers"><i class="fas fa-face-smile"></i> <span>Sticker</span></button>' +
                '<button type="button" class="comment-tool-btn" id="btnGifPicker" onclick="toggleGifPicker(this)" title="Search GIFs via Giphy"><i class="fas fa-film"></i> <span>GIF</span></button>' +
                '</div>' +
                '<button type="submit" id="btnSubmitComment" class="comment-btn-submit"><i class="fas fa-paper-plane"></i> Post</button>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '<div id="commentPickerPopover" class="popover-card" style="display:none"></div>' +
                '</form>';
            setTimeout(bindMentionAutocompleteToAllInputs, 50);
        } else {
            var redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
            box.innerHTML = '<div style="text-align:center;padding:16px 10px">' +
                '<i class="fab fa-discord" style="font-size:2rem;color:#5865f2;margin-bottom:10px"></i>' +
                '<h4 style="margin:0 0 6px;color:#fff;font-size:1rem">Join the Community Discussion</h4>' +
                '<p style="margin:0 0 16px;font-size:0.82rem;color:var(--text-sub)">Login with your Discord account to post comments, ask questions, or reply to creators.</p>' +
                '<a href="/api/login?redirect=' + redirectUrl + '" class="comment-btn-submit" style="text-decoration:none;background:#5865f2;box-shadow:0 4px 16px rgba(88,101,242,0.3)">' +
                '<i class="fab fa-discord"></i> Login with Discord to Comment' +
                '</a>' +
                '</div>';
        }
    }

    function closePickerPopover() {
        document.querySelectorAll('.popover-card').forEach(function(p) { p.style.display = 'none'; });
        document.querySelectorAll('.comment-tool-btn').forEach(function(b) { b.classList.remove('active'); });
    }
    window.closePickerPopover = closePickerPopover;

    function insertStickerToComment(name, url) {
        var txt = document.getElementById(activeCommentInputId || 'mainCommentText');
        if (!txt) return;
        var tag = '![sticker:' + name + '](' + url + ')';
        txt.value = txt.value.trim() ? (txt.value.trim() + '\n' + tag) : tag;
        closePickerPopover();
        autoResizeCommentTextarea(txt);
        txt.focus();
    }
    window.insertStickerToComment = insertStickerToComment;

    function insertGifToComment(url) {
        var txt = document.getElementById(activeCommentInputId || 'mainCommentText');
        if (!txt) return;
        var tag = '![gif](' + url + ')';
        txt.value = txt.value.trim() ? (txt.value.trim() + '\n' + tag) : tag;
        closePickerPopover();
        autoResizeCommentTextarea(txt);
        txt.focus();
    }
    window.insertGifToComment = insertGifToComment;

    document.addEventListener('click', function(e) {
        var openPopover = document.querySelector('.popover-card[style*="display: block"]');
        if (!openPopover) return;
        if (!openPopover.contains(e.target) && !e.target.closest('.comment-tool-btn')) {
            closePickerPopover();
        }
    });

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

    console.log('[ChunkStore] Comments chunk loaded.');
})(window);

