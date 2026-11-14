// Remember the last in-site page so pages with a "back" affordance (settings)
// can return a visitor where they came from, not always to the home page.
window.ZyrexHistory = {
    key: 'zyrex_last_page',
    remember: function () {
        try {
            var path = location.pathname.replace(/\/+$/, '') || '/';
            if (path === '/settings') return;
            sessionStorage.setItem(this.key, path + location.search + location.hash);
        } catch (e) {}
    },
    previous: function () {
        try { return sessionStorage.getItem(this.key) || ''; } catch (e) { return ''; }
    }
};
window.ZyrexHistory.remember();

// Timed pollers stand down while the tab is hidden or the device is offline: a
// background tab cannot show the update, and every avoidable request is another
// chance for a split-second network blip to look like a site fault.
window.ZyrexPoll = {
    whileVisible: function (task, intervalMs) {
        var lastRunAt = 0;
        function run() {
            lastRunAt = Date.now();
            try { task(); } catch (e) {}
        }
        setInterval(function () {
            if (document.visibilityState === 'hidden' || navigator.onLine === false) return;
            run();
        }, intervalMs);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState !== 'visible' || navigator.onLine === false) return;
            if (Date.now() - lastRunAt < 5000) return;
            run();
        });
        window.addEventListener('online', function () {
            if (document.visibilityState === 'hidden') return;
            if (Date.now() - lastRunAt < 5000) return;
            run();
        });
        return run;
    }
};


// Markdown for resource descriptions. Rendering is escape-first: the source is
// HTML-escaped before any markdown is applied, so a description can never inject
// markup, and link targets are restricted to safe schemes.
window.ZyrexMarkdown = (function () {
    var SAFE_SCHEME = /^(?:https?:\/\/|mailto:|tel:)/i;
    var PLACEHOLDER = '\u0000';

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Only explicit web, mail and telephone URLs, or same-site paths, may become
    // links. Anything else (javascript:, data:, vbscript:) is dropped.
    function safeUrl(raw) {
        var url = String(raw == null ? '' : raw).trim().replace(/^<|>$/g, '');
        if (!url) return '';
        if (SAFE_SCHEME.test(url)) return url;
        if (url.charAt(0) === '/' || url.charAt(0) === '#') return url;
        return '';
    }

    function anchor(href, label, title) {
        var external = /^https?:\/\//i.test(href);
        return '<a href="' + href + '"' + (title ? ' title="' + title + '"' : '') +
            (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + label + '</a>';
    }

    function renderInline(text) {
        var store = [];
        function keep(html) { store.push(html); return PLACEHOLDER + store.length + 'x' + PLACEHOLDER; }
        var out = String(text == null ? '' : text);

        // Code spans go first so their contents are never read as markdown.
        out = out.replace(/`([^`]+)`/g, function (m, code) { return keep('<code>' + code + '</code>'); });

        out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (m, alt, url, title) {
            var href = safeUrl(url);
            if (!href) return alt;
            return keep('<img src="' + href + '" alt="' + alt + '"' + (title ? ' title="' + title + '"' : '') +
                ' loading="lazy" style="max-width:100%;height:auto;border-radius:10px">');
        });

        out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (m, label, url, title) {
            var href = safeUrl(url);
            if (!href) return label;
            return keep(anchor(href, renderInline(label), title));
        });

        // <https://example.com> style autolinks
        out = out.replace(/&lt;((?:https?:\/\/|mailto:)[^&\s]+)&gt;/gi, function (m, url) {
            var href = safeUrl(url);
            return href ? keep(anchor(href, url, '')) : url;
        });

        // Bare URLs, kept out of the way of anything already linked.
        out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]*[^\s<).,;:!?])/g, function (m, lead, url) {
            return lead + keep(anchor(url, url, ''));
        });

        out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
        out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        out = out.replace(/(^|[^\w*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
        // Underscore emphasis needs word boundaries and must not cross a line
        // break, so snake_case and __dunder__ names are left alone.
        out = out.replace(/(^|[^\w_])__([^\s_][^_\n]*?)__([^\w_]|$)/g, '$1<strong>$2</strong>$3');
        out = out.replace(/(^|[^\w_])_([^\s_][^_\n]*?)_([^\w_]|$)/g, '$1<em>$2</em>$3');
        out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
        out = out.replace(/==([^=]+)==/g, '<mark>$1</mark>');

        return out.replace(new RegExp(PLACEHOLDER + '(\\d+)x' + PLACEHOLDER, 'g'), function (m, i) {
            return store[Number(i) - 1];
        });
    }

    function listItemHtml(content) {
        var task = /^\[([ xX])\]\s+(.*)$/.exec(content);
        if (!task) return renderInline(content);
        return '<input type="checkbox" disabled' + (task[1].toLowerCase() === 'x' ? ' checked' : '') + '> ' + renderInline(task[2]);
    }

    // Groups consecutive list lines and turns indentation into nesting.
    function renderList(items, ordered) {
        var html = '';
        var i = 0;
        while (i < items.length) {
            var current = items[i];
            var group = [];
            while (i < items.length && items[i].indent >= current.indent) {
                group.push(items[i]);
                i++;
            }
            var inner = '';
            var j = 0;
            while (j < group.length) {
                if (group[j].indent > current.indent) {
                    var sub = [];
                    while (j < group.length && group[j].indent > current.indent) { sub.push(group[j]); j++; }
                    inner += renderList(sub, sub[0].ordered);
                    continue;
                }
                var after = j + 1 < group.length ? group[j + 1] : null;
                if (after && after.indent > current.indent) {
                    // The parent label must be read before j walks onto the children.
                    var head = group[j];
                    var nested = [];
                    while (j + 1 < group.length && group[j + 1].indent > current.indent) { nested.push(group[j + 1]); j++; }
                    inner += '<li>' + listItemHtml(head.content) + renderList(nested, nested[0].ordered) + '</li>';
                    j++;
                    continue;
                }
                inner += '<li>' + listItemHtml(group[j].content) + '</li>';
                j++;
            }
            var tag = current.ordered ? 'ol' : 'ul';
            html += '<' + tag + '>' + inner + '</' + tag + '>';
        }
        return html;
    }

    function render(source) {
        var text = String(source == null ? '' : source).replace(/\r\n?/g, '\n');
        var lines = escapeHtml(text).split('\n');
        var html = [];
        var i = 0;

        while (i < lines.length) {
            var line = lines[i];

            if (!line.trim()) { i++; continue; }

            var fence = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#-]*)\s*$/.exec(line);
            if (fence) {
                var char = fence[1].charAt(0);
                var closer = new RegExp('^\\s{0,3}' + (char === '`' ? '`{3,}' : '~{3,}') + '\\s*$');
                var body = [];
                i++;
                while (i < lines.length && !closer.test(lines[i])) { body.push(lines[i]); i++; }
                if (i < lines.length) i++;
                html.push('<pre><code' + (fence[2] ? ' class="language-' + fence[2] + '"' : '') + '>' +
                    body.join('\n') + '</code></pre>');
                continue;
            }

            var heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
            if (heading) {
                var level = heading[1].length;
                html.push('<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>');
                i++;
                continue;
            }

            if (/^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)) {
                html.push('<hr>');
                i++;
                continue;
            }

            if (/^\s{0,3}&gt;\s?/.test(line)) {
                var quote = [];
                while (i < lines.length && /^\s{0,3}&gt;\s?/.test(lines[i])) {
                    quote.push(lines[i].replace(/^\s{0,3}&gt;\s?/, ''));
                    i++;
                }
                html.push('<blockquote>' + renderInline(quote.join('\n')).replace(/\n/g, '<br>') + '</blockquote>');
                continue;
            }

            if (line.indexOf('|') >= 0 && i + 1 < lines.length && /^[\s:|-]*-[\s:|-]*$/.test(lines[i + 1]) && lines[i + 1].indexOf('|') >= 0) {
                function cells(row) {
                    var trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
                    return trimmed.split('|').map(function (cell) { return cell.trim(); });
                }
                var head = cells(line);
                var aligns = cells(lines[i + 1]).map(function (spec) {
                    if (/^:-+:$/.test(spec)) return 'center';
                    if (/^-+:$/.test(spec)) return 'right';
                    if (/^:-+$/.test(spec)) return 'left';
                    return '';
                });
                i += 2;
                var bodyRows = [];
                while (i < lines.length && lines[i].trim() && lines[i].indexOf('|') >= 0) { bodyRows.push(cells(lines[i])); i++; }
                var style = function (index) { return aligns[index] ? ' style="text-align:' + aligns[index] + '"' : ''; };
                var table = '<table><thead><tr>' + head.map(function (cell, index) {
                    return '<th' + style(index) + '>' + renderInline(cell) + '</th>';
                }).join('') + '</tr></thead><tbody>' + bodyRows.map(function (row) {
                    return '<tr>' + head.map(function (cell, index) {
                        return '<td' + style(index) + '>' + renderInline(row[index] == null ? '' : row[index]) + '</td>';
                    }).join('') + '</tr>';
                }).join('') + '</tbody></table>';
                html.push(table);
                continue;
            }

            var bullet = /^(\s{0,3})(?:([-*+])|(\d{1,9})[.)])\s+(.*)$/.exec(line);
            if (bullet) {
                var items = [];
                while (i < lines.length) {
                    var entry = /^(\s*)(?:([-*+])|(\d{1,9})[.)])\s+(.*)$/.exec(lines[i]);
                    if (!entry) break;
                    items.push({ indent: entry[1].length, ordered: !!entry[3], content: entry[4] });
                    i++;
                }
                html.push(renderList(items, items[0].ordered));
                continue;
            }

            var paragraph = [];
            while (i < lines.length && lines[i].trim() &&
                   !/^\s{0,3}(?:#{1,6}\s|&gt;|`{3,}|~{3,})/.test(lines[i]) &&
                   !/^\s*(?:[-*+]|\d{1,9}[.)])\s+/.test(lines[i])) {
                paragraph.push(lines[i]);
                i++;
            }
            if (paragraph.length) {
                html.push('<p>' + renderInline(paragraph.join('\n')).replace(/\n/g, '<br>') + '</p>');
            }
        }
        return html.join('\n');
    }

    return { render: render, renderInline: renderInline, escapeHtml: escapeHtml, safeUrl: safeUrl };
})();

