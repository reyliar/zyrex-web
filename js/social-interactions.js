(function () {
    'use strict';
    var esc = function (value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
    var statusAlert = function (message, error) { if (window.showStatusAlert && message) window.showStatusAlert(message, !!error); };
    // Same rule the worker applies: known image hosts are read through the site proxy so
    // a remote CDN can never leave a sticker, GIF or upload broken.
    var mediaSrc = function (value) {
        var url = String(value || '');
        // GIF hosts are proxied because they can object to a foreign referer; Discord's
        // sticker CDN already serves cross-site images, and rejects worker-side fetches.
        return /^https:\/\/(?:media\d*\.giphy\.com|i\.giphy\.com|media\.tenor\.com|tenor\.com)\//i.test(url) ? '/api/media?u=' + encodeURIComponent(url) : url;
    };
    var isImageUrl = function (value) { return /\.(?:apng|gif|webp|png|jpe?g)$/i.test(String(value || '').split('?')[0]); };
    // Stickers get a small, centred frame; GIFs stay wide enough to read the motion.
    var mediaClass = function (value) {
        var url = String(value || '');
        if (/\/stickers\//i.test(url)) return ' is-sticker';
        if (/(?:giphy|tenor)\.(?:com|co)\//i.test(url)) return ' is-gif';
        return '';
    };
    var readImageFile = function (file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || '')); };
            reader.onerror = function () { reject(new Error('That image could not be read.')); };
            reader.readAsDataURL(file);
        });
    };
    // Screenshots are large; the feed never needs more than 1600px wide.
    var shrinkImage = function (dataUrl) {
        return new Promise(function (resolve, reject) {
            var image = new Image();
            image.onload = function () {
                var limit = 1600, width = image.width, height = image.height;
                if (width > limit || height > limit) {
                    var scale = Math.min(limit / width, limit / height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }
                var canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                var context = canvas.getContext('2d');
                if (!context) { reject(new Error('That image could not be processed.')); return; }
                context.drawImage(image, 0, 0, width, height);
                resolve(canvas.toDataURL(/^data:image\/png/i.test(dataUrl) ? 'image/png' : 'image/jpeg', 0.86));
            };
            image.onerror = function () { reject(new Error('That image could not be read.')); };
            image.src = dataUrl;
        });
    };
    var uploadImage = function (file, kind) {
        return readImageFile(file)
            .then(function (dataUrl) { return /^data:image\/gif/i.test(dataUrl) ? dataUrl : shrinkImage(dataUrl); })
            .then(function (payload) {
                return fetch('/api/profile/media', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: payload, kind: kind || 'post' })
                }).then(function (response) {
                    return response.json().then(function (data) {
                        if (!response.ok || !data.success || !data.url) throw new Error(data.error || 'That image could not be uploaded.');
                        return data;
                    });
                });
            });
    };
    window.ZyrexMedia = { upload: uploadImage, src: mediaSrc };
    var descriptor = function (card) {
        return card.dataset.socialType === 'post'
            ? ['post', card.dataset.socialAuthor || '', card.dataset.socialId || ''].join('~')
            : ['resource', card.dataset.socialId || ''].join('~');
    };
    var api = function (method, payload, query) {
        var url = '/api/social/interactions' + (query ? '?' + query : '');
        return fetch(url, {
            method: method,
            credentials: 'include',
            headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
            body: method === 'POST' ? JSON.stringify(payload) : undefined
        }).then(function (response) {
            return response.json().then(function (data) {
                if (!response.ok || !data.success) {
                    var error = new Error(data.error || 'Could not load this conversation.');
                    error.status = response.status;
                    throw error;
                }
                return data;
            });
        });
    };
    function setCounts(card, row) {
        if (!row) return;
        var likes = card.querySelector('[data-social-likes]');
        var views = card.querySelector('[data-social-views]');
        var replies = card.querySelector('[data-social-replies]');
        var like = card.querySelector('[data-social-like]');
        if (likes) likes.textContent = row.likes || 0;
        if (views) views.textContent = row.views || 0;
        if (replies) replies.textContent = row.replies || 0;
        if (like) {
            like.classList.toggle('is-liked', !!row.liked);
            like.querySelector('i').className = (row.liked ? 'fas' : 'far') + ' fa-heart';
            var label = like.querySelector('[data-like-label]');
            if (label) label.textContent = row.liked ? 'Liked' : 'Like';
        }
    }
    // Replies share the composer's sticker and GIF sources, so a conversation looks the
    // same whether it starts in the feed or on a post permalink.
    function replyToolsMarkup() {
        return '<button type="button" class="pf-social-reply-attach" data-reply-image aria-label="Attach an image"><i class="fas fa-image"></i><span>Image</span></button>' +
            '<button type="button" class="pf-social-reply-attach" data-reply-sticker aria-label="Add a sticker"><i class="fas fa-face-smile"></i><span>Sticker</span></button>' +
            '<button type="button" class="pf-social-reply-attach" data-reply-gif aria-label="Add a GIF"><i class="fas fa-film"></i><span>GIF</span></button>' +
            '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>';
    }
    var replyTime = function (reply) {
        var stamp = Date.parse(reply && reply.created_at);
        if (!Number.isFinite(stamp)) return '';
        var minutes = Math.max(0, Math.round((Date.now() - stamp) / 60000));
        if (minutes < 1) return 'now';
        if (minutes < 60) return minutes + 'm';
        if (minutes < 1440) return Math.round(minutes / 60) + 'h';
        if (minutes < 43200) return Math.round(minutes / 1440) + 'd';
        return new Date(stamp).toLocaleDateString();
    };
    // The thread is two levels deep at most: a reply to a reply hangs off the same
    // top-level reply and keeps a "replying to" line so the addressee stays clear.
    function groupReplies(rows) {
        var byId = {}, roots = [], children = {};
        // Legacy comments can arrive without an id; they still have to show up, so they
        // get a local one instead of being dropped from the list.
        var list = (rows || []).filter(function (reply) { return reply && typeof reply === 'object'; })
            .map(function (reply, index) {
                if (reply.id) return reply;
                var copy = {};
                for (var key in reply) { if (Object.prototype.hasOwnProperty.call(reply, key)) copy[key] = reply[key]; }
                copy.id = 'local-' + index;
                return copy;
            });
        list.forEach(function (reply) { byId[reply.id] = reply; });
        list.forEach(function (reply) {
            var parent = reply.parent_id && byId[reply.parent_id] ? byId[reply.parent_id] : null;
            if (parent && parent.parent_id && byId[parent.parent_id]) parent = byId[parent.parent_id];
            if (parent && parent.id !== reply.id) (children[parent.id] = children[parent.id] || []).push(reply);
            else roots.push(reply);
        });
        return { roots: roots, children: children };
    }
    function replyItemMarkup(reply, isChild) {
        var author = reply.author || {};
        var avatar = esc(author.avatar || '/assets/default-avatar.png');
        var handle = String(author.handle || '');
        var images = (reply.media || []).map(function (src) {
            var url = String(src || '');
            return '<img class="pf-social-reply-media' + mediaClass(url) + '" src="' + esc(mediaSrc(url)) + '" alt="" loading="lazy">';
        }).join('');
        var target = reply.reply_to && (reply.reply_to.handle || reply.reply_to.name)
            ? '<span class="pf-social-reply-target"><i class="fas fa-turn-up"></i> ' + esc(reply.reply_to.handle ? '@' + reply.reply_to.handle : reply.reply_to.name) + '</span>'
            : '';
        var profileId = String(author.id || author.user_id || '').trim();
        var authorUrl = author.url || (/^\d{15,25}$/.test(profileId) ? '/profile?id=' + encodeURIComponent(profileId) : '#');
        return '<article class="pf-social-reply' + (isChild ? ' is-child' : '') + '" data-reply-item="' + esc(reply.id) + '">' +
            '<a class="pf-social-reply-author" data-profile-preview data-profile-id="' + esc(profileId) + '" href="' + esc(authorUrl) + '"><img src="' + avatar + '" alt="" loading="lazy" onerror="this.src=\'/assets/default-avatar.png\'">' +
            '<span><strong>' + esc(author.name || 'Zyrex Member') + (author.is_admin ? ' <i class="fas fa-circle-check is-admin-check" aria-label="Admin"></i>' : '') + '</strong>' +
            '<small>' + (handle ? '@' + esc(handle) + ' · ' : '') + esc(replyTime(reply)) + '</small></span></a>' +
            target +
            (reply.text ? '<p>' + esc(reply.text) + '</p>' : '') + images +
            '<footer class="pf-social-reply-actions"><button type="button" data-reply-to data-reply-id="' + esc(reply.id) + '" data-reply-name="' + esc(author.name || 'Zyrex Member') + '" data-reply-handle="' + esc(handle) + '"><i class="far fa-comment"></i> Reply</button></footer>' +
            '</article>';
    }
    function threadListMarkup(rows, options) {
        var opts = options || {};
        var grouped = groupReplies(rows);
        var roots = grouped.roots;
        var hidden = 0;
        if (opts.limit && roots.length > opts.limit) {
            hidden = roots.length - opts.limit;
            roots = roots.slice(-opts.limit);
        }
        var html = roots.map(function (root) {
            return replyItemMarkup(root, false) + ((grouped.children[root.id] || []).map(function (child) {
                return replyItemMarkup(child, true);
            }).join(''));
        }).join('');
        return {
            hidden: hidden,
            html: html || '<p class="pf-social-empty"><i class="far fa-comments"></i> No replies yet. Be the first to answer.</p>'
        };
    }
    function composerMarkup(target) {
        var isNested = Boolean(target && target.id);
        var label = isNested ? (target.handle ? '@' + target.handle : target.name) : '';
        return '<form class="pf-social-reply-form' + (isNested ? ' is-nested' : '') + '"' +
            ' data-reply-parent="' + esc(isNested ? target.id : '') + '"' +
            ' data-reply-name="' + esc(isNested ? target.name || '' : '') + '"' +
            ' data-reply-handle="' + esc(isNested ? target.handle || '' : '') + '">' +
            (isNested ? '<span class="pf-social-reply-replying"><i class="fas fa-reply"></i> Replying to ' + esc(label) + '<button type="button" data-reply-cancel aria-label="Cancel reply"><i class="fas fa-xmark"></i></button></span>' : '') +
            '<textarea maxlength="500" rows="2" placeholder="' + (isNested ? 'Reply to ' + esc(label) + '…' : 'Write a reply…') + '" aria-label="Write a reply"></textarea>' +
            '<div class="pf-social-reply-preview" data-reply-preview hidden></div>' +
            '<div class="pf-social-reply-bar">' + replyToolsMarkup() +
            '<span aria-live="polite"></span>' +
            '<button type="submit"><i class="fas fa-paper-plane"></i> Reply</button></div></form>';
    }
    // The list is always read-only: the composer only exists after a Reply click.
    function renderThread(card, rows, options) {
        var thread = card.querySelector('[data-social-thread]');
        if (!thread) return;
        var opts = options || {};
        var list = threadListMarkup(rows, opts);
        var count = (rows || []).length;
        thread.classList.toggle('is-preview', Boolean(opts.limit));
        thread.innerHTML = '<div class="pf-social-thread-head"><span><i class="far fa-comments"></i> ' + count + (count === 1 ? ' reply' : ' replies') + '</span>' +
            '<button type="button" class="pf-social-thread-close" data-thread-close aria-label="Hide the conversation"><i class="fas fa-chevron-up"></i></button></div>' +
            '<div class="pf-social-reply-list">' + list.html + '</div>' +
            (list.hidden ? '<button type="button" class="pf-social-thread-more" data-thread-more>' + list.hidden + ' earlier ' + (list.hidden === 1 ? 'reply' : 'replies') + ' <i class="fas fa-chevron-down"></i></button>' : '') +
            (opts.limit ? '' : '<button type="button" class="pf-social-thread-reply" data-social-reply-toggle><i class="far fa-comment"></i> Write a reply</button>');
        thread.dataset.replies = JSON.stringify((rows || []).slice(-200));
        thread.hidden = false;
    }
    function openComposer(card, target) {
        var thread = card.querySelector('[data-social-thread]');
        if (!thread) return;
        var anchor = null;
        if (target && target.id) {
            anchor = thread.querySelector('[data-reply-item="' + String(target.id).replace(/"/g, '') + '"]');
        }
        var host = anchor || thread;
        var existing = thread.querySelector('.pf-social-reply-form');
        if (existing) {
            var sameTarget = (existing.dataset.replyParent || '') === ((target && target.id) || '');
            existing.remove();
            if (sameTarget) return;
        }
        host.insertAdjacentHTML('beforeend', composerMarkup(target || null));
        // One composer at a time: the "Write a reply" stub would just sit next to it.
        Array.prototype.slice.call(thread.querySelectorAll('.pf-social-thread-reply')).forEach(function (stub) { stub.remove(); });
        var form = (anchor || thread).querySelector('.pf-social-reply-form');
        if (!form) return;
        var field = form.querySelector('textarea');
        if (field) {
            try { field.focus({ preventScroll: true }); } catch (_) { field.focus(); }
            try { form.scrollIntoView({ block: 'nearest' }); } catch (_) {}
        }
    }
    function loadThread(card) {
        var query = new URLSearchParams({ targets: descriptor(card), include: 'replies' });
        return api('GET', null, query.toString()).then(function (data) {
            var row = data.items && data.items[descriptor(card)] || {};
            setCounts(card, row);
            return row.items || [];
        });
    }
    // Feed cards show the tail of the conversation without a click; the count chip
    // opens the rest.
    function renderPreview(card, rows) {
        if (!rows || !rows.length) return;
        var thread = card.querySelector('[data-social-thread]');
        if (!thread || !thread.hidden) return;
        renderThread(card, rows, { limit: 2 });
        thread.classList.add('is-preview');
    }
    // Closing the composer leaves the conversation readable, so the stub comes back.
    function restoreReplyStub(card) {
        var thread = card && card.querySelector('[data-social-thread]');
        if (!thread || thread.hidden || thread.classList.contains('is-preview')) return;
        if (thread.querySelector('.pf-social-reply-form') || thread.querySelector('.pf-social-thread-reply')) return;
        thread.insertAdjacentHTML('beforeend', '<button type="button" class="pf-social-thread-reply" data-social-reply-toggle><i class="far fa-comment"></i> Write a reply</button>');
    }
    function paintReplyPreview(form) {
        if (!form) return;
        var box = form.querySelector('[data-reply-preview]');
        if (!box) return;
        var media = [];
        try { media = JSON.parse(form.dataset.replyMedia || '[]'); } catch (_) { media = []; }
        if (!media.length) {
            box.hidden = true;
            box.innerHTML = '';
            return;
        }
        box.innerHTML = media.map(function (url, index) {
            return '<span class="pf-social-reply-thumb' + mediaClass(url) + '"><img src="' + esc(mediaSrc(url)) + '" alt="" loading="lazy"><button type="button" data-reply-remove="' + index + '" aria-label="Remove attachment"><i class="fas fa-xmark"></i></button></span>';
        }).join('');
        box.hidden = false;
    }
    function confetti(button) {
        var rect = button.getBoundingClientRect();
        var x = rect.left + rect.width / 2;
        var y = rect.top + rect.height / 2;
        var colors = ['#ff2b52', '#ff7190', '#ffffff', '#f7a5ff', '#9abaff'];
        for (var i = 0; i < 18; i++) {
            var particle = document.createElement('i');
            var angle = (Math.PI * 2 * i) / 18 + Math.random() * .2;
            var distance = 24 + Math.random() * 42;
            particle.className = 'pf-like-confetti';
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
            particle.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
            particle.style.setProperty('--confetti-color', colors[i % colors.length]);
            document.body.appendChild(particle);
            setTimeout(function (node) { node.remove(); }, 850, particle);
        }
    }
    function mount(root) {
        if (!root) return;
        var cards = [];
        if (root.matches && root.matches('[data-social-type]')) cards.push(root);
        cards = cards.concat(Array.prototype.slice.call(root.querySelectorAll ? root.querySelectorAll('[data-social-type]') : []));
        cards = cards.filter(function (card) {
            if (card.dataset.socialMounted === 'true') return false;
            card.dataset.socialMounted = 'true';
            return true;
        });
        if (!cards.length) return;
        var params = new URLSearchParams();
        params.set('targets', cards.map(descriptor).join(','));
        api('GET', null, params.toString()).then(function (data) {
            cards.forEach(function (card) { setCounts(card, data.items && data.items[descriptor(card)]); });
        }).catch(function () {});
        // Cards that opt in (the feed timeline) also pull their conversation so the
        // latest replies can be previewed inline, in the same single request batch.
        var previews = cards.filter(function (card) { return card.hasAttribute('data-social-preview'); });
        if (previews.length) {
            var previewParams = new URLSearchParams();
            previewParams.set('targets', previews.map(descriptor).join(','));
            previewParams.set('include', 'replies');
            api('GET', null, previewParams.toString()).then(function (data) {
                previews.forEach(function (card) {
                    var row = (data.items && data.items[descriptor(card)]) || null;
                    if (!row) return;
                    setCounts(card, row);
                    if (row.replies > 0 && Array.isArray(row.items) && row.items.length) renderPreview(card, row.items);
                });
            }).catch(function () {});
        }
        if (!('IntersectionObserver' in window)) return;
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                var card = entry.target;
                api('POST', {
                    type: card.dataset.socialType,
                    id: card.dataset.socialId,
                    author_id: card.dataset.socialAuthor,
                    action: 'view'
                }).then(function (data) { setCounts(card, data.interaction); }).catch(function () {});
            });
        }, { threshold: .35 });
        cards.forEach(function (card) { observer.observe(card); });
    }
    document.addEventListener('click', function (event) {
        var like = event.target.closest('[data-social-like]');
        if (like) {
            var card = like.closest('[data-social-type]');
            if (!card) return;
            if (like.dataset.busy) return;
            like.dataset.busy = 'true';
            api('POST', { type: card.dataset.socialType, id: card.dataset.socialId, author_id: card.dataset.socialAuthor, action: 'like' })
                .then(function (data) { setCounts(card, data.interaction); if (data.interaction.liked) confetti(like); statusAlert(data.interaction.liked ? 'Post liked.' : 'Like removed.'); })
                .catch(function (error) { if (error.status === 401) location.href = '/api/login?redirect=' + encodeURIComponent(location.pathname + location.search); else statusAlert(error.message || 'Could not update your like.', true); })
                .finally(function () { delete like.dataset.busy; });
            return;
        }
        var attach = event.target.closest('[data-reply-image]');
        if (attach) {
            var attachForm = attach.closest('form');
            var picker = attachForm && attachForm.querySelector('input[type="file"]');
            if (picker) picker.click();
            return;
        }
        var stickerButton = event.target.closest('[data-reply-sticker]');
        if (stickerButton) { openReplyPicker('stickers', stickerButton.closest('form')); return; }
        var gifButton = event.target.closest('[data-reply-gif]');
        if (gifButton) { openReplyPicker('gifs', gifButton.closest('form')); return; }
        var dropImage = event.target.closest('[data-reply-remove]');
        if (dropImage) {
            var dropForm = dropImage.closest('form');
            var dropMedia = [];
            try { dropMedia = JSON.parse(dropForm.dataset.replyMedia || '[]'); } catch (_) { dropMedia = []; }
            dropMedia.splice(Number(dropImage.dataset.replyRemove), 1);
            dropForm.dataset.replyMedia = JSON.stringify(dropMedia);
            paintReplyPreview(dropForm);
            return;
        }
        var toggle = event.target.closest('[data-social-reply-toggle]');
        if (toggle) {
            var target = toggle.closest('[data-social-type]');
            if (!target) return;
            var thread = target.querySelector('[data-social-thread]');
            if (!thread) return;
            // Reply always opens the conversation *and* its composer; closing hides both.
            if (!thread.hidden && thread.querySelector('.pf-social-reply-form')) {
                thread.querySelector('.pf-social-reply-form').remove();
                restoreReplyStub(target);
                return;
            }
            var openWithComposer = function () { openComposer(target, null); };
            if (!thread.hidden && thread.querySelector('.pf-social-reply-list')) { openWithComposer(); return; }
            loadThread(target).then(function (rows) {
                renderThread(target, rows, {});
                openWithComposer();
            }).catch(function (error) {
                if (error.status === 401) location.href = '/api/login?redirect=' + encodeURIComponent(location.pathname + location.search);
            });
            return;
        }
        var repliesToggle = event.target.closest('[data-social-replies-toggle]');
        if (repliesToggle) {
            var repliesCard = repliesToggle.closest('[data-social-type]');
            if (!repliesCard) return;
            var repliesThread = repliesCard.querySelector('[data-social-thread]');
            if (!repliesThread) return;
            if (!repliesThread.hidden && !repliesThread.classList.contains('is-preview')) {
                repliesThread.hidden = true;
                return;
            }
            loadThread(repliesCard).then(function (rows) {
                renderThread(repliesCard, rows, {});
            }).catch(function (error) {
                if (error.status === 401) location.href = '/api/login?redirect=' + encodeURIComponent(location.pathname + location.search);
            });
            return;
        }
        var threadClose = event.target.closest('[data-thread-close]');
        if (threadClose) {
            var closeCard = threadClose.closest('[data-social-type]');
            var closeThread = closeCard && closeCard.querySelector('[data-social-thread]');
            if (closeThread) closeThread.hidden = true;
            return;
        }
        var threadMore = event.target.closest('[data-thread-more]');
        if (threadMore) {
            var moreCard = threadMore.closest('[data-social-type]');
            if (!moreCard) return;
            loadThread(moreCard).then(function (rows) { renderThread(moreCard, rows, {}); }).catch(function () {});
            return;
        }
        var replyTo = event.target.closest('[data-reply-to]');
        if (replyTo) {
            var replyCard = replyTo.closest('[data-social-type]');
            if (!replyCard) return;
            openComposer(replyCard, {
                id: replyTo.dataset.replyId || '',
                name: replyTo.dataset.replyName || '',
                handle: replyTo.dataset.replyHandle || ''
            });
            return;
        }
        var replyCancel = event.target.closest('[data-reply-cancel]');
        if (replyCancel) {
            var cancelForm = replyCancel.closest('.pf-social-reply-form');
            var cancelCard = replyCancel.closest('[data-social-type]');
            if (cancelForm) cancelForm.remove();
            restoreReplyStub(cancelCard);
            return;
        }
    });
    document.addEventListener('change', function (event) {
        var input = event.target.closest('.pf-social-reply-form input[type="file"]');
        if (!input) return;
        var form = input.closest('form');
        var file = input.files && input.files[0];
        input.value = '';
        if (!form || !file) return;
        var note = form.querySelector('[aria-live]');
        if (file.size > 8 * 1024 * 1024) { if (note) note.textContent = 'That image is larger than 8 MB.'; return; }
        var media = [];
        try { media = JSON.parse(form.dataset.replyMedia || '[]'); } catch (_) { media = []; }
        if (media.length >= 4) { if (note) note.textContent = 'You can attach up to 4 images.'; return; }
        if (note) note.textContent = 'Uploading image…';
        uploadImage(file, 'comment').then(function (data) {
            var current = [];
            try { current = JSON.parse(form.dataset.replyMedia || '[]'); } catch (_) { current = []; }
            current.push(data.url);
            form.dataset.replyMedia = JSON.stringify(current);
            paintReplyPreview(form);
            if (note) note.textContent = '';
        }).catch(function (error) {
            if (note) note.textContent = error.message || 'That image could not be uploaded.';
            statusAlert(error.message || 'That image could not be uploaded.', true);
        });
    });
    document.addEventListener('submit', function (event) {
        var form = event.target.closest('.pf-social-reply-form');
        if (!form) return;
        event.preventDefault();
        var card = form.closest('[data-social-type]');
        var textarea = form.querySelector('textarea');
        var submit = form.querySelector('button[type="submit"]');
        var note = form.querySelector('[aria-live]');
        var attachments = [];
        try { attachments = JSON.parse(form.dataset.replyMedia || '[]'); } catch (_) { attachments = []; }
        if (!card || (!textarea.value.trim() && !attachments.length)) return;
        submit.disabled = true;
        var parentId = form.dataset.replyParent || '';
        var payload = { type: card.dataset.socialType, id: card.dataset.socialId, author_id: card.dataset.socialAuthor, action: 'reply', text: textarea.value.trim(), media: attachments };
        if (parentId) {
            payload.parent_id = parentId;
            payload.reply_to = { id: parentId, name: form.dataset.replyName || '', handle: form.dataset.replyHandle || '' };
        }
        api('POST', payload)
            .then(function (data) {
                form.dataset.replyMedia = '';
                renderThread(card, data.interaction.items || [], {});
                setCounts(card, data.interaction);
                statusAlert(parentId ? 'Reply posted.' : 'Reply posted.');
            })
            .catch(function (error) {
                if (error.status === 401) location.href = '/api/login?redirect=' + encodeURIComponent(location.pathname + location.search);
                else { if (note) note.textContent = error.message || 'Reply could not be sent.'; statusAlert(error.message || 'Reply could not be sent.', true); }
            })
            .finally(function () { submit.disabled = false; });
    });
    // ── Reply sticker & GIF picker ───────────────────────────────────────────
    // Same sources as the feed composer: the guild's Discord stickers and Giphy.
    var GIF_API_KEY = 'hF2tiiF3deZinjO4V7X75pc1q1CwLTkp';
    var replyPickerState = { kind: '', form: null, timer: 0, stickers: null, request: 0 };
    function replyMediaList(form) {
        try { return JSON.parse(form.dataset.replyMedia || '[]'); } catch (_) { return []; }
    }
    function replyNote(form, message, isError) {
        var note = form && form.querySelector('[aria-live]');
        if (!note) return;
        note.textContent = message || '';
        note.classList.toggle('is-error', Boolean(isError));
    }
    function addReplyMedia(form, url) {
        if (!form || !url) return;
        var media = replyMediaList(form);
        if (media.length >= 4) { replyNote(form, 'You can attach up to 4 items.'); return; }
        media.push(url);
        form.dataset.replyMedia = JSON.stringify(media);
        paintReplyPreview(form);
        replyNote(form, '');
    }
    function pickerNode() { return document.getElementById('pfReplyPicker'); }
    function pickerGrid() { return document.getElementById('pfReplyPickerGrid'); }
    function pickerNote(message, isError) {
        var note = document.getElementById('pfReplyPickerNote');
        if (!note) return;
        note.textContent = message || '';
        note.classList.toggle('is-error', Boolean(isError));
    }
    function closeReplyPicker() {
        var modal = pickerNode();
        if (modal) modal.hidden = true;
        document.body.classList.remove('pf-modal-open');
        replyPickerState.form = null;
        replyPickerState.request += 1;
        pickerNote('');
    }
    function loadReplyStickers() {
        var grid = pickerGrid();
        if (!grid) return;
        var request = ++replyPickerState.request;
        var promise = replyPickerState.stickers
            ? Promise.resolve(replyPickerState.stickers)
            : fetch('/api/guild/stickers', { credentials: 'include' })
                .then(function (response) { if (!response.ok) throw new Error('stickers'); return response.json(); })
                .then(function (data) {
                    replyPickerState.stickers = Array.isArray(data.stickers) ? data.stickers : [];
                    return replyPickerState.stickers;
                });
        promise.then(function (items) {
            if (request !== replyPickerState.request || replyPickerState.kind !== 'stickers') return;
            var usable = (items || []).filter(function (sticker) { return sticker && sticker.url && isImageUrl(sticker.url); });
            if (!usable.length) { grid.innerHTML = '<span class="pf-media-modal-empty">No server stickers found.</span>'; return; }
            grid.innerHTML = usable.map(function (sticker) {
                return '<button type="button" class="pf-media-modal-item is-sticker" data-reply-pick="' + esc(sticker.url.split('?')[0]) + '" title="' + esc(sticker.name) + '"><img src="' + esc(sticker.url) + '" alt="" loading="lazy"><span class="sr-only">' + esc(sticker.name) + '</span></button>';
            }).join('');
        }).catch(function () { if (request === replyPickerState.request) grid.innerHTML = '<span class="pf-media-modal-empty">Could not load server stickers.</span>'; });
    }
    function loadReplyGifs(query) {
        var grid = pickerGrid();
        if (!grid) return;
        var request = ++replyPickerState.request;
        grid.innerHTML = '<span class="pf-media-modal-empty">Loading GIFs…</span>';
        var url = 'https://api.giphy.com/v1/gifs/' + (query ? 'search' : 'trending') +
            '?api_key=' + GIF_API_KEY + '&limit=24&rating=pg-13' + (query ? '&q=' + encodeURIComponent(query) : '');
        fetch(url).then(function (response) { if (!response.ok) throw new Error('giphy'); return response.json(); }).then(function (data) {
            if (request !== replyPickerState.request || replyPickerState.kind !== 'gifs') return;
            var rows = Array.isArray(data.data) ? data.data : [];
            var gifs = rows.map(function (item) {
                var images = item.images || {};
                var preview = (images.fixed_height_small && images.fixed_height_small.url) || (images.fixed_height && images.fixed_height.url) || '';
                var options = [images.fixed_height && images.fixed_height.url, images.fixed_width && images.fixed_width.url, images.downsized_medium && images.downsized_medium.url, preview];
                var full = '';
                for (var i = 0; i < options.length; i += 1) {
                    var candidate = String(options[i] || '').split('?')[0];
                    if (candidate && isImageUrl(candidate)) { full = candidate; break; }
                }
                return { preview: preview, url: full };
            }).filter(function (gif) { return gif.preview && gif.url; });
            if (!gifs.length) { grid.innerHTML = '<span class="pf-media-modal-empty">No GIFs found.</span>'; return; }
            grid.innerHTML = gifs.map(function (gif) {
                return '<button type="button" class="pf-media-modal-item" data-reply-pick="' + esc(gif.url) + '" title="GIF"><img src="' + esc(gif.preview) + '" alt="" loading="lazy"></button>';
            }).join('');
        }).catch(function () { if (request === replyPickerState.request) grid.innerHTML = '<span class="pf-media-modal-empty">Could not load GIFs.</span>'; });
    }
    function ensureReplyPicker() {
        var existing = pickerNode();
        if (existing) return existing;
        var modal = document.createElement('div');
        modal.className = 'pf-media-modal pf-reply-picker';
        modal.id = 'pfReplyPicker';
        modal.hidden = true;
        modal.innerHTML = '<div class="pf-media-modal-backdrop" data-reply-picker-close></div>' +
            '<div class="pf-media-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="pfReplyPickerTitle">' +
            '<div class="pf-media-modal-head"><strong id="pfReplyPickerTitle">Stickers</strong>' +
            '<button type="button" class="pf-media-modal-close" data-reply-picker-close aria-label="Close"><i class="fas fa-xmark"></i></button></div>' +
            '<input class="pf-feed-gif-search" id="pfReplyGifSearch" placeholder="Search GIFs..." autocomplete="off" hidden>' +
            '<div class="pf-media-modal-grid" id="pfReplyPickerGrid"></div>' +
            '<p class="pf-media-modal-note" id="pfReplyPickerNote" aria-live="polite"></p></div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (event) {
            var choice = event.target.closest('[data-reply-pick]');
            if (choice) {
                var form = replyPickerState.form;
                var url = choice.getAttribute('data-reply-pick');
                closeReplyPicker();
                addReplyMedia(form, url);
                return;
            }
            if (event.target.closest('[data-reply-picker-close]')) closeReplyPicker();
        });
        var search = modal.querySelector('#pfReplyGifSearch');
        search.addEventListener('input', function () {
            var value = this.value.trim();
            clearTimeout(replyPickerState.timer);
            replyPickerState.timer = setTimeout(function () { loadReplyGifs(value); }, 260);
        });
        return modal;
    }
    function openReplyPicker(kind, form) {
        if (!form) return;
        var modal = ensureReplyPicker();
        replyPickerState.kind = kind;
        replyPickerState.form = form;
        modal.hidden = false;
        document.body.classList.add('pf-modal-open');
        var title = document.getElementById('pfReplyPickerTitle');
        if (title) title.textContent = kind === 'stickers' ? 'Discord stickers' : 'GIFs';
        var search = document.getElementById('pfReplyGifSearch');
        if (search) { search.hidden = kind === 'stickers'; search.value = ''; }
        pickerNote('');
        var grid = pickerGrid();
        if (grid) grid.innerHTML = '<span class="pf-media-modal-empty">Loading…</span>';
        if (kind === 'stickers') loadReplyStickers(); else loadReplyGifs('');
    }
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && replyPickerState.form) closeReplyPicker();
    });

    window.ZyrexSocialInteractions = { mount: mount, replyTools: replyToolsMarkup, thread: threadListMarkup, composer: composerMarkup };
    var boot = function () {
        mount(document);
        new MutationObserver(function (records) {
            records.forEach(function (record) { record.addedNodes.forEach(function (node) { if (node.nodeType === 1) mount(node); }); });
        }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
