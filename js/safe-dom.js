/**
 * Zyrex escaping helpers.
 *
 * Values that come from the database (names, descriptions, passwords, file names) end up
 * inside inline event handlers such as onclick="fn('${value}')". A quote or a newline in
 * those values used to break the handler and throw
 * `SyntaxError: Invalid or unexpected token` / "string literal contains an unescaped line
 * break" for the whole page. Every value placed in one of those contexts must go through
 * ZyrexEscape.js(), and every value placed in an attribute through ZyrexEscape.attr().
 *
 * HTML entities are NOT a substitute: the browser decodes them before parsing the handler,
 * so escapeHtml("John's pack") still breaks the JavaScript.
 */
(function () {
    'use strict';
    if (window.ZyrexEscape) return;

    var HTML_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

    // Quote a value so it is safe inside a '...' JavaScript string.
    function js(value) {
        return String(value == null ? '' : value)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${')
            .replace(/\r\n?/g, '\\n')
            .replace(/\n/g, '\\n')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029')
            .replace(/<\/(script)/gi, '<\\/$1')
            .replace(/<!--/g, '<\\!--');
    }

    function html(value) {
        return String(value == null ? '' : value).replace(/[&<>"'`]/g, function (character) {
            return HTML_MAP[character];
        });
    }

    // Safe for an attribute that itself contains a JS string.
    function attr(value) {
        return html(value);
    }

    window.ZyrexEscape = { js: js, html: html, attr: attr };

    // Shared image error handling so pages stop building inline handlers out of strings.
    window.ZyrexSafe = window.ZyrexSafe || {};
    window.ZyrexSafe.imageFallback = function (img, iconClass) {
        if (!img) return;
        var box = document.createElement('div');
        box.className = 'fallback-icon-box';
        var icon = document.createElement('span');
        icon.className = 'cat-svg-icon' + (iconClass ? ' ' + String(iconClass) : '');
        icon.style.fontSize = '3.5rem';
        box.appendChild(icon);
        if (img.parentNode) img.parentNode.replaceChild(box, img);
    };
    window.ZyrexSafe.hideOnError = function (img, iconId) {
        if (!img) return;
        img.style.display = 'none';
        var icon = iconId ? document.getElementById(iconId) : img.nextElementSibling;
        if (icon) icon.style.display = 'inline-block';
    };
    window.ZyrexSafe.avatarOnError = function (img) {
        if (!img) return;
        img.onerror = null;
        img.src = '/assets/default-avatar.png';
    };

    // Password / share-text copy buttons read the value from a data attribute, so a quote
    // or a newline in the value can no longer break the inline handler that used to hold it.
    window.copyFieldValue = function (element) {
        if (!element) return;
        var value = element.dataset ? element.dataset.copy : '';
        if (!value) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).then(function () {
                window.alert('Password copied!');
            }).catch(function () {
                window.prompt('Copy the password:', value);
            });
            return;
        }
        window.prompt('Copy the password:', value);
    };

    window.insertStickerFromButton = function (button) {
        if (!button || !button.dataset) return;
        if (typeof window.insertStickerToComment !== 'function') return;
        var popover = button.closest ? button.closest('.popover-card') : null;
        var target = popover ? popover.getAttribute('data-target-input') : '';
        window.insertStickerToComment(button.dataset.stickerName || '', button.dataset.stickerUrl || '', target || undefined);
    };

    // GIF tiles live in the same popover, so they resolve their target the same way.
    window.insertGifFromButton = function (button) {
        if (!button || !button.dataset) return;
        if (typeof window.insertGifToComment !== 'function') return;
        var popover = button.closest ? button.closest('.popover-card') : null;
        var target = popover ? popover.getAttribute('data-target-input') : '';
        window.insertGifToComment(button.dataset.gifUrl || '', target || undefined);
    };
})();