// Three themes only: the signature Zyrex look, a pure black dark mode and the
// inverted light mode. Every value below is a CSS custom property consumed by
// style.css / glass.css, so a theme swap never has to touch individual rules.
window.ZYREX_THEMES = {
    zyrex: {
        name: 'Zyrex',
        badge: 'Default',
        desc: 'The signature Zyrex look: near-black surfaces with a vivid crimson accent.',
        accent: 'rgba(var(--zr-rgb-255-49-88, 255, 49, 88), 1)',
        secondary: 'rgba(var(--zr-rgb-255-113-136, 255, 113, 136), 1)',
        font: "'Satoshi', sans-serif",
        fontName: 'Satoshi',
        headingFont: "'Satoshi', sans-serif",
        colors: ['rgba(var(--zr-rgb-255-43-82, 255, 43, 82), 1)', 'rgba(var(--zr-rgb-184-20-50, 184, 20, 50), 1)', '#21131d', '#09070c'],
        vars: {
            '--site-bg': '#09070c', '--site-surface': 'rgba(20, 13, 20, 0.88)', '--site-surface-2': '#21131d',
            '--site-text': '#ffffff', '--site-muted': '#c3ccd9', '--site-border': 'rgba(var(--zr-rgb-255-91-122, 255, 91, 122), 0.2)',
            '--site-input': '#130c12', '--site-bg-glow': 'rgba(var(--zr-rgb-255-49-88, 255, 49, 88), 0.13)',
            '--bordeaux-deep': '#09070c', '--bordeaux-dark': '#130c12', '--bordeaux-mid': '#21131d',
            '--bordeaux-core': 'rgba(var(--zr-rgb-184-20-50, 184, 20, 50), 1)', '--bordeaux-vivid': 'rgba(var(--zr-rgb-255-49-88, 255, 49, 88), 1)', '--bordeaux-light': 'rgba(var(--zr-rgb-255-113-136, 255, 113, 136), 1)',
            '--rose-glow': '#f4dfe4', '--primary': 'rgba(var(--zr-rgb-213-29-67, 213, 29, 67), 1)', '--primary-dark': 'rgba(var(--zr-rgb-142-21-48, 142, 21, 48), 1)',
            '--primary-light': '#ffffff', '--secondary': 'rgba(var(--zr-rgb-168-23-55, 168, 23, 55), 1)', '--accent': 'rgba(var(--zr-rgb-255-49-88, 255, 49, 88), 1)',
            '--cherry': 'rgba(var(--zr-rgb-184-20-50, 184, 20, 50), 1)', '--cherry-rgb': '255, 49, 88', '--cherry-dark': '#21131d',
            '--cherry-light': '#f4dfe4', '--cherry-neon': 'rgba(var(--zr-rgb-255-49-88, 255, 49, 88), 1)', '--dark': '#09070c',
            '--dark-2': 'rgba(19, 12, 18, 0.9)', '--dark-3': 'rgba(33, 19, 29, 0.82)',
            '--light': '#ffffff', '--warm-light': '#f2f6fb', '--gray': '#c3ccd9', '--gray-dark': '#94a3b6',
            '--glass-bg': 'rgba(20, 13, 20, 0.78)', '--glass-border': 'rgba(255, 255, 255, 0.1)',
            '--glass-border-hover': 'rgba(var(--zr-rgb-255-49-88, 255, 49, 88), 0.48)', '--gradient': 'linear-gradient(135deg, rgba(var(--zr-rgb-255-49-88, 255, 49, 88), 1), #71142e)',
            '--gradient-accent': 'linear-gradient(135deg, rgba(var(--zr-rgb-255-113-136, 255, 113, 136), 1), rgba(var(--zr-rgb-184-20-50, 184, 20, 50), 1))',
            '--gradient-text': 'linear-gradient(135deg, #ffffff, #c3ccd9)'
        }
    },
    dark: {
        name: 'Dark',
        badge: 'Monochrome',
        desc: 'True black surfaces with pure white type and white accents.',
        accent: '#ffffff',
        secondary: '#d4d4d4',
        font: "'Satoshi', sans-serif",
        fontName: 'Satoshi',
        headingFont: "'Satoshi', sans-serif",
        colors: ['#ffffff', '#d4d4d4', '#161616', '#000000'],
        vars: {
            '--site-bg': '#000000', '--site-surface': 'rgba(10, 10, 10, 0.92)', '--site-surface-2': '#161616',
            '--site-text': '#ffffff', '--site-muted': '#a8a8a8', '--site-border': 'rgba(255, 255, 255, 0.16)',
            '--site-input': '#0a0a0a', '--site-bg-glow': 'rgba(255, 255, 255, 0.05)',
            '--bordeaux-deep': '#000000', '--bordeaux-dark': '#080808', '--bordeaux-mid': '#161616',
            '--bordeaux-core': '#ffffff', '--bordeaux-vivid': '#ffffff', '--bordeaux-light': '#d4d4d4',
            '--rose-glow': '#e6e6e6', '--primary': '#ffffff', '--primary-dark': '#bdbdbd',
            '--primary-light': '#ffffff', '--secondary': '#d4d4d4', '--accent': '#ffffff',
            '--cherry': '#ffffff', '--cherry-rgb': '255, 255, 255', '--cherry-dark': '#161616',
            '--cherry-light': '#ffffff', '--cherry-neon': '#ffffff', '--dark': '#000000',
            '--dark-2': 'rgba(8, 8, 8, 0.94)', '--dark-3': 'rgba(22, 22, 22, 0.9)',
            '--light': '#ffffff', '--warm-light': '#f5f5f5', '--gray': '#a8a8a8', '--gray-dark': '#7a7a7a',
            '--glass-bg': 'rgba(10, 10, 10, 0.86)', '--glass-border': 'rgba(255, 255, 255, 0.16)',
            '--glass-border-hover': 'rgba(255, 255, 255, 0.55)', '--gradient': 'linear-gradient(135deg, #ffffff, #c7c7c7)',
            '--gradient-accent': 'linear-gradient(135deg, #ffffff, #bdbdbd)',
            '--gradient-text': 'linear-gradient(135deg, #ffffff, #c9c9c9)'
        }
    },
    light: {
        name: 'Light',
        badge: 'Daylight',
        desc: 'Bright surfaces with blue-toned ink and a deep blue accent.',
        accent: 'rgba(var(--zr-rgb-27-79-168, 27, 79, 168), 1)',
        secondary: 'rgba(var(--zr-rgb-16-50-110, 16, 50, 110), 1)',
        font: "'Satoshi', sans-serif",
        fontName: 'Satoshi',
        headingFont: "'Satoshi', sans-serif",
        colors: ['rgba(var(--zr-rgb-27-79-168, 27, 79, 168), 1)', 'rgba(var(--zr-rgb-16-50-110, 16, 50, 110), 1)', '#e6ebf5', '#f5f7fc'],
        vars: {
            '--site-bg': '#f5f7fc', '--site-surface': 'rgba(255, 255, 255, 0.94)', '--site-surface-2': '#e9eef8',
            '--site-text': '#122a52', '--site-muted': '#46618f', '--site-border': 'rgba(21, 45, 90, 0.14)',
            '--site-input': '#ffffff', '--site-bg-glow': 'rgba(37, 84, 168, 0.10)',
            '--bordeaux-deep': '#ffffff', '--bordeaux-dark': '#f7f9fd', '--bordeaux-mid': '#e6ebf5',
            '--bordeaux-core': 'rgba(var(--zr-rgb-19-58-128, 19, 58, 128), 1)', '--bordeaux-vivid': 'rgba(var(--zr-rgb-27-79-168, 27, 79, 168), 1)', '--bordeaux-light': 'rgba(var(--zr-rgb-37-99-201, 37, 99, 201), 1)',
            '--rose-glow': 'rgba(var(--zr-rgb-16-50-110, 16, 50, 110), 1)', '--primary': 'rgba(var(--zr-rgb-27-79-168, 27, 79, 168), 1)', '--primary-dark': 'rgba(var(--zr-rgb-19-58-128, 19, 58, 128), 1)',
            '--primary-light': '#1b4fa8', '--secondary': 'rgba(var(--zr-rgb-37-99-201, 37, 99, 201), 1)', '--accent': 'rgba(var(--zr-rgb-27-79-168, 27, 79, 168), 1)',
            '--cherry': 'rgba(var(--zr-rgb-19-58-128, 19, 58, 128), 1)', '--cherry-rgb': '27, 79, 168', '--cherry-dark': '#e6ebf5',
            '--cherry-light': 'rgba(var(--zr-rgb-16-50-110, 16, 50, 110), 1)', '--cherry-neon': 'rgba(var(--zr-rgb-27-79-168, 27, 79, 168), 1)', '--dark': '#ffffff',
            '--dark-2': 'rgba(248, 250, 254, 0.96)', '--dark-3': 'rgba(233, 238, 248, 0.96)',
            '--light': '#122a52', '--warm-light': '#1c3a6b', '--gray': '#46618f', '--gray-dark': '#50699a',
            '--glass-bg': 'rgba(255, 255, 255, 0.9)', '--glass-border': 'rgba(21, 45, 90, 0.16)',
            '--glass-border-hover': 'rgba(var(--zr-rgb-27-79-168, 27, 79, 168), 0.4)', '--gradient': 'linear-gradient(135deg, rgba(var(--zr-rgb-27-79-168, 27, 79, 168), 1), rgba(var(--zr-rgb-16-50-110, 16, 50, 110), 1))',
            '--gradient-accent': 'linear-gradient(135deg, rgba(var(--zr-rgb-58-123-220, 58, 123, 220), 1), rgba(var(--zr-rgb-19-58-128, 19, 58, 128), 1))',
            '--gradient-text': 'linear-gradient(135deg, #122a52, rgba(var(--zr-rgb-16-50-110, 16, 50, 110), 1))'
        }
    }
};

// Old keys may still sit in localStorage or a stale cookie; fold them into the
// three shipping themes instead of leaving a visitor without a palette.
const ZYREX_THEME_ALIASES = {
    cherry: 'zyrex', default: 'zyrex', midnight: 'zyrex', cyberpunk: 'zyrex',
    emerald: 'zyrex', cosmic: 'zyrex', solar: 'zyrex', amethyst: 'zyrex',
    darker: 'dark', black: 'dark', night: 'dark',
    'light-tint': 'light', hyperborea: 'light', white: 'light', day: 'light'
};

function normalizeThemeKey(themeKey) {
    if (themeKey && window.ZYREX_THEMES[themeKey]) return themeKey;
    return ZYREX_THEME_ALIASES[String(themeKey || '').toLowerCase()] || 'zyrex';
}

