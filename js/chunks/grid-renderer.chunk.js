/**
 * Zyrex Chunk Architecture — Grid Renderer Chunk
 * High-performance progressive card renderer using chunked DOM hydration.
 * Eliminates main-thread blocking, layout thrashing, and frame drops.
 */
(function(window) {
    'use strict';

    function buildPresetCardHtml(item, downloadCounts, likeCounts) {
        var cat = typeof window.getCategoryLabel === 'function' ? window.getCategoryLabel(item.category) : (item.category || 'Preset');
        var catClass = 'tag-' + (item.category || 'others');
        var catSvgClass = typeof window.getCategorySvgClass === 'function' ? window.getCategorySvgClass(item.category) : 'cat-icon-others';
        var catSvgIcon = '<span class="cat-svg-icon ' + catSvgClass + '" style="margin-right:4px"></span>';
        var descriptionText = item.description || item.desc || '';
        var shortDesc = descriptionText ? descriptionText.substring(0, 80) + (descriptionText.length > 80 ? '...' : '') : '';
        var discordIdMatch = (item.creator_avatar || item.uploader_avatar || '').match(/\/avatars\/(\d{17,20})\//);
        var extractedDiscordId = discordIdMatch ? discordIdMatch[1] : '';

        var uploaderName = (item.uploader_name || item.creator_nickname || item.author_name || 'Zyrex').trim();
        var uploaderId = (item.uploader_id || extractedDiscordId || item.author_id || '').trim();
        var uploaderAv = (item.uploader_avatar || item.creator_avatar || item.author_avatar || '').trim();
        var avatarHtml = '<img src="' + (uploaderAv || window.DEFAULT_AVATAR) + '" class="preset-card-avatar" data-uploader-id="' + uploaderId + '" data-fallback="' + uploaderAv + '" alt="" loading="lazy" decoding="async" onerror="window.handleAvatarError(this)">';
        var dlCount = downloadCounts[item.id] || item.downloads || 0;
        var likeCount = likeCounts[item.id] || 0;

        var thumbHtml = item.thumbnail ? 
            '<img src="' + item.thumbnail + '" class="rimg" alt="" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.parentElement.querySelector(\'.rimg-fallback\').style.display=\'flex\'">' +
            '<div class="rimg-fallback" style="display:none"><span class="cat-svg-icon ' + catSvgClass + '" style="font-size:2.8rem"></span></div>' : 
            '<div class="rimg-fallback"><span class="cat-svg-icon ' + catSvgClass + '" style="font-size:2.8rem"></span></div>';

        var itemType = (item.type || '').toLowerCase();
        var detailUrl = '/resource?id=' + encodeURIComponent(item.id);
        if (itemType === 'scenepack') detailUrl = '/product-scenepack?id=' + encodeURIComponent(item.id);
        else if (itemType === 'audio') detailUrl = '/product-audio?id=' + encodeURIComponent(item.id);
        else if (itemType === 'plugin' || itemType === 'software') detailUrl = '/product?id=' + encodeURIComponent(item.id);

        var subcats = typeof window.getProductSubcategories === 'function' ? window.getProductSubcategories(item) : ['preset'];
        var subcatBadges = subcats.map(function(sc) {
            if (sc === 'project-file') {
                return '<span class="tag-project-file">Project File</span>';
            } else if (sc === 'setting-preset') {
                var isTopaz = (item.setting_preset_type === 'topaz-labs') || (item.category === 'topaz-labs');
                var topazIcon = isTopaz ? '<span class="cat-svg-icon cat-icon-topaz" style="margin-right:4px"></span>' : '';
                return '<span class="tag-setting-preset">' + topazIcon + 'Setting Preset</span>';
            } else {
                return '<span class="tag-preset">Preset</span>';
            }
        }).join('');

        return '<a href="' + detailUrl + '" class="rc">' +
            '<div class="rc-img">' +
            thumbHtml +
            '<div class="roverlay"></div>' +
            '<div class="rbadge grid-badge">' + subcatBadges + '<span class="' + catClass + '">' + catSvgIcon + cat + '</span><span class="tag-free">Free</span></div>' +
            '</div>' +
            '<div class="rc-content">' +
            '<div class="rc-head">' +
            '<h3 class="rc-title" title="' + (item.name || '') + '">' + (item.name || '') + '</h3>' +
            '<div class="rbadge list-badge">' + subcatBadges + '<span class="' + catClass + '">' + catSvgIcon + cat + '</span><span class="tag-free">Free</span></div>' +
            '</div>' +
            (shortDesc ? '<p class="rc-desc">' + shortDesc + '</p>' : '') +
            '<div class="rc-footer">' +
            '<div class="rc-meta">' +
            '<div class="rava-fb">' + avatarHtml + '</div>' +
            '<span class="rname preset-card-name" data-uploader-id="' + uploaderId + '">' + uploaderName + '</span></div>' +
            '<div class="rc-actions">' +
            '<span><i class="fas fa-download"></i> ' + dlCount + '</span>' +
            '<span><i class="fas fa-heart"></i> ' + likeCount + '</span>' +
            '</div></div></div></a>';
    }

    /**
     * Progressive Chunked Renderer for Preset / Resource Cards
     */
    window.renderPresetGridChunked = function(grid, pageItems, options) {
        if (!grid) return;
        var opts = options || {};
        var downloadCounts = opts.downloadCounts || {};
        var likeCounts = opts.likeCounts || {};

        if (window.ZyrexChunkStore && typeof window.ZyrexChunkStore.renderProgressive === 'function') {
            window.ZyrexChunkStore.renderProgressive(grid, pageItems, function(item) {
                return buildPresetCardHtml(item, downloadCounts, likeCounts);
            }, {
                subChunkSize: 10,
                onComplete: function() {
                    if (typeof window.loadPresetAvatars === 'function') {
                        window.loadPresetAvatars();
                    }
                    if (typeof opts.onRenderComplete === 'function') {
                        opts.onRenderComplete();
                    }
                }
            });
        } else {
            // Instant fallback
            grid.innerHTML = pageItems.map(function(item) {
                return buildPresetCardHtml(item, downloadCounts, likeCounts);
            }).join('');
            if (typeof window.loadPresetAvatars === 'function') {
                window.loadPresetAvatars();
            }
        }
    };

    console.log('[ChunkStore] Grid renderer chunk loaded.');
})(window);