window.applyGlobalTheme = function(themeKey) {
    themeKey = normalizeThemeKey(themeKey);
    localStorage.setItem('zyrex_theme', themeKey);
    const theme = window.ZYREX_THEMES[themeKey];
    if (theme && theme.vars) {
        const googleFontSpecs = {
            'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
            'IBM Plex Sans': 'IBM+Plex+Sans:wght@400;500;600;700',
            Manrope: 'Manrope:wght@400;500;600;700;800',
            'DM Sans': 'DM+Sans:wght@400;500;600;700;800',
            'Playfair Display': 'Playfair+Display:wght@500;600;700',
            Outfit: 'Outfit:wght@400;500;600;700;800',
            Inter: 'Inter:wght@400;500;600;700;800'
        };
        const headingFontName = (theme.headingFont || theme.font || '')
            .split(',')[0]
            .replace(/['"]/g, '')
            .trim();
        const fontFamilies = [...new Set([theme.fontName, headingFontName])]
            .map(fontName => googleFontSpecs[fontName])
            .filter(Boolean);
        const fontStylesheetId = 'zyrex-theme-fonts';
        let fontStylesheet = document.getElementById(fontStylesheetId);
        if (fontFamilies.length) {
            if (!fontStylesheet) {
                fontStylesheet = document.createElement('link');
                fontStylesheet.id = fontStylesheetId;
                fontStylesheet.rel = 'stylesheet';
                document.head.appendChild(fontStylesheet);
            }
            const fontStylesheetUrl = `https://fonts.googleapis.com/css2?${fontFamilies.map(family => `family=${family}`).join('&')}&display=swap`;
            if (fontStylesheet.href !== fontStylesheetUrl) {
                fontStylesheet.href = fontStylesheetUrl;
            }
        } else if (fontStylesheet) {
            fontStylesheet.remove();
        }

        const root = document.documentElement;
        const previousVars = (root.dataset.zyrexThemeVars || '').split(',').filter(Boolean);
        previousVars.forEach(name => root.style.removeProperty(name));
        for (const [k, v] of Object.entries(theme.vars)) {
            root.style.setProperty(k, v);
        }
        root.style.setProperty('--site-font', theme.font);
        root.style.setProperty('--site-heading-font', theme.headingFont || theme.font);
        root.style.setProperty('--site-primary', theme.vars['--primary-light'] || theme.accent);
        root.style.setProperty('--zr-cursor-accent', theme.accent || theme.vars['--accent'] || '#ff3158');
        root.dataset.zyrexThemeVars = Object.keys(theme.vars).join(',');
        root.dataset.zyrexTheme = themeKey;
        root.style.colorScheme = themeKey === 'light' ? 'light' : 'dark';
        document.body.className = document.body.className.replace(/\btheme-\S+/g, '').trim();
        document.body.classList.add('theme-' + themeKey);

        const orb1 = document.querySelector('.orb-1');
        const orb2 = document.querySelector('.orb-2');
        if (orb1 && theme.accent) orb1.style.background = theme.accent;
        if (orb2 && theme.secondary) orb2.style.background = theme.secondary;
    }
};

// Auto-run theme immediately
try {
    const themeFromUrl = new URLSearchParams(window.location.search).get('theme');
    const savedTheme = normalizeThemeKey(themeFromUrl || localStorage.getItem('zyrex_theme'));
    window.applyGlobalTheme(savedTheme);
} catch(e) {}

// Another tab (usually Settings) changing the palette should re-skin every page,
// including the focused download tab, instead of waiting for a reload.
window.addEventListener('storage', function (event) {
    if (!event || event.key !== 'zyrex_theme') return;
    try { window.applyGlobalTheme(event.newValue); } catch (_) {}
});

window.DEFAULT_AVATAR = '/assets/default-avatar.png';
// Anonymous resources deliberately reuse the generic placeholder. A dedicated
// "anonymous" icon would itself be a visual signal, and the generic one keeps
// somebody who uploads anonymously indistinguishable from any other uploader.
window.ANONYMOUS_AVATAR = window.DEFAULT_AVATAR;
window.handleAvatarError = function(img) {
    if (!img) return;
    img.onerror = null;
    img.src = window.DEFAULT_AVATAR;
};

// ==========================================
// Product cache privacy
// The catalog cache is keyed by a server-side privacy epoch so a resource that
// becomes anonymous can never be rendered from a cache that still holds its
// uploader identity. The epoch request starts as early as possible so the first
// paint does not have to wait for it, and a failed lookup fails closed (no
// cache) rather than risking a stale identity.
window.ZyrexPrivacy = (function () {
    var LEGACY_KEYS = ['zyrex_products_cache', 'zyrex_products_cache_v4'];
    var epoch = '';
    var ready = null;
    var started = false;

    function purgeLegacyCaches() {
        for (var i = 0; i < LEGACY_KEYS.length; i++) {
            try { localStorage.removeItem(LEGACY_KEYS[i]); } catch (e) {}
        }
        try {
            var doomed = [];
            for (var k = 0; k < localStorage.length; k++) {
                var key = localStorage.key(k) || '';
                if (key.indexOf('zyrex_chk_products') === 0) doomed.push(key);
            }
            for (var d = 0; d < doomed.length; d++) localStorage.removeItem(doomed[d]);
        } catch (e) {}
    }

    function start() {
        if (started) return ready;
        started = true;
        purgeLegacyCaches();
        ready = fetch('/api/privacy-epoch', { cache: 'no-store', credentials: 'include' })
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (data) {
                epoch = data && typeof data.epoch === 'string' ? data.epoch : '';
                return epoch;
            })
            .catch(function () { epoch = ''; return ''; });
        return ready;
    }

    function cacheKey() {
        return 'zyrex_products_cache_v5_' + (epoch || 'nokey');
    }

    function readProducts() {
        if (!epoch) return null;
        try {
            var raw = localStorage.getItem(cacheKey());
            if (!raw) return null;
            var cached = JSON.parse(raw);
            if (cached && cached.data && Date.now() - Number(cached.ts || 0) < 15 * 60 * 1000) return cached.data;
            localStorage.removeItem(cacheKey());
        } catch (e) {}
        return null;
    }

    function writeProducts(data) {
        if (!epoch || !Array.isArray(data)) return;
        try {
            localStorage.setItem(cacheKey(), JSON.stringify({ ts: Date.now(), data: data }));
        } catch (e) {}
    }

    return {
        start: start,
        whenReady: function () { return start(); },
        cacheKey: cacheKey,
        readProducts: readProducts,
        writeProducts: writeProducts,
    };
})();
try { window.ZyrexPrivacy.start(); } catch (e) {}

const navbar = document.querySelector('.navbar');

function syncNavbarActiveState() {
    const navLinks = document.querySelectorAll('.nav-links a');
    if (!navLinks.length) return;
    const path = (window.location.pathname || '/').toLowerCase().replace(/\/index\.html$/, '/');
    const hash = (window.location.hash || '').toLowerCase();

    // The ONLY pages reachable directly from the header:
    let activeHref = null;
    if (path === '/' || path === '') {
        activeHref = (hash === '#contact') ? '/#contact' : '/';
    } else if (path === '/presets' || path === '/presets.html' || path === '/leaks' || path === '/leaks.html' || path === '/resources' || path === '/resources.html' || path === '/preset' || path === '/leak' || path === '/resource') {
        activeHref = '/leaks';
    } else if (path === '/plugins' || path === '/plugins.html' || path.indexOf('/plugins/') === 0) {
        activeHref = '/plugins';
    } else if (path === '/feed' || path === '/feed.html') {
        activeHref = '/feed';
    } else if (path === '/requests' || path === '/requests.html') {
        activeHref = '/requests';
    } else if (path === '/audio' || path === '/audio.html') {
        activeHref = '/audio';
    } else if (path === '/access' || path === '/access.html') {
        activeHref = '/access';
    } else if (path === '/scenepacks' || path === '/scenepacks.html' || path === '/scenepack' || path === '/scenepack.html' || path === '/upload-scenepack' || path === '/upload-scenepack.html') {
        activeHref = '/scenepacks';
    }
    // Other pages do not map to a primary navigation item.

    navLinks.forEach(link => {
        const href = (link.getAttribute('href') || '').toLowerCase();
        const isMatch = (activeHref && (
            href === activeHref || 
            (activeHref === '/leaks' && (href === '/leaks' || href === '/presets' || href === '/resources' || href === 'presets' || href === 'resources')) ||
            (activeHref === '/' && (href === '#hero' || href === '/')) || 
            (activeHref === '/#contact' && (href === '#contact' || href === '/#contact'))
        ));
        if (isMatch) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Run active state sync immediately and on navigation
syncNavbarActiveState();
window.addEventListener('popstate', syncNavbarActiveState);
window.addEventListener('hashchange', syncNavbarActiveState);

function setupAccessLinks() {
    const navLinks = document.querySelector('.navbar .nav-links');
    if (navLinks && !navLinks.querySelector('a[href="/access"]')) {
        const item = document.createElement('li');
        item.innerHTML = '<a href="/access">Access</a>';
        const audioLink = navLinks.querySelector('a[href="/audio"]');
        navLinks.insertBefore(item, audioLink ? audioLink.parentElement : null);
    }

    const quickLinks = document.querySelector('.footer-links ul');
    if (quickLinks && !quickLinks.querySelector('a[href="/access"]')) {
        const item = document.createElement('li');
        item.innerHTML = '<a href="/access">Access</a>';
        quickLinks.appendChild(item);
    }
    syncNavbarActiveState();
}

// The scenepack catalogue is reachable from every page, so its header entry is
// injected once here instead of being pasted into 49 separate documents.
function setupScenepackLinks() {
    const navLinks = document.querySelector('.navbar .nav-links');
    if (navLinks && !navLinks.querySelector('a[href="/scenepacks"]')) {
        const item = document.createElement('li');
        item.innerHTML = '<a href="/scenepacks">Scenepacks</a>';
        // Sits right after Audios, which is where the scenepack pages place it.
        const audioLink = navLinks.querySelector('a[href="/audio"]');
        if (audioLink) navLinks.insertBefore(item, audioLink.parentElement.nextSibling);
        else navLinks.appendChild(item);
    }

    const quickLinks = document.querySelector('.footer-links ul');
    if (quickLinks && !quickLinks.querySelector('a[href="/scenepacks"]')) {
        const item = document.createElement('li');
        item.innerHTML = '<a href="/scenepacks">Scenepacks</a>';
        const accessLink = quickLinks.querySelector('a[href="/access"]');
        quickLinks.insertBefore(item, accessLink ? accessLink.parentElement : null);
    }
    syncNavbarActiveState();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        setupAccessLinks();
        setupScenepackLinks();
    }, { once: true });
} else {
    setupAccessLinks();
    setupScenepackLinks();
}

function getDownloadAccessModalCopy(verifiedRequired) {
    const lang = window.ZyrexI18n ? window.ZyrexI18n.getLanguage() : 'en';
    const copy = {
        en: ["Unlock your downloads", "Complete one free offer to unlock eligible leak downloads for 7 days. Your pass is linked to your Discord account.", "Get Access", "Maybe later", "Verify to download", "Downloads are available to members with the Verified role. Join the Zyrex Discord and complete verification.", "Verify now", "Join Discord"],
        tr: ["İndirmelerin kilidini aç", "Uygun sızıntı içeriklerini 7 gün indirmek için ücretsiz bir teklifi tamamlayın. Erişim Discord hesabınıza bağlanır.", "Erişim al", "Daha sonra", "İndirmek için doğrulanın", "İndirme erişimi için Discord sunucumuzdaki Verified rolü gerekir. Sunucuya katılın ve doğrulamayı tamamlayın.", "Şimdi doğrulan", "Discord'a katıl"],
        es: ["Desbloquea tus descargas", "Completa una oferta gratuita para desbloquear durante 7 días las descargas disponibles. El acceso se vincula a tu cuenta de Discord.", "Obtener acceso", "Más tarde", "Verifica tu cuenta para descargar", "Las descargas requieren el rol Verified en nuestro servidor de Discord. Únete y completa la verificación.", "Verificar ahora", "Unirse a Discord"],
        pt: ["Desbloqueie seus downloads", "Conclua uma oferta grátis para liberar por 7 dias os downloads elegíveis. O acesso fica vinculado à sua conta do Discord.", "Obter acesso", "Agora não", "Verifique para baixar", "Os downloads exigem o cargo Verified no nosso servidor do Discord. Entre no servidor e conclua a verificação.", "Verificar agora", "Entrar no Discord"],
        ru: ["Откройте доступ к загрузкам", "Выполните одно бесплатное предложение, чтобы получить доступ к подходящим загрузкам на 7 дней. Доступ привязан к Discord.", "Получить доступ", "Позже", "Подтвердите аккаунт для загрузки", "Для загрузки нужна роль Verified на сервере Zyrex в Discord. Вступите на сервер и пройдите проверку.", "Подтвердить", "Войти в Discord"],
        ar: ["افتح التنزيلات", "أكمل عرضًا مجانيًا واحدًا لفتح التنزيلات المؤهلة لمدة 7 أيام. يرتبط الوصول بحساب Discord الخاص بك.", "الحصول على الوصول", "لاحقًا", "تحقق للتنزيل", "تتطلب التنزيلات دور Verified في خادم Discord. انضم إلى الخادم وأكمل التحقق.", "تحقق الآن", "انضم إلى Discord"],
        ko: ["다운로드 잠금 해제", "무료 오퍼 하나를 완료하면 이용 가능한 다운로드를 7일간 사용할 수 있습니다. 권한은 Discord 계정에 연결됩니다.", "액세스 받기", "나중에", "다운로드하려면 인증하세요", "다운로드하려면 Zyrex Discord 서버의 Verified 역할이 필요합니다. 서버에 가입하고 인증을 완료하세요.", "지금 인증", "Discord 가입"],
        zh: ["解锁下载", "完成一个免费任务即可解锁符合条件的下载，有效期为 7 天。访问权限与 Discord 账号绑定。", "获取访问权限", "稍后再说", "验证后即可下载", "下载需要拥有 Zyrex Discord 服务器的 Verified 身份组。请加入服务器并完成验证。", "立即验证", "加入 Discord"]
    };
    const text = copy[lang] || copy.en;
    return verifiedRequired
        ? { title: text[4], body: text[5], primary: text[6], secondary: text[7] }
        : { title: text[0], body: text[1], primary: text[2], secondary: text[3] };
}

window.showAccessRequiredModal = function() {
    if (document.getElementById('zyrexAccessRequiredModal')) return;
    const returnTo = window.location.pathname + window.location.search + window.location.hash;
    const copy = getDownloadAccessModalCopy(false);
    const overlay = document.createElement('div');
    overlay.id = 'zyrexAccessRequiredModal';
    overlay.className = 'zyrex-access-modal';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML = `
        <section class="zyrex-access-dialog" role="dialog" aria-modal="true" aria-labelledby="zyrexAccessTitle">
            <button type="button" class="zyrex-access-close" aria-label="Close dialog">&times;</button>
            <span class="zyrex-access-icon"><i class="fas fa-unlock-keyhole"></i></span>
            <p class="zyrex-access-eyebrow">7-DAY DOWNLOAD PASS</p>
            <h2 id="zyrexAccessTitle">${copy.title}</h2>
            <p>${copy.body}</p>
            <div class="zyrex-access-actions">
                <a class="zyrex-access-primary" href="/access?return_to=${encodeURIComponent(returnTo)}">${copy.primary}</a>
                <button type="button" class="zyrex-access-secondary">${copy.secondary}</button>
            </div>
            <p class="zyrex-access-tutorial">Stuck somewhere? Watch our <a href="https://zyrexediting.xyz/feed/post/386" target="_blank" rel="noopener">tutorial video</a>.</p>
        </section>`;
    document.body.appendChild(overlay);

    const onKeyDown = event => {
        if (event.key === 'Escape' && document.body.contains(overlay)) close();
    };
    const close = () => {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
    };
    overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target.closest('.zyrex-access-close, .zyrex-access-secondary')) close();
    });
    document.addEventListener('keydown', onKeyDown);
    overlay.querySelector('.zyrex-access-close').focus();
};

// Plugin and software downloads are served from external mirrors, so the site only hands
// the URL to members who hold the Discord Verified role. This dialog explains that rule
// instead of the 7-day pass copy.
window.showVerifyRequiredModal = function() {
    if (document.getElementById('zyrexVerifyRequiredModal')) return;
    const returnTo = window.location.pathname + window.location.search + window.location.hash;
    const copy = getDownloadAccessModalCopy(true);
    const overlay = document.createElement('div');
    overlay.id = 'zyrexVerifyRequiredModal';
    overlay.className = 'zyrex-access-modal';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML = `
        <section class="zyrex-access-dialog" role="dialog" aria-modal="true" aria-labelledby="zyrexVerifyTitle">
            <button type="button" class="zyrex-access-close" aria-label="Close dialog">&times;</button>
            <span class="zyrex-access-icon"><i class="fas fa-shield-halved"></i></span>
            <p class="zyrex-access-eyebrow">${copy.title}</p>
            <h2 id="zyrexVerifyTitle">${copy.title}</h2>
            <p>${copy.body}</p>
            <div class="zyrex-access-actions">
                <a class="zyrex-access-primary" href="/verify?return_to=${encodeURIComponent(returnTo)}">${copy.primary}</a>
                <a class="zyrex-access-secondary" href="https://discord.gg/4J3tars4QS" target="_blank" rel="noopener">${copy.secondary}</a>
            </div>
        </section>`;
    document.body.appendChild(overlay);

    const onKeyDown = event => {
        if (event.key === 'Escape' && document.body.contains(overlay)) close();
    };
    const close = () => {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
    };
    overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target.closest('.zyrex-access-close')) close();
    });
    document.addEventListener('keydown', onKeyDown);
    overlay.querySelector('.zyrex-access-close').focus();
};

let lastScrollY = 0;
let studioSidebar = document.querySelector('.studio-sidebar');

if (navbar || studioSidebar) {
    // Scroll direction alone is too twitchy: a couple of pixels of jitter would
    // flip the bar in and out. These thresholds require a deliberate gesture,
    // and the reveal needs less travel than the hide so it feels immediate.
    var NAV_HIDE_AFTER = 14;
    var NAV_SHOW_AFTER = 6;
    // Start from the restored scroll position, otherwise a page reloaded halfway
    // down would treat the first event as a downward scroll and hide the bar.
    let navAnchorY = window.scrollY || 0;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        if (!studioSidebar) studioSidebar = document.querySelector('.studio-sidebar');
        
        // Scrolled class (compact style when not at top)
        if (navbar) {
            if (currentScrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
                navbar.classList.remove('nav-hidden');
                navAnchorY = 0;
            }
            
            // Hide on scroll down, show on scroll up (only when past 100px)
            if (currentScrollY > 100) {
                const delta = currentScrollY - navAnchorY;
                if (delta > NAV_HIDE_AFTER) {
                    navbar.classList.add('nav-hidden');
                    navAnchorY = currentScrollY;
                } else if (delta < -NAV_SHOW_AFTER) {
                    navbar.classList.remove('nav-hidden');
                    navAnchorY = currentScrollY;
                }
            } else {
                navAnchorY = currentScrollY;
            }
        }

        // Studio sidebar: slide left and hide on scroll down, return on scroll up
        if (studioSidebar && !studioSidebar.classList.contains('open')) {
            if (currentScrollY > 100) {
                if (currentScrollY > lastScrollY) {
                    studioSidebar.classList.add('sidebar-hidden');
                } else {
                    studioSidebar.classList.remove('sidebar-hidden');
                }
            } else {
                studioSidebar.classList.remove('sidebar-hidden');
            }
        }
        
        lastScrollY = currentScrollY;

        // Active link on scroll (Home page single-page section scrolling only)
        const path = (window.location.pathname || '/').toLowerCase();
        const isHomePage = (path === '/' || path === '/index.html' || path === '');
        if (isHomePage) {
            let current = 'hero';
            const sections = document.querySelectorAll('section[id], header[id]');
            sections.forEach(section => {
                const sectionTop = section.offsetTop - 180;
                if (window.scrollY >= sectionTop) {
                    current = section.getAttribute('id');
                }
            });

            const navLinks = document.querySelectorAll('.nav-links a');
            navLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href === `#${current}` || (current === 'hero' && (href === '/' || href === '#hero')) || (current === 'contact' && (href === '#contact' || href === '/#contact'))) {
                    link.classList.add('active');
                } else if (href.startsWith('#') || href === '/') {
                    link.classList.remove('active');
                }
            });
        }
    });
}

const hamburger = document.getElementById('hamburger');
const navLinksContainer = document.getElementById('navLinks');

if (hamburger && navLinksContainer) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinksContainer.classList.toggle('open');
    });

    // Close menu on link click
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinksContainer.classList.remove('open');
        });
    });
}

const BOT_API = 'http://93.115.101.154:12988';
const CDN_BASE = 'https://cdn.discordapp.com';

// Avatar proxy helper — bypasses Discord CDN blocks (e.g. Turkey)
function avatarProxyUrl(userId, avatarHash, size) {
    size = size || 64;
    if (!userId || !avatarHash) return '';
    const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return '/api/avatar/' + userId + '/' + avatarHash + '.' + ext + '?size=' + size;
}
function defaultAvatarUrl(idx) {
    return '/api/avatar/default/' + (idx || 0) + '.png';
}

const teamMembers = [
    {
        userId: '1421177012814614548',
        role: 'Founder',
        roleColor: '#184b61'
    }
];

function getAvatarUrl(user, size = 256) {
    if (!user?.avatar || !user?.id) return '';
    return avatarProxyUrl(user.id, user.avatar, size);
}

function getBannerUrl(user, size = 480) {
    if (!user?.banner || !user?.id) return '';
    const ext = user.banner.startsWith('a_') ? 'gif' : 'png';
    return '/api/banner/' + user.id + '/' + user.banner + '.' + ext + '?size=' + size;
}

// Cache helpers for Discord user data
var DISCORD_USER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
function getCachedDiscordUser(userId) {
    try {
        var raw = localStorage.getItem('zyrex_discord_user_' + userId);
        if (!raw) return null;
        var cached = JSON.parse(raw);
        if (Date.now() - cached.ts < DISCORD_USER_CACHE_TTL) return cached.data;
    } catch(e) {}
    return null;
}
function setCachedDiscordUser(userId, data) {
    try {
        localStorage.setItem('zyrex_discord_user_' + userId, JSON.stringify({ ts: Date.now(), data: data }));
    } catch(e) {}
}

async function fetchDiscordUser(userId) {
    try {
        const url = new URL('/api/discord-user', location.origin);
        url.searchParams.set('userId', userId);
        const response = await fetch(url);
        const data = await response.json();
        if (data.success && data.user) {
            setCachedDiscordUser(userId, data.user);
            return data.user;
        }
    } catch (err) {
        console.warn(`Failed to fetch Discord user ${userId}:`, err);
    }
    return null;
}

async function fetchTeamData() {
    try {
        var res = await fetch('/api/team');
        if (res.ok) {
            var d = await res.json();
            if (d && d.success) return d;
        }
    } catch(e) { console.warn('Failed to fetch team data:', e); }
    return null;
}

function formatTeamAvatarUrl(url, userId) {
    if (!url) return '';
    if (url.includes('cdn.discordapp.com/avatars/')) {
        var match = url.match(/\/avatars\/(\d+)\/([a-zA-Z0-9_]+)/);
        if (match) {
            return '/api/avatar/' + match[1] + '/' + match[2] + '.png?size=256';
        }
    }
    return url;
}

function renderTeamMembers(founders, staff, container, contributors) {
    if (!container) return;
    
    var allMembers = [];
    var defaultFounders = [
        { id: "1421177012814614548", username: "reyliar", global_name: "reyli", avatar: "/api/avatar/1421177012814614548/66077819163365312e485b95e30001d8.png", role: "Founder", status: "online" }
    ];

    var defaultStaff = [
        { id: "700282586026737694", username: "ugotherizz", global_name: "𝑱𝑰𝑵𝑨✧.*", avatar: "/api/avatar/700282586026737694/f358b6536d5aaf867c158c6c0ffb1463.png", role: "Staff Team", status: "online" }
    ];

    var activeFounders = (founders && founders.length > 0) ? founders : defaultFounders;
    var activeStaff = (staff && staff.length > 0) ? staff : defaultStaff;
    var activeContributors = (contributors && contributors.length > 0) ? contributors : [];

    // Ensure default staff (JINA) is merged if missing from API array
    defaultStaff.forEach(function(ds) {
        if (!activeStaff.some(function(s) { return String(s.id) === String(ds.id); })) {
            activeStaff.push(ds);
        }
    });

    activeFounders.forEach(function(f) { allMembers.push(f); });
    activeStaff.forEach(function(s) { allMembers.push(s); });
    activeContributors.forEach(function(c) { allMembers.push(c); });

    var html = '';
    allMembers.forEach(function(m) {
        var roleStr = m.role || 'Staff Team';
        var isFounder = roleStr.toLowerCase() === 'founder';
        var isCoFounder = roleStr.toLowerCase() === 'co-founder';
        var isContributor = roleStr.toLowerCase() === 'contributor';
        
        var roleClass = isFounder ? 'role-founder' : (isCoFounder ? 'role-co-founder' : (isContributor ? 'role-contributor' : 'role-staff-team'));
        var iconClass = (isFounder || isCoFounder) ? 'fa-crown' : (isContributor ? 'fa-code-branch' : 'fa-shield-halved');
        var src = formatTeamAvatarUrl(m.avatar, m.id);
        
        var avaHtml = src 
            ? '<img src="' + src + '" alt="' + (m.global_name || m.username) + '" onerror="this.onerror=null;this.src=\'assets/content.png\';">'
            : '<div class="avatar-placeholder"><i class="fas ' + iconClass + '"></i></div>';

        html += '<div class="team-card glass-card-enhanced shimmer-sweep">' +
            '<a href="https://discord.com/users/' + m.id + '" target="_blank" class="team-card-link">' +
                '<div class="team-avatar">' +
                    avaHtml +
                    '<span class="status-dot status-' + (m.status || 'online') + '"></span>' +
                '</div>' +
                '<h4>' + (m.global_name || m.username) + '</h4>' +
                '<span class="team-discord-tag">@' + m.username + '</span>' +
                '<span class="team-role ' + roleClass + '"><i class="fas ' + iconClass + '"></i> ' + roleStr + '</span>' +
            '</a>' +
        '</div>';
    });

    container.innerHTML = html;
}

async function loadTeamMembers() {
    const teamGrid = document.getElementById('teamGrid');
    if (!teamGrid) return;

    // 1. Render immediate default structure (Founders + Staff) so there's zero delay
    renderTeamMembers(null, null, teamGrid);

    // 2. Fetch live data from bot API / worker
    var data = await fetchTeamData();
    if (data && data.success) {
        renderTeamMembers(data.founders, data.staff, teamGrid, data.contributors);
    }
}

// Auto-run team members load on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTeamMembers);
} else {
    loadTeamMembers();
}

var GUILD_STATS_CACHE_KEY = 'zyrex_guild_stats';
var GUILD_STATS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function fetchGuildStats() {
    // Try cached stats first
    try {
        var raw = localStorage.getItem(GUILD_STATS_CACHE_KEY);
        if (raw) {
            var cached = JSON.parse(raw);
            if (cached.data && (Date.now() - cached.ts < GUILD_STATS_CACHE_TTL)) {
                applyGuildStats(cached.data);
            }
        }
    } catch(e) {}

    try {
        const resp = await fetch('/api/guild/stats');
        if (!resp.ok) return;
        const data = await resp.json();
        // Cache the guild stats
        try { localStorage.setItem(GUILD_STATS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data })); } catch(e) {}
        applyGuildStats(data);
    } catch(e) {
        console.warn('Guild stats unavailable');
    }
}

function applyGuildStats(data) {
    const badge = document.querySelector('.stats-badge');
    if (badge && data.name) {
        badge.innerHTML = '<i class="fab fa-discord"></i> ' + data.name.toUpperCase();
    }
    
    const statMap = {
        'Members': data.member_count || 0,
        'Online': data.online_count || 0,
        'Channels': data.channels_count || 0,
        'Roles': data.roles_count || 0,
        'Boost Level': data.boost_level || 0
    };
    document.querySelectorAll('.stats-item').forEach(function(item) {
        const label = item.querySelector('.stats-label');
        const number = item.querySelector('.stats-number');
        if (label && number) {
            const key = label.textContent.trim();
            if (statMap[key] !== undefined) {
                number.setAttribute('data-target', statMap[key]);
            }
        }
    });
}

window.zyrexCacheFetch = async function(url, options) {
    options = options || {};
    var cacheKey = 'zyrex_cache_' + url.replace(/[^a-zA-Z0-9_-]/g, '_');
    var onData = options.onData || null;

    // 1. Instantly return stale data from localStorage if available
    var staleData = null;
    try {
        var raw = localStorage.getItem(cacheKey);
        if (raw) {
            var parsed = JSON.parse(raw);
            staleData = (parsed && parsed.data !== undefined) ? parsed.data : parsed;
            if (onData && staleData) {
                try { onData(staleData, true); } catch(e) {}
            }
        }
    } catch(e) {}

    // 2. Fetch fresh data in background
    try {
        var fetchOpts = Object.assign({ credentials: 'include' }, options.fetchOptions || {});
        var resp = await fetch(url, fetchOpts);
        if (resp.ok) {
            var freshData = await resp.json();
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: freshData }));
            } catch(e) {}
            if (onData) {
                try { onData(freshData, false); } catch(e) {}
            }
            return freshData;
        }
    } catch(err) {
        console.warn('Background cache fetch failed for', url, err);
    }

    return staleData;
};
window.fetchWithCache = window.zyrexCacheFetch;

var heroStatsLoadPromise = null;

function fetchResourceStatsForHero() {
    if (heroStatsLoadPromise) return heroStatsLoadPromise;
    // 0. Render immediately from local storage cache
    try {
        var cached = JSON.parse(localStorage.getItem('zyrex_cache_hero_stats') || 'null');
        if (cached) {
            animateHeroNum('heroStatPresets', cached.presetsCount || 0);
            animateHeroNum('heroStatPlugins', cached.pluginsCount || 0);
            animateHeroNum('heroStatAudios', cached.audiosCount || 0);
        }
    } catch(e) {}

    var p1 = fetch('/api/resource-stats', {credentials: 'include'}).then(function(r){ return r.json(); }).catch(function(){ return null; });
    var p2 = fetch('/api/products', {credentials: 'include'}).then(function(r){ return r.json(); }).catch(function(){ return null; });

    heroStatsLoadPromise = Promise.all([p1, p2]).then(function(results) {
        var rStats = results[0] || {};
        var products = results[1] || [];
        if (!Array.isArray(products) && products.data) products = products.data;
        if (!Array.isArray(products)) products = window.presetsData || [];

        var pluginsCount = 0, presetsCount = 0, audiosCount = 0;
        var seenIds = new Set();

        // 1. Process static/cached pluginsData (software, plugins, scripts)
        var staticPlugins = window.pluginsData || [];
        staticPlugins.forEach(function(p) {
            if (p.id) seenIds.add(p.id);
            pluginsCount++;
        });

        // 2. Process dynamic products from DB
        products.forEach(function(r) {
            if (r.id && seenIds.has(r.id)) return; // prevent duplicate counting
            if (r.id) seenIds.add(r.id);

            var cat = (r.category || '').toLowerCase();
            var type = (r.type || '').toLowerCase();
            var isPlugin = type === 'plugin' || 
                           type === 'software' || 
                           cat.includes('plugin') || 
                           cat.includes('soft') || 
                           cat.includes('software') || 
                           cat.includes('extension') || 
                           cat.includes('script') || 
                           cat.includes('ofx') || 
                           cat.includes('adobe') ||
                           cat.includes('avx');

            if (type === 'audio' || cat.includes('audio') || cat.includes('sound') || cat.includes('music')) {
                audiosCount++;
            } else if (isPlugin) {
                pluginsCount++;
            } else {
                presetsCount++;
            }
        });

        // 3. Fallbacks if stats API returns direct category counts
        if (rStats && rStats.category_counts) {
            if (rStats.category_counts.presets) presetsCount = rStats.category_counts.presets;
            if (rStats.category_counts.audios) audiosCount = rStats.category_counts.audios;
        }

        try {
            localStorage.setItem('zyrex_cache_hero_stats', JSON.stringify({
                presetsCount: presetsCount,
                pluginsCount: pluginsCount,
                audiosCount: audiosCount
            }));
        } catch(e) {}

        animateHeroNum('heroStatPresets', presetsCount);
        animateHeroNum('heroStatPlugins', pluginsCount);
        animateHeroNum('heroStatAudios', audiosCount);
    });
    return heroStatsLoadPromise;
}

function animateHeroNum(id, target) {
    var el = document.getElementById(id);
    if (!el) return;
    var start = parseInt(el.textContent, 10) || 0;
    var duration = 1600;
    var startTime = performance.now();
    function step(now) {
        var elapsed = now - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(start + (target - start) * eased);
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target;
    }
    requestAnimationFrame(step);
}

if (document.getElementById('heroStatPresets') || document.getElementById('heroStatPlugins')) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fetchResourceStatsForHero, { once: true });
    } else {
        fetchResourceStatsForHero();
    }
}

if (document.querySelector('.stats-badge, .stats-item, .stats-number')) {
fetchGuildStats().then(() => {
const counters = document.querySelectorAll('.stats-number');

const animateCounter = (counter) => {
    const target = parseInt(counter.getAttribute('data-target'));
    if (!target) return;
    const duration = 2000;
    const startTime = performance.now();

    const updateCounter = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(0 + (target - 0) * eased);
        counter.textContent = currentValue;
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            counter.textContent = target;
        }
    };
    requestAnimationFrame(updateCounter);
};

if (typeof window.IntersectionObserver === 'function') {
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => counterObserver.observe(counter));
} else {
    counters.forEach(animateCounter);
}
});
}

const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const submitBtn = contactForm.querySelector('.form-submit');
        if (!submitBtn) return;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Sending... <i class="fas fa-spinner fa-spin"></i>';
        submitBtn.disabled = true;

        setTimeout(() => {
            submitBtn.innerHTML = 'Sent! <i class="fas fa-check"></i>';
            submitBtn.style.background = 'linear-gradient(135deg, rgba(var(--zr-rgb-122-8-30, 122, 8, 30), 1), rgba(var(--zr-rgb-139-0-0, 139, 0, 0), 1))';

            // Show our custom premium toast
            if (typeof window.showToast === 'function') {
                window.showToast('Message Received', 'Thank you for reaching out! We will get back to you shortly.', 'success');
            }

            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.style.background = '';
                submitBtn.disabled = false;
                contactForm.reset();
            }, 3000);
        }, 1500);
    });
}

function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal, .reveal-scale, .reveal-left, .reveal-right, .resource-card, .team-card, .contact-grid, .stats-item, .about-intro-card, .staff-hero, .staff-card, .staff-gate, .staff-role-card, .req-stat-card, .req-card, .request-explorer, .more-leaks-section, .partner-ad-card, .preset-comments-deck, .feed-post, .pf-feed-entry, .profile-section, .access-card, .scenepack-card, main > section, main > article');
    if (!revealElements.length) return;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        revealElements.forEach(el => el.classList.add('revealed'));
        return;
    }

    if (typeof window.IntersectionObserver !== 'function') {
        revealElements.forEach(el => el.classList.add('revealed'));
        return;
    }

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                // Also handle inline-style approach for backward compat
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translate3d(0,0,0) scale(1)';
            entry.target.style.filter = 'blur(0)';
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -50px 0px' });

    revealElements.forEach(el => {
        // Only add classes if not already using inline approach
        if (!el.classList.contains('reveal') && !el.classList.contains('reveal-scale') &&
            !el.classList.contains('reveal-left') && !el.classList.contains('reveal-right')) {
            el.style.opacity = '0';
            el.style.transform = 'translate3d(0,24px,0) scale(.985)';
            el.style.filter = 'blur(4px)';
            el.style.transition = 'opacity .72s cubic-bezier(.2,.8,.2,1), transform .82s cubic-bezier(.2,.8,.2,1), filter .72s cubic-bezier(.2,.8,.2,1)';
        }
        revealObserver.observe(el);
    });
}

initScrollReveal();

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href || href.charAt(0) !== '#' || href.length < 2) return;

        let target = null;
        try {
            target = document.querySelector(href);
        } catch (_) {
            target = null;
        }
        if (!target) return;

        e.preventDefault();
        target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    });
});

const particlesContainer = document.getElementById('particles');
if (particlesContainer && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    const compactParticles = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    // Every particle is its own composited layer, so keep the field sparse.
    const particleCount = compactParticles ? 8 : 20;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 4 + 2}px;
            height: ${Math.random() * 4 + 2}px;
            background: rgba(var(--zr-rgb-220-20-60, 220, 20, 60), ${Math.random() * 0.4 + 0.1});
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: floatParticle ${Math.random() * 10 + 8}s infinite;
            animation-delay: ${Math.random() * 5}s;
            pointer-events: none;
        `;
        particlesContainer.appendChild(particle);
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes floatParticle {
            0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
            25% { transform: translateY(-30px) translateX(15px); opacity: 0.6; }
            50% { transform: translateY(-10px) translateX(-10px); opacity: 0.4; }
            75% { transform: translateY(-40px) translateX(20px); opacity: 0.7; }
        }
    `;
    document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', () => {
    loadTeamMembers();
});

window.showToast = function(title, message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.position = 'fixed';
        container.style.bottom = '24px';
        container.style.right = '24px';
        container.style.zIndex = '99999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '12px';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.background = 'rgba(12, 4, 8, 0.88)';
    toast.style.backdropFilter = 'blur(20px)';
    toast.style.webkitBackdropFilter = 'blur(20px)';
    toast.style.border = '1px solid rgba(var(--zr-rgb-168-15-45, 168, 15, 45), 0.35)';
    toast.style.borderRadius = '14px';
    toast.style.padding = '16px 20px';
    toast.style.color = '#fff';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '14px';
    toast.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(var(--zr-rgb-168-15-45, 168, 15, 45), 0.15)';
    toast.style.width = '340px';
    toast.style.pointerEvents = 'auto';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    const iconColor = type === 'success' ? '#00c864' : 'rgba(var(--zr-rgb-255-56-96, 255, 56, 96), 1)';

    toast.innerHTML = `
        <i class="fas ${icon}" style="font-size: 1.4rem; color: ${iconColor}; flex-shrink: 0;"></i>
        <div style="flex: 1; min-width: 0;">
            <strong style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 2px;">${title}</strong>
            <span style="display: block; font-size: 0.76rem; color: #8888a0; line-height: 1.4;">${message}</span>
        </div>
        <button style="background: transparent; border: none; color: #55556a; cursor: pointer; font-size: 0.8rem; padding: 4px; transition: color 0.2s;" onclick="this.parentElement.style.opacity='0';setTimeout(()=>this.parentElement.remove(),400)"><i class="fas fa-times"></i></button>
    `;

    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 50);

    // Animate out
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
};

// Shared compact status banner used by the upload studio and other site actions.
window.showStatusAlert = function(message, isError) {
    if (!message) return;
    let alert = document.getElementById('zyrexStatusAlert');
    if (!alert) {
        alert = document.createElement('div');
        alert.id = 'zyrexStatusAlert';
        alert.setAttribute('aria-atomic', 'true');
        alert.style.position = 'fixed';
        alert.style.top = 'max(20px, env(safe-area-inset-top))';
        alert.style.left = '50%';
        alert.style.zIndex = '10000';
        alert.style.display = 'flex';
        alert.style.alignItems = 'center';
        alert.style.gap = '9px';
        alert.style.width = 'max-content';
        alert.style.maxWidth = 'calc(100vw - 32px)';
        alert.style.padding = '13px 22px';
        alert.style.borderRadius = '999px';
        alert.style.backdropFilter = 'blur(20px)';
        alert.style.webkitBackdropFilter = 'blur(20px)';
        alert.style.boxShadow = '0 12px 36px rgba(0, 0, 0, .5)';
        alert.style.fontSize = '.84rem';
        alert.style.fontWeight = '700';
        alert.style.opacity = '0';
        alert.style.visibility = 'hidden';
        alert.style.transform = 'translate(-50%,-10px)';
        alert.style.transition = 'opacity .22s ease, transform .22s ease';
        alert.style.pointerEvents = 'none';
        const icon = document.createElement('i');
        icon.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span');
        text.style.overflow = 'hidden';
        text.style.textOverflow = 'ellipsis';
        alert.append(icon, text);
        document.body.appendChild(alert);
        alert._zyrexIcon = icon;
        alert._zyrexText = text;
    }
    const error = isError === true || isError === 'error';
    alert.className = 'studio-alert show zyrex-status-alert ' + (error ? 'error' : 'success');
    alert.setAttribute('role', error ? 'alert' : 'status');
    alert.setAttribute('aria-live', error ? 'assertive' : 'polite');
    alert._zyrexIcon.className = 'fas ' + (error ? 'fa-circle-exclamation' : 'fa-circle-check');
    alert._zyrexText.textContent = String(message);
    alert.style.color = error ? '#ff9ab0' : '#34d399';
    alert.style.background = error ? 'rgba(var(--zr-rgb-255-43-82, 255, 43, 82),.18)' : 'rgba(52, 211, 153, .15)';
    alert.style.border = '1px solid ' + (error ? 'rgba(var(--zr-rgb-255-43-82, 255, 43, 82),.3)' : 'rgba(52, 211, 153, .3)');
    alert.style.opacity = '1';
    alert.style.visibility = 'visible';
    alert.style.transform = 'translate(-50%,0)';
    clearTimeout(alert._zyrexTimer);
    clearTimeout(alert._zyrexVisibilityTimer);
    alert._zyrexTimer = setTimeout(function() {
        alert.style.opacity = '0';
        alert.style.transform = 'translate(-50%,-10px)';
        alert._zyrexVisibilityTimer = setTimeout(function() { alert.style.visibility = 'hidden'; }, 240);
    }, 4000);
};

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('error');
    if (!authError) return;
    const messages = {
        auth_failed: 'Discord could not complete sign-in. Please try again in a moment.',
        user_fetch_failed: 'Discord sign-in succeeded, but your profile could not be loaded. Please try again.',
        no_code: 'Discord did not return a sign-in code. Please start sign-in again.',
    };
    window.showToast('Sign-in problem', messages[authError] || 'Sign-in could not be completed. Please try again.', 'error');
    params.delete('error');
    const query = params.toString();
    history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
});

(function initGlobalFloatingHub() {
    let cachedLiveNotifs = [];

    function getNotifPrefs() {
        try {
            const raw = localStorage.getItem('zyrex_notif_prefs');
            return raw ? JSON.parse(raw) : { dnd: false, presets: true, plugins: true, replies: true, announcements: true };
        } catch(e) {
            return { dnd: false, presets: true, plugins: true, replies: true, announcements: true };
        }
    }

    function persistNotifPrefs(prefs) {
        localStorage.setItem('zyrex_notif_prefs', JSON.stringify(prefs));
        fetch('/api/profile/notif/prefs', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dnd: !!prefs.dnd, leaks: prefs.presets !== false, plugins: prefs.plugins !== false, replies: prefs.replies !== false, announcements: prefs.announcements !== false })
        }).catch(function() {});
    }

    function setupHub() {
        if (window.location.pathname.startsWith('/download') || window.location.hostname.startsWith('dl.') || document.getElementById('dlBtn')) return;
        if (document.getElementById('globalFloatingHub')) return;
        if (!document.body) {
            setTimeout(setupHub, 50);
            return;
        }

        // Create Floating Action Container with Panel inside for perfect anchoring
        const hub = document.createElement('div');
        hub.id = 'globalFloatingHub';
        hub.className = 'global-floating-hub';
        hub.innerHTML = `
            <div class="floating-notif-wrap">
                <button id="globalNotifBtn" class="floating-hub-btn" onclick="window.toggleGlobalNotifPanel(event)" title="Notifications" aria-label="Notifications">
                    <i class="fas fa-bell"></i>
                    <span class="notif-bubble-badge" id="floatingNotifBadge" style="display:none">0</span>
                </button>
                <div id="globalNotifPanel" class="global-notif-panel">
                    <div class="notif-panel-header">
                        <div class="notif-panel-title-group">
                            <span class="notif-panel-pill-icon"><i class="fas fa-bell"></i></span>
                            <span class="notif-panel-heading">Notifications</span>
                            <span class="notif-header-unread-pill" id="panelNotifBadge" style="display:none">0 New</span>
                        </div>
                        <div class="notif-panel-actions">
                            <button type="button" class="notif-header-act-btn" onclick="window.toggleDNDQuick()" title="Do Not Disturb" id="btnQuickDND"><i class="fas fa-moon"></i></button>
                            <a href="/settings#notifications" class="notif-header-act-btn" title="Notification Settings"><i class="fas fa-cog"></i></a>
                            <button type="button" class="notif-header-act-btn" onclick="window.markAllNotifsRead()" title="Mark all as read"><i class="fas fa-check-double"></i></button>
                            <button type="button" class="notif-header-act-btn" onclick="window.clearAllNotifs()" title="Clear all notifications"><i class="fas fa-trash-can"></i></button>
                            <button type="button" class="notif-header-act-btn close-btn" onclick="window.toggleGlobalNotifPanel(event)" title="Close"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                    <div class="notif-panel-body" id="globalNotifList"></div>
                    <div class="notif-panel-footer" id="globalNotifFooter" style="display:none">
                        <span id="notifFooterSummary" class="notif-footer-summary"></span>
                        <div class="notif-footer-actions">
                            <button type="button" class="notif-footer-btn" onclick="window.markAllNotifsRead()"><i class="fas fa-check-double"></i> Mark all read</button>
                            <button type="button" class="notif-footer-btn clear" onclick="window.clearAllNotifs()"><i class="fas fa-trash-can"></i> Clear all</button>
                        </div>
                    </div>
                </div>
            </div>
            <button id="globalScrollTopBtn" class="floating-hub-btn scroll-top-btn" onclick="window.scrollToTopSmooth()" title="Back to Top" aria-label="Back to Top">
                <i class="fas fa-arrow-up"></i>
            </button>
        `;
        document.body.appendChild(hub);

        // Smooth scroll listener: toggles scroll-to-top button visibility
        function handleScroll() {
            const h = document.getElementById('globalFloatingHub');
            if (h) {
                const scrollY = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
                if (scrollY > 180) {
                    h.classList.add('scrolled');
                } else {
                    h.classList.remove('scrolled');
                }
            }
        }
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            const p = document.getElementById('globalNotifPanel');
            const btn = document.getElementById('globalNotifBtn');
            if (p && p.classList.contains('open') && !p.contains(e.target) && !btn.contains(e.target)) {
                p.classList.remove('open');
            }
        });

        // Load notifications data
        fetchLiveNotifications();
        // Background live check every 45s, paused while the tab is hidden
        window.ZyrexPoll.whileVisible(fetchLiveNotifications, 20000);
    }

    function getReadIds() {
        try {
            return JSON.parse(localStorage.getItem('zyrex_read_notifs') || '[]');
        } catch(e) {
            return [];
        }
    }

    function getClearedIds() {
        try {
            return JSON.parse(localStorage.getItem('zyrex_cleared_notifs') || '[]');
        } catch(e) {
            return [];
        }
    }

    async function fetchLiveNotifications() {
        const prefs = getNotifPrefs();
        try {
            const res = await fetch('/api/notifications', {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.notifications)) {
                    cachedLiveNotifs = data.notifications;
                    if (Array.isArray(data.read_ids)) localStorage.setItem('zyrex_read_notifs', JSON.stringify(data.read_ids));
                    if (Array.isArray(data.dismissed_ids)) localStorage.setItem('zyrex_cleared_notifs', JSON.stringify(data.dismissed_ids));
                }
            }
        } catch(e) {
            console.warn('Live notifications fetch failed:', e);
        }
        renderGlobalNotifications();
    }

    const KNOWN_DISCORD_CHANNELS = {
        '1553134078813929522': { name: 'bug-reports', type: 'forum' },
        '1551118401508745367': { name: 'requests', type: 'forum' },
        '1518954946110685184': { name: 'general', type: 'text' }
    };

    function getCachedDiscordChannel(channelId) {
        try {
            const raw = localStorage.getItem('zyrex_discord_channels_cache');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed[channelId]) return parsed[channelId];
            }
        } catch(e) {}
        return null;
    }

    function setCachedDiscordChannel(channelId, data) {
        try {
            const raw = localStorage.getItem('zyrex_discord_channels_cache') || '{}';
            const parsed = JSON.parse(raw);
            parsed[channelId] = data;
            localStorage.setItem('zyrex_discord_channels_cache', JSON.stringify(parsed));
        } catch(e) {}
    }

    const pendingChannelFetches = new Set();
    function fetchDiscordChannelAsync(channelId) {
        if (!channelId || pendingChannelFetches.has(channelId)) return;
        if (KNOWN_DISCORD_CHANNELS[channelId] || getCachedDiscordChannel(channelId)) return;
        pendingChannelFetches.add(channelId);

        fetch(`/api/discord/channel/${channelId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.channel) {
                    const info = {
                        name: data.channel.name,
                        type: data.channel.type === 15 ? 'forum' : (data.channel.type === 5 ? 'announcement' : (data.channel.type === 2 ? 'voice' : 'text'))
                    };
                    setCachedDiscordChannel(channelId, info);
                    const pills = document.querySelectorAll(`.notif-discord-channel-pill[data-channel-id="${channelId}"]`);
                    pills.forEach(pill => {
                        const iconEl = pill.querySelector('i');
                        const spanEl = pill.querySelector('span');
                        if (spanEl) spanEl.textContent = info.name;
                        if (iconEl) {
                            iconEl.className = info.type === 'forum' ? 'fas fa-comments' : (info.type === 'announcement' ? 'fas fa-bullhorn' : 'fas fa-hashtag');
                        }
                        if (info.type === 'forum') pill.classList.add('forum');
                    });
                }
            })
            .catch(() => {})
            .finally(() => {
                pendingChannelFetches.delete(channelId);
            });
    }

    function renderDiscordChannelPill(url, channelId, rawLabel) {
        const known = KNOWN_DISCORD_CHANNELS[channelId] || getCachedDiscordChannel(channelId) || {};
        let chName = known.name;
        if (!chName && rawLabel && rawLabel !== url && !rawLabel.startsWith('http')) {
            chName = rawLabel.replace(/^[#@]/, '').trim();
        }
        if (!chName) {
            if (channelId === '1553134078813929522') chName = 'bug-reports';
            else if (channelId === '1551118401508745367') chName = 'requests';
            else {
                chName = `channel-${channelId.slice(-4)}`;
                fetchDiscordChannelAsync(channelId);
            }
        }

        let chType = known.type || 'text';
        const lowerName = chName.toLowerCase();
        if (lowerName.includes('bug') || lowerName.includes('report') || lowerName.includes('request') || lowerName.includes('forum')) {
            chType = 'forum';
        } else if (lowerName.includes('announc')) {
            chType = 'announcement';
        }

        let icon = 'fas fa-hashtag';
        if (chType === 'forum' || chType === 15) {
            icon = 'fas fa-comments';
            chType = 'forum';
        } else if (chType === 'announcement' || chType === 5) {
            icon = 'fas fa-bullhorn';
            chType = 'announcement';
        } else if (chType === 'voice' || chType === 2) {
            icon = 'fas fa-volume-high';
        }

        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="notif-discord-channel-pill ${chType}" data-channel-id="${channelId}" onclick="event.stopPropagation()" title="Open #${chName} on Discord"><i class="${icon}"></i><span>${chName}</span></a>`;
    }

    function formatNotifLink(url, rawLabel) {
        if (!url) return '';
        const cleanUrl = url.replace(/&amp;/g, '&').trim();

        // 1. Check if it's a Discord channel URL
        // e.g. https://discord.com/channels/:guildId/:channelId
        const discordMatch = cleanUrl.match(/(?:https?:\/\/)?(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(?:[0-9]+)\/([0-9]+)/i);
        if (discordMatch) {
            const channelId = discordMatch[1];
            return renderDiscordChannelPill(cleanUrl, channelId, rawLabel);
        }

        // 2. Check if it's a Discord invite link
        const inviteMatch = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9_-]+)/i);
        if (inviteMatch) {
            return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="notif-discord-channel-pill invite" onclick="event.stopPropagation()" title="Join Discord Server"><i class="fab fa-discord"></i><span>Discord Server</span></a>`;
        }

        // 3. Regular web link
        const isExternal = cleanUrl.startsWith('http');
        const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        const displayLabel = rawLabel || cleanUrl;
        return `<a href="${cleanUrl}"${target} class="notif-inline-link" onclick="event.stopPropagation()">${displayLabel}</a>`;
    }

    function parseNotifMarkdown(str) {
        if (!str) return '';
        let text = escapeHtmlNotif(str);

        // Multiline code blocks ```lang ... ```
        const codeBlocks = [];
        text = text.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (match, code) => {
            const idx = codeBlocks.length;
            codeBlocks.push(`<pre class="notif-code-block"><code>${code.trim()}</code></pre>`);
            return `\uFFF0CB_${idx}\uFFF1`;
        });

        // Inline code `...`
        const inlineCodes = [];
        text = text.replace(/`([^`]+)`/g, (match, code) => {
            const idx = inlineCodes.length;
            inlineCodes.push(`<code class="notif-inline-code">${code}</code>`);
            return `\uFFF0IC_${idx}\uFFF1`;
        });

        const links = [];
        // Markdown links [label](url)
        text = text.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s\)]+)\)/g, (match, label, url) => {
            const idx = links.length;
            links.push(formatNotifLink(url, label));
            return `\uFFF0LK_${idx}\uFFF1`;
        });

        // Auto-link raw URLs (https://... or http://...)
        text = text.replace(/(https?:\/\/[^\s<]+)/g, (match, url) => {
            let clean = url;
            let trailing = '';
            const m = clean.match(/([.,;:!?)]+)$/);
            if (m) {
                trailing = m[1];
                clean = clean.slice(0, -trailing.length);
            }
            const idx = links.length;
            links.push(formatNotifLink(clean) + trailing);
            return `\uFFF0LK_${idx}\uFFF1`;
        });

        // Discord channel mention tag <#123456789012345678>
        text = text.replace(/&lt;#([0-9]{17,20})&gt;/g, (match, chId) => {
            const idx = links.length;
            const url = `https://discord.com/channels/1518954946110685184/${chId}`;
            links.push(renderDiscordChannelPill(url, chId));
            return `\uFFF0LK_${idx}\uFFF1`;
        });

        // Headings #, ##, ###
        text = text.replace(/^###\s+(.*?)$/gm, '<h6 class="notif-md-h3">$1</h6>');
        text = text.replace(/^##\s+(.*?)$/gm, '<h5 class="notif-md-h2">$1</h5>');
        text = text.replace(/^#\s+(.*?)$/gm, '<h4 class="notif-md-h1">$1</h4>');

        // Spoilers ||hidden text||
        text = text.replace(/\|\|(.*?)\|\|/g, '<span class="notif-spoiler" onclick="this.classList.toggle(\'revealed\');event.stopPropagation()" title="Click to reveal">$1</span>');

        // Bold **text** or __text__
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');

        // Italic *text* or _text_
        text = text.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
        text = text.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em>$2</em>$3');

        // Strikethrough ~~text~~
        text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');

        // Blockquotes > quote
        text = text.replace(/^>\s+(.*?)$/gm, '<blockquote class="notif-blockquote">$1</blockquote>');

        // Mentions &lt;@id&gt; or &lt;@username&gt;
        text = text.replace(/&lt;@([a-zA-Z0-9_-]+)&gt;/g, '<span class="notif-mention">@$1</span>');

        // Restore links
        links.forEach((l, i) => {
            text = text.replace(`\uFFF0LK_${i}\uFFF1`, l);
        });

        // Restore inline code
        inlineCodes.forEach((c, i) => {
            text = text.replace(`\uFFF0IC_${i}\uFFF1`, c);
        });

        // Restore code blocks
        codeBlocks.forEach((cb, i) => {
            text = text.replace(`\uFFF0CB_${i}\uFFF1`, cb);
        });

        // Newlines to <br>
        text = text.replace(/\n/g, '<br>');

        return text;
    }

    /* Small bridge to the site language packs so notification copy follows the
       visitor's language instead of always rendering in English. */
    function zt(text, vars) {
        var api = window.ZyrexI18n;
        if (api && typeof api.format === 'function') return api.format(text, vars);
        return text;
    }

    document.addEventListener('zyrex:languagechange', function () {
        if (typeof renderGlobalNotifications === 'function' && cachedLiveNotifs.length) renderGlobalNotifications();
    });

    function renderGlobalNotifications() {
        const list = document.getElementById('globalNotifList');
        const footer = document.getElementById('globalNotifFooter');
        const footerSummary = document.getElementById('notifFooterSummary');
        const badge1 = document.getElementById('floatingNotifBadge');
        const badge2 = document.getElementById('panelNotifBadge');
        const dndBtn = document.getElementById('btnQuickDND');
        if (!list) return;

        const prefs = getNotifPrefs();
        if (dndBtn) {
            dndBtn.style.color = prefs.dnd ? 'var(--cherry-neon)' : 'rgba(255, 255, 255, 0.65)';
            dndBtn.title = prefs.dnd ? zt('Do Not Disturb is ON (Click to turn off)') : zt('Enable Do Not Disturb');
        }

        // If DND is enabled, hide all badges and show DND state
        if (prefs.dnd) {
            if (badge1) badge1.style.display = 'none';
            if (badge2) badge2.style.display = 'none';
            if (footer) footer.style.display = 'none';
            list.innerHTML = `
                <div class="notif-empty-state">
                    <div class="notif-empty-icon-wrap" style="color:var(--cherry-neon)">
                        <i class="fas fa-moon"></i>
                    </div>
                    <div class="notif-empty-title">Do Not Disturb is Active</div>
                    <div class="notif-empty-desc">Live notifications and badges are temporarily silenced.</div>
                    <button type="button" class="notif-footer-btn" onclick="window.toggleDNDQuick()" style="margin-top:14px">
                        <i class="fas fa-bell"></i> Turn Off DND
                    </button>
                </div>
            `;
            return;
        }

        const clearedIds = getClearedIds();
        // Filter notifications according to cleared IDs and user category preferences
        const filteredNotifs = cachedLiveNotifs.filter(n => {
            if (clearedIds.includes(n.id)) return false;
            const cat = n.category || 'announcement';
            // Older notifications still carry the old category value.
            if ((cat === 'resource' || cat === 'preset') && prefs.presets === false) return false;
            if (cat === 'plugin' && prefs.plugins === false) return false;
            if (cat === 'scenepack' && prefs.presets === false) return false;
            if (cat === 'audio' && prefs.presets === false) return false;
            if (cat === 'reply' && prefs.replies === false) return false;
            if (cat === 'announcement' && prefs.announcements === false) return false;
            return true;
        });

        const readIds = getReadIds();
        const unreadCount = filteredNotifs.filter(n => !readIds.includes(n.id)).length;

        if (badge1) {
            badge1.textContent = unreadCount;
            badge1.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
        if (badge2) {
            badge2.textContent = unreadCount > 0 ? zt('{n} New', { n: unreadCount }) : '';
            badge2.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
        }

        if (filteredNotifs.length === 0) {
            if (footer) footer.style.display = 'none';
            list.innerHTML = `
                <div class="notif-empty-state">
                    <div class="notif-empty-icon-wrap">
                        <i class="fas fa-bell-slash"></i>
                    </div>
                    <div class="notif-empty-title">No Notifications</div>
                    <div class="notif-empty-desc">You're all caught up! No new notifications right now.</div>
                </div>
            `;
            return;
        }

        if (footer) {
            footer.style.display = 'flex';
            if (footerSummary) {
                footerSummary.textContent = filteredNotifs.length === 1
                    ? zt('{n} notification', { n: 1 })
                    : zt('{n} notifications', { n: filteredNotifs.length });
            }
        }

        list.innerHTML = filteredNotifs.map(n => {
            const isUnread = !readIds.includes(n.id);
            const iconClass = n.icon_brand ? `fab ${n.icon}` : `fas ${n.icon}`;
            const timeAgo = formatNotifTime(n.created_at);
            const itemLink = n.link || '';
            const hasLink = itemLink && itemLink !== '#' && itemLink !== 'javascript:void(0)';
            const categoryName = zt(notifCategoryLabel(n.category)).toLocaleUpperCase();
            return `
                <div class="notif-item ${isUnread ? 'unread' : 'read'} ${hasLink ? 'has-link' : ''}" 
                     data-id="${n.id}" 
                     onclick="window.handleNotifCardClick(event, '${escapeHtmlNotif(itemLink)}', '${n.id}')">
                    <div class="notif-card-header">
                        <div class="notif-card-source">
                            <div class="notif-app-icon" style="background:${n.bg || 'rgba(var(--zr-rgb-255-43-82, 255, 43, 82),0.18)'};color:${n.color || 'var(--cherry-neon)'}">
                                <i class="${iconClass}"></i>
                            </div>
                            <span class="notif-app-name">${escapeHtmlNotif(categoryName)}</span>
                            <span class="notif-bullet">·</span>
                            <span class="notif-time">${timeAgo}</span>
                        </div>
                        <div class="notif-card-actions">
                            ${isUnread ? `
                                <button type="button" class="notif-ios-btn mark-read" onclick="window.markSingleNotifRead(event, '${n.id}')" title="Mark as read" aria-label="Mark as read">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : `
                                <button type="button" class="notif-ios-btn is-read" onclick="window.toggleSingleNotifRead(event, '${n.id}')" title="Mark as unread" aria-label="Mark as unread">
                                    <i class="fas fa-check-double"></i>
                                </button>
                            `}
                            <button type="button" class="notif-ios-btn dismiss" onclick="window.clearSingleNotif(event, '${n.id}')" title="Dismiss" aria-label="Dismiss">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <div class="notif-card-body">
                        <div class="notif-title">${parseNotifMarkdown(notifTitleText(n))}</div>
                        <div class="notif-desc">${parseNotifMarkdown(notifDescText(n))}</div>
                    </div>
                    ${hasLink ? `
                        <div class="notif-card-footer-link">
                            <span>Open</span>
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    function formatNotifTime(isoDate) {
        if (!isoDate) return zt('now');
        try {
            const date = new Date(isoDate.endsWith('Z') ? isoDate : isoDate + 'Z');
            const sec = Math.floor((new Date() - date) / 1000);
            if (isNaN(sec) || sec < 45) return zt('now');
            if (sec < 60) return zt('{n}s ago', { n: sec });
            const min = Math.floor(sec / 60);
            if (min < 60) return zt('{n}m ago', { n: min });
            const hrs = Math.floor(min / 60);
            if (hrs < 24) return zt('{n}h ago', { n: hrs });
            const days = Math.floor(hrs / 24);
            if (days === 1) return zt('Yesterday');
            if (days < 7) return zt('{n}d ago', { n: days });
            return date.toLocaleDateString((window.ZyrexI18n && window.ZyrexI18n.getLanguage) ? window.ZyrexI18n.getLanguage() : 'en', { month: 'short', day: 'numeric' });
        } catch(e) {
            return zt('Recently');
        }
    }

    /* Notification copy is written by the server in English, so the client
       rebuilds the two patterns it uses instead of translating a whole title. */
    function notifCategoryLabel(category) {
        switch (String(category || '').toLowerCase()) {
            case 'resource':
            case 'preset': return 'Resource';
            case 'plugin':
            case 'software': return 'Plugin';
            case 'audio': return 'Audio';
            case 'scenepack': return 'Scenepack';
            case 'reply': return 'Reply';
            case 'announcement': return 'Announcement';
            default: return 'ZYREX';
        }
    }

    function notifTitleText(n) {
        var title = String(n.title || '');
        var match = title.match(/^New\s+(Leak|Preset|Plugin|Software|Audio|Scenepack)\s*:\s*([\s\S]+)$/i);
        if (match) {
            var type = match[1].toLowerCase() === 'preset' ? 'Leak' : match[1];
            return zt('New {type}: {name}', { type: zt(type), name: match[2].trim() });
        }
        return zt(title);
    }

    function notifDescText(n) {
        var desc = String(n.desc || '');
        var match = desc.match(/^([\s\S]+?)\s+is now available in\s+([\s\S]+?)!?$/i);
        if (match) {
            var name = match[1].trim();
            var category = String(match[2] || '').trim();
            if (/^our catalog$/i.test(category)) {
                return zt('{name} is now available in our catalog!', { name: name });
            }
            return zt('{name} is now available in {category}!', { name: name, category: zt(category) });
        }
        return zt(desc);
    }

    function escapeHtmlNotif(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function persistNotificationAction(action, id, ids) {
        try {
            fetch('/api/notifications', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: action, id: id || '', ids: ids || [] })
            }).then(function (response) {
                if (response.ok) return response.json();
                return null;
            }).then(function (data) {
                if (!data || !data.success) return;
                if (Array.isArray(data.read_ids)) localStorage.setItem('zyrex_read_notifs', JSON.stringify(data.read_ids));
                if (Array.isArray(data.dismissed_ids)) localStorage.setItem('zyrex_cleared_notifs', JSON.stringify(data.dismissed_ids));
                renderGlobalNotifications();
            }).catch(function () {});
        } catch (_) {}
    }

    window.handleNotifCardClick = function(e, link, id) {
        if (!e) return;
        // Don't trigger card navigation if clicked inside an interactive element
        if (e.target.closest('a, button, input, select, textarea, .notif-ios-btn, .notif-item-act-btn, .notif-spoiler, .notif-inline-link, .notif-discord-channel-pill')) {
            return;
        }
        window.markNotifRead(id);
        if (link && link !== '#' && !link.startsWith('javascript:')) {
            if (link.startsWith('http://') || link.startsWith('https://')) {
                window.open(link, '_blank', 'noopener,noreferrer');
            } else {
                window.location.href = link;
            }
        }
    };

    window.toggleGlobalNotifPanel = function(e) {
        if (e) e.stopPropagation();
        const panel = document.getElementById('globalNotifPanel');
        if (panel) {
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) {
                renderGlobalNotifications();
            }
        }
    };

    window.toggleDNDQuick = function() {
        const prefs = getNotifPrefs();
        prefs.dnd = !prefs.dnd;
        persistNotifPrefs(prefs);
        renderGlobalNotifications();
    };

    window.refreshGlobalNotifications = function() {
        renderGlobalNotifications();
    };

    window.addEventListener('storage', function (event) {
        if (event && (event.key === 'zyrex_read_notifs' || event.key === 'zyrex_cleared_notifs')) fetchLiveNotifications();
    });

    window.scrollToTopSmooth = function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    window.markNotifRead = function(id) {
        const readIds = getReadIds();
        if (!readIds.includes(id)) {
            readIds.push(id);
            localStorage.setItem('zyrex_read_notifs', JSON.stringify(readIds));
            persistNotificationAction('read', id);
            renderGlobalNotifications();
        }
    };

    window.markSingleNotifRead = function(e, id) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const readIds = getReadIds();
        if (!readIds.includes(id)) {
            readIds.push(id);
            localStorage.setItem('zyrex_read_notifs', JSON.stringify(readIds));
            persistNotificationAction('read', id);
            renderGlobalNotifications();
        }
    };

    window.toggleSingleNotifRead = function(e, id) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        let readIds = getReadIds();
        if (readIds.includes(id)) {
            readIds = readIds.filter(x => x !== id);
        } else {
            readIds.push(id);
        }
        localStorage.setItem('zyrex_read_notifs', JSON.stringify(readIds));
        persistNotificationAction(readIds.includes(id) ? 'read' : 'unread', id);
        renderGlobalNotifications();
    };

    window.markAllNotifsRead = function() {
        const allIds = cachedLiveNotifs.map(n => n.id);
        localStorage.setItem('zyrex_read_notifs', JSON.stringify(allIds));
        persistNotificationAction('mark_all_read', '', allIds);
        renderGlobalNotifications();
    };

    window.clearSingleNotif = function(e, id) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const cleared = getClearedIds();
        if (!cleared.includes(id)) {
            cleared.push(id);
            localStorage.setItem('zyrex_cleared_notifs', JSON.stringify(cleared));
            persistNotificationAction('dismiss', id);
            renderGlobalNotifications();
        }
    };

    window.clearAllNotifs = function() {
        const cleared = getClearedIds();
        cachedLiveNotifs.forEach(n => {
            if (!cleared.includes(n.id)) cleared.push(n.id);
        });
        localStorage.setItem('zyrex_cleared_notifs', JSON.stringify(cleared));
        persistNotificationAction('clear_all', '', cachedLiveNotifs.map(n => n.id));
        renderGlobalNotifications();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupHub);
        window.addEventListener('load', setupHub);
    } else {
        setupHub();
    }
    setTimeout(setupHub, 200);
    setTimeout(setupHub, 1000);
})();

(function() {
    var statusCacheKey = 'zyrex_status_cache';
    var statusCacheTtl = 30000; // 30 seconds

    function injectFooterStatus() {
        var footerBottom = document.querySelector('.footer-bottom');
        if (!footerBottom) return;

        var existingPill = footerBottom.querySelector('.zyrex-footer-status');
        if (!existingPill) {
            var pill = document.createElement('a');
            pill.href = '/status';
            pill.className = 'zyrex-footer-status operational';
            pill.id = 'zyrexFooterStatus';
            pill.setAttribute('title', 'View live system status & uptime telemetry');
            pill.innerHTML = '<span class="zyrex-footer-status-dot"></span><span class="zyrex-footer-status-text">All systems operational</span>';

            if (footerBottom.firstElementChild && footerBottom.firstElementChild.nextSibling) {
                footerBottom.insertBefore(pill, footerBottom.firstElementChild.nextSibling);
            } else {
                footerBottom.appendChild(pill);
            }
        }

        var existingLegal = footerBottom.querySelector('.footer-legal-inline');
        if (!existingLegal) {
            var legal = document.createElement('div');
            legal.className = 'footer-legal-inline';
            legal.innerHTML = '<a href="/privacy">Privacy</a> &bull; <a href="/terms">Terms</a> &bull; <a href="/dmca">DMCA</a>';
            footerBottom.appendChild(legal);
        }

        syncFooterStatus();
    }

    function syncFooterStatus() {
        var pill = document.querySelector('.zyrex-footer-status');
        if (!pill) return;

        try {
            var raw = localStorage.getItem(statusCacheKey);
            if (raw) {
                var cached = JSON.parse(raw);
                if (Date.now() - cached.ts < statusCacheTtl) {
                    applyStatusToPill(pill, cached.status);
                    return;
                }
            }
        } catch (e) {}

        fetch('/api/status/summary', { cache: 'no-store' })
            .then(function(res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function(data) {
                var status = data.status || 'operational';
                try {
                    localStorage.setItem(statusCacheKey, JSON.stringify({ status: status, ts: Date.now() }));
                } catch (e) {}
                applyStatusToPill(pill, status);
            })
            .catch(function() {
                applyStatusToPill(pill, 'operational');
            });
    }

    function applyStatusToPill(pill, status) {
        var textEl = pill.querySelector('.zyrex-footer-status-text');
        pill.classList.remove('operational', 'degraded', 'outage');

        if (status === 'outage' || status === 'offline') {
            pill.classList.add('outage');
            if (textEl) textEl.innerText = 'Major service outage';
        } else if (status === 'degraded') {
            pill.classList.add('degraded');
            if (textEl) textEl.innerText = 'Partial service disruption';
        } else {
            pill.classList.add('operational');
            if (textEl) textEl.innerText = 'All systems operational';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectFooterStatus);
    } else {
        injectFooterStatus();
    }
    setTimeout(injectFooterStatus, 400);
    window.ZyrexPoll.whileVisible(syncFooterStatus, 45000);
})();

// ==========================================
// Shared product profile resolver
// One rule for every page so a resource shows the same creator/uploader
// identity (name + photo) on the card, detail and download screens.
window.ZyrexProfile = (function () {
    var AVATAR_CACHE_KEY = 'zyrex_avatar_cache';

    function readAvatarCache() {
        try { return JSON.parse(localStorage.getItem(AVATAR_CACHE_KEY) || '{}') || {}; } catch (e) { return {}; }
    }

    function writeAvatarCache(map) {
        try { localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(map)); } catch (e) {}
    }

    function isDefaultAvatar(url) {
        var value = String(url || '');
        return !value || value.indexOf('/api/avatar/default/') === 0 || value.indexOf('/embed/avatars/') !== -1;
    }

    // Resolved avatars are cached per Discord user id so the same uploader looks
    // identical on every resource page instead of varying with per-product data.
    function cachedAvatar(userId) {
        if (!userId) return '';
        var value = readAvatarCache()[String(userId)];
        return isDefaultAvatar(value) ? '' : String(value);
    }

    function rememberAvatar(userId, url) {
        var value = String(url || '').trim();
        if (!userId || isDefaultAvatar(value)) return;
        if (!/^(https?:\/\/|\/api\/avatar\/)/.test(value)) return;
        var map = readAvatarCache();
        if (map[String(userId)] === value) return;
        if (Object.keys(map).length > 400) map = {};
        map[String(userId)] = value;
        writeAvatarCache(map);
    }

    function defaultDiscordAvatar(userId) {
        var id = String(userId || '');
        if (!/^\d{17,20}$/.test(id)) return '';
        var index = 0;
        try { index = Number((BigInt(id) >> 22n) % 6n); } catch (e) { index = parseInt(id, 10) % 5 || 0; }
        return '/api/avatar/default/' + index + '.png';
    }

    function avatarUrl(value, discordId) {
        var raw = String(value == null ? '' : value).trim();
        if (!raw) return '';
        // A field that was built from a missing value must never become the
        // literal image request "/undefined".
        if (/^(undefined|null|nan|false|true|\[object object\])$/i.test(raw)) return '';
        if (raw.indexOf('/api/avatar/') === 0) return raw;
        if (/^(a_[A-Za-z0-9_-]{16,}|[A-Za-z0-9_-]{16,})$/.test(raw)) {
            if (/^\d{17,20}$/.test(String(discordId || ''))) {
                var bareExt = raw.indexOf('a_') === 0 ? 'gif' : 'png';
                return '/api/avatar/' + discordId + '/' + raw + '.' + bareExt + '?size=128';
            }
            // A bare hash with no owning Discord id can never be resolved, and
            // using it as-is would request a bogus relative asset path.
            return '';
        }
        var cdn = raw.match(/^https?:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/avatars\/(\d{17,20})\/((?:a_)?[A-Za-z0-9_-]{16,})(?:\.(?:png|gif|webp|jpg|jpeg))?/i);
        if (cdn) {
            var ext = cdn[2].indexOf('a_') === 0 ? 'gif' : 'png';
            return '/api/avatar/' + cdn[1] + '/' + cdn[2] + '.' + ext + '?size=128';
        }
        // Guild-scoped links break once the member leaves the guild.
        var guildCdn = raw.match(/^https?:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/guilds\/\d{17,20}\/users\/(\d{17,20})\/avatars\/((?:a_)?[A-Za-z0-9_-]{16,})(?:\.(?:png|gif|webp|jpg|jpeg))?/i);
        if (guildCdn) {
            var guildExt = guildCdn[2].indexOf('a_') === 0 ? 'gif' : 'png';
            return '/api/avatar/' + guildCdn[1] + '/' + guildCdn[2] + '.' + guildExt + '?size=128';
        }
        var embed = raw.match(/^https?:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/embed\/avatars\/(\d+)\.png/i);
        if (embed) return '/api/avatar/default/' + embed[1] + '.png';
        return raw;
    }

    function text(value) {
        return String(value == null ? '' : value).trim();
    }

    // The uploader photo must come from Discord (or our permanent CDN copy of
    // it). Social creator photos were historically stored in the uploader
    // field as signed links, which expired and credited the wrong person.
    function uploaderAvatarUrl(value, discordId) {
        var raw = String(value == null ? '' : value).trim();
        if (!raw) return '';
        if (raw.indexOf('https://thumbnail.zyrexediting.xyz/') === 0) return raw;
        var resolved = avatarUrl(raw, discordId);
        if (!resolved) return '';
        return /^\/(?:api\/)?avatars?\//.test(resolved) ? resolved : '';
    }

    // The creator field only carries a valid uploader avatar when it actually
    // belongs to the uploader; a social creator's photo must never be used.
    function creatorAvatarBelongsTo(value, uploaderId) {
        var raw = text(value);
        if (!raw) return false;
        var owner = raw.match(/\/(?:avatars|avatar)\/(\d{17,20})\//i);
        if (owner) return owner[1] === text(uploaderId);
        return /^(?:a_)?[a-z0-9_-]{16,}$/i.test(raw);
    }

    function forProduct(product) {
        var p = product || {};
        var isAnonymous = !!p.is_anonymous;
        var creditedId = text(p.credited_uploader_id);
        var rawUploaderId = (!isAnonymous && creditedId) ? creditedId : text(p.uploader_id || p.author_id);
        var creatorName = text(p.creator_nickname) || text(p.author_name) || text(p.uploader_name) || 'Zyrex Creator';
        var creditedName = text(p.credited_uploader_name);
        var creatorUsername = text(p.creator_username).replace(/^@+/, '');
        var isFounderSocialImport = !isAnonymous && !creditedId
            && rawUploaderId === '1421177012814614548'
            && creatorUsername
            && !/^(reyli|reyliar)$/i.test(creatorUsername);
        // Keep the submitting account in uploader fields. A social creator is
        // a separate identity and must not replace the uploader's name/photo.
        var uploaderId = rawUploaderId;
        var uploaderName = (!isAnonymous && creditedName)
            ? creditedName
            : (text(p.uploader_name) || text(p.author_name) || creatorName);
        // Resolve the uploader avatar deterministically for the same person:
        // cached value first, then stored data, then Discord's id-based default.
        var creditedAvatar = text(p.credited_uploader_avatar);
        var storedUploaderAvatar = (!isAnonymous && creditedAvatar)
            ? uploaderAvatarUrl(creditedAvatar, uploaderId)
            : (uploaderAvatarUrl(p.uploader_avatar || p.author_avatar, uploaderId)
                || (creatorAvatarBelongsTo(p.creator_avatar, uploaderId) ? uploaderAvatarUrl(p.creator_avatar, uploaderId) : ''));
        var cached = cachedAvatar(uploaderId);
        var uploaderAvatar = cached
            || storedUploaderAvatar
            || defaultDiscordAvatar(uploaderId);
        if (!cached && !isDefaultAvatar(storedUploaderAvatar)) rememberAvatar(uploaderId, storedUploaderAvatar);

        // Anonymous uploads only hide the uploader. The creator is a different
        // person, so an uploader-owned photo is never reused as the creator's.
        var hasSocialCreatorIdentity = Boolean(
            text(p.creator_platform) || text(p.creator_social_url) || text(p.creator_account_id) || text(p.creator_username)
        );
        var creatorFallback = (!isAnonymous && !hasSocialCreatorIdentity) ? uploaderAvatar : '';
        var isCreatorCdnPhoto = /^https:\/\/thumbnail\.zyrexediting\.xyz\//i.test(text(p.creator_avatar));
        var creatorAvatar = avatarUrl(p.creator_avatar, uploaderId) || creatorFallback;

        if (isAnonymous) {
            var creatorLabel = creatorName;
            var uploaderLabel = String(p.author_name || p.uploader_name || '').trim().toLowerCase();
            uploaderName = 'Anonymous';
            uploaderAvatar = '';
            uploaderId = '';
            creatorName = (!creatorLabel || creatorLabel.trim().toLowerCase() === uploaderLabel)
                ? 'Zyrex Creator'
                : creatorLabel;
            if (!isCreatorCdnPhoto) creatorAvatar = '';
        }

        return {
            isAnonymous: isAnonymous,
            creatorName: creatorName,
            creatorAvatar: creatorAvatar,
            creatorUsername: text(p.creator_username).replace(/^@+/, ''),
            creatorSocialUrl: text(p.creator_social_url || p.source_url || p.product_url),
            uploaderName: uploaderName,
            uploaderAvatar: uploaderAvatar,
            uploaderId: uploaderId,
            isSocialCreator: isFounderSocialImport,
            isAdmin: !isAnonymous && p.uploader_is_admin === true && rawUploaderId === '1421177012814614548'
        };
    }

    return {
        avatarUrl: avatarUrl,
        uploaderAvatarUrl: uploaderAvatarUrl,
        forProduct: forProduct,
        cachedAvatar: cachedAvatar,
        rememberAvatar: rememberAvatar,
        defaultDiscordAvatar: defaultDiscordAvatar
    };
})();

// ==========================================
// Shared installation guide
// One source of truth for the "How to Install" tab so the access rules and the
// version-mismatch advice cannot drift between pages.
window.ZyrexInstallGuide = (function () {
    var HELIX_CONVERTER_URL = 'https://www.hlx.ae/download';
    var ACCESS_DAYS = 7;

    function esc(value) {
        return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function step(number, title, body) {
        return '<div style="display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid rgba(255, 255, 255, .06)">' +
            '<span style="flex:0 0 26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;' +
                'background:linear-gradient(135deg,var(--cherry,rgba(var(--zr-rgb-255-43-82, 255, 43, 82), 1)),rgba(var(--zr-rgb-139-0-40, 139, 0, 40), 1));color:#fff;font-size:.78rem;font-weight:800">' + number + '</span>' +
            '<div style="flex:1 1 auto;min-width:0">' +
                '<strong style="display:block;color:#fff;font-size:.95rem;margin-bottom:4px">' + title + '</strong>' +
                '<div style="color:var(--text-sub,#9aa0b4);font-size:.88rem;line-height:1.65">' + body + '</div>' +
            '</div></div>';
    }

    // Returns pane content only: the caller owns the #tab-guide element, so
    // wrapping here would nest a second pane and hide the guide.
    function render(category) {
        var target = esc(category || 'your editor');
        return '' +
            '<h4 style="color:#fff;margin-bottom:6px">Installation Guide</h4>' +
            '<p style="color:var(--text-sub,#9aa0b4);font-size:.86rem;margin:0 0 4px;line-height:1.6">' +
                'Leak downloads are protected by a free Zyrex download pass. Follow the steps below in order.' +
            '</p>' +
            step(1, 'Unlock download access',
                'Sign in with Discord, then make sure you have the <strong>Verified</strong> role in the Zyrex Discord. ' +
                'Open the <a href="/access" style="color:var(--cherry-neon,rgba(var(--zr-rgb-255-92-122, 255, 92, 122), 1));font-weight:600">Access page</a> and complete one free offer. ' +
                'Your pass is linked to your Discord account, works on every device, and stays active for ' +
                '<strong>' + ACCESS_DAYS + ' days</strong> from the moment the offer is confirmed. ' +
                'When it runs out, simply complete another offer to renew it.') +
            step(2, 'Generate a secure download link',
                'Come back to this page with the pass active and use <strong>Download</strong>. ' +
                'Downloads run from a one-time encrypted link that expires after a few minutes, so start the transfer right away and do not share the link.') +
            step(3, 'Extract the archive',
                'Unzip the package with 7-Zip, WinRAR or the built-in extractor. ' +
                'If Windows blocks one of the files (an .ffx or .aex, for example), right-click it, open <em>Properties</em> and tick <em>Unblock</em> before importing.') +
            step(4, 'Import the files into ' + target,
                'Open ' + target + ' and import the extracted file, or drop it into the folder that app reads. ' +
                '(For example, Adobe After Effects loads presets from <em>Documents/Adobe/After Effects/&lt;version&gt;/User Presets</em>.) ' +
                'Keep the folder structure exactly as it arrived \u2014 a resource and its assets must stay together.') +
            step(5, 'Apply the leak in your project',
                'Select a clip or an adjustment layer, then apply the leak from your library. ' +
                'If an effect shows as missing, install the plugins listed in the description and reopen the project.') +
            '<div style="margin-top:14px;padding:14px 16px;border:1px solid rgba(var(--zr-rgb-255-43-82, 255, 43, 82),.45);border-radius:14px;' +
                'background:linear-gradient(110deg,rgba(var(--zr-rgb-255-43-82, 255, 43, 82),.14),rgba(var(--zr-rgb-255-43-82, 255, 43, 82),.04))">' +
                '<strong style="display:block;color:#fff;font-size:.92rem;margin-bottom:6px">' +
                    '<i class="fas fa-triangle-exclamation" style="color:var(--cherry-neon,rgba(var(--zr-rgb-255-92-122, 255, 92, 122), 1))"></i> Version mismatch after installing?' +
                '</strong>' +
                '<p style="color:var(--text-sub,#9aa0b4);font-size:.86rem;line-height:1.65;margin:0 0 10px">' +
                    'Leaks are frequently built for one specific editor release. ' +
                    'If a file refuses to open, throws a version or compatibility error, or was made in an older or newer ' +
                    'version than you run, convert it first and then import the converted copy.' +
                '</p>' +
                '<a href="' + HELIX_CONVERTER_URL + '" target="_blank" rel="noopener noreferrer" ' +
                    'style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:10px;' +
                    'background:linear-gradient(135deg,var(--cherry,rgba(var(--zr-rgb-255-43-82, 255, 43, 82), 1)),rgba(var(--zr-rgb-139-0-40, 139, 0, 40), 1));color:#fff;font-weight:700;' +
                    'font-size:.85rem;text-decoration:none">' +
                    '<i class="fas fa-arrows-rotate"></i> Get Helix Converter' +
                    '<i class="fas fa-arrow-up-right-from-square" style="font-size:.72rem;opacity:.85"></i>' +
                '</a>' +
                '<div style="color:var(--text-sub,#9aa0b4);font-size:.74rem;margin-top:8px">' +
                    'Helix Converter is a third-party tool provided by hlx.ae and is not affiliated with Zyrex.' +
                '</div>' +
            '</div>';
    }

    return { render: render, accessDays: ACCESS_DAYS, helixConverterUrl: HELIX_CONVERTER_URL };
})();

// ==========================================
console.log('Zyrex - Website loaded successfully!');

// Small liquid-glass cursor with gentle follow motion and a quiet click tick.
(function setupMacCursorHover() {
    if (!window.matchMedia || !window.matchMedia('(hover:hover) and (pointer:fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var body = document.body;
    if (!body || body.dataset.zrCursorReady === '1') return;
    body.dataset.zrCursorReady = '1';
    var halo = document.createElement('span');
    halo.className = 'zr-cursor-halo';
    halo.setAttribute('aria-hidden', 'true');
    halo.innerHTML = '<svg class="zr-cursor-shape zr-cursor-arrow" viewBox="0 0 32 42" focusable="false"><defs><linearGradient id="zrCursorArrowGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="white" stop-opacity=".96"/><stop offset=".48" stop-color="var(--zr-cursor-accent,#ff3158)" stop-opacity=".26"/><stop offset="1" stop-color="var(--zr-cursor-accent,#ff3158)" stop-opacity=".72"/></linearGradient></defs><path d="M3 2.5v34l8.4-9.2 6.1 12.1 6.1-3.1-6.2-12.2h12.1L3 2.5z"/></svg>' +
        '<svg class="zr-cursor-shape zr-cursor-hand" viewBox="0 0 38 42" focusable="false"><defs><linearGradient id="zrCursorHandGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="white" stop-opacity=".96"/><stop offset=".48" stop-color="var(--zr-cursor-accent,#ff3158)" stop-opacity=".24"/><stop offset="1" stop-color="var(--zr-cursor-accent,#ff3158)" stop-opacity=".7"/></linearGradient></defs><path d="M12 39.5c-.2-5.2-1.5-8.5-4.7-11.9l-4.5-4.8a3.4 3.4 0 0 1 4.8-4.8l7.2 6.8V5.1a3.6 3.6 0 0 1 7.2 0v11.1a3.4 3.4 0 0 1 6.8.5v2.1a3.2 3.2 0 0 1 6.4.6v7.1c0 4.7-2.4 8.4-3.7 13H12z"/></svg>';
    body.appendChild(halo);
    var targetX = -100, targetY = -100, x = targetX, y = targetY, frame = 0;
    function animateCursor() {
        x += (targetX - x) * 0.22;
        y += (targetY - y) * 0.22;
        halo.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
        if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.15) frame = window.requestAnimationFrame(animateCursor);
        else frame = 0;
    }
    var audioContext = null;
    function playClickTick() {
        try {
            var AudioCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtor) return;
            if (!audioContext) audioContext = new AudioCtor();
            if (audioContext.state === 'suspended') audioContext.resume();
            var now = audioContext.currentTime;
            var oscillator = audioContext.createOscillator();
            var gain = audioContext.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(760, now);
            oscillator.frequency.exponentialRampToValueAtTime(520, now + 0.028);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.018, now + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.start(now);
            oscillator.stop(now + 0.04);
        } catch (_) { /* Audio is optional; the interface stays silent if unavailable. */ }
    }
    document.addEventListener('pointermove', function (event) {
        if (event.pointerType !== 'mouse') return;
        targetX = event.clientX;
        targetY = event.clientY;
        if (!frame) frame = window.requestAnimationFrame(animateCursor);
        body.classList.add('zr-cursor-ready', 'zr-cursor-active');
        body.classList.toggle('zr-cursor-hover', Boolean(event.target && event.target.closest && event.target.closest('a,button,[role="button"],[role="link"],input,textarea,select,label')));
    }, { passive: true });
    document.addEventListener('pointerdown', function (event) {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        body.classList.add('zr-cursor-pressed');
        playClickTick();
    }, { passive: true });
    document.addEventListener('pointerup', function () { body.classList.remove('zr-cursor-pressed'); }, { passive: true });
    document.addEventListener('pointerleave', function () { body.classList.remove('zr-cursor-ready', 'zr-cursor-active', 'zr-cursor-hover', 'zr-cursor-pressed'); }, { passive: true });
})();
