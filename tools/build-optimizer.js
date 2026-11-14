/**
 * Zyrex Web — Automated Production Build Optimizer
 * Minifies all HTML, CSS, and JS assets into ultra-compact, single-line production files
 * (equivalent to Next.js / Turbopack production builds like 6ureleaks.com).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

const ASSETS_DIR = path.resolve(__dirname, '..', '.site-assets');

if (!fs.existsSync(ASSETS_DIR)) {
    console.error('Error: .site-assets directory not found. Please sync files first.');
    process.exit(1);
}

// 1. Critical Preload & Preconnect Tags to inject into <head>
const PRELOAD_SNIPPET = [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link rel="dns-prefetch" href="https://cdn.discordapp.com">',
    '<link rel="dns-prefetch" href="https://thumbnail.zyrexediting.xyz">',
    '<link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">'
].join('');

function injectPreloads(html) {
    if (html.includes('rel="dns-prefetch" href="https://thumbnail.zyrexediting.xyz"')) {
        return html;
    }
    const headIndex = html.indexOf('<head>');
    if (headIndex !== -1) {
        return html.slice(0, headIndex + 6) + PRELOAD_SNIPPET + html.slice(headIndex + 6);
    }
    return html;
}

// Minify CSS Helper
// Selector and declaration text are minified separately: whitespace before ':' is a
// descendant combinator in selectors (".a :hover") and must never be removed.
function minifySelector(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ',')
        .replace(/\s*([>+~])\s*/g, '$1')
        .trim();
}

function minifyDeclarations(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\s*:\s*/g, ':')
        .replace(/\s*,\s*/g, ',')
        .replace(/\s*;\s*/g, ';')
        .trim();
}

function minifyCss(css) {
    const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
    let out = '';
    let buf = '';
    let depth = 0;
    for (const ch of src) {
        if (ch === '{') {
            out += minifySelector(buf) + '{';
            buf = '';
            depth++;
        } else if (ch === '}') {
            out += minifyDeclarations(buf) + '}';
            buf = '';
            depth = Math.max(0, depth - 1);
        } else {
            buf += ch;
        }
    }
    out += depth === 0 ? minifySelector(buf) : minifyDeclarations(buf);
    return out.replace(/;}/g, '}').trim();
}

console.log('\x1b[36m%s\x1b[0m', '⚡ Running Zyrex Production Build Optimizer...');

let totalOriginalBytes = 0;
let totalMinifiedBytes = 0;
let processedFiles = 0;

// Process CSS files in .site-assets/css
const cssDir = path.join(ASSETS_DIR, 'css');
if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
    for (const file of cssFiles) {
        const fullPath = path.join(cssDir, file);
        const orig = fs.readFileSync(fullPath, 'utf8');
        const minified = minifyCss(orig);
        totalOriginalBytes += orig.length;
        totalMinifiedBytes += minified.length;
        processedFiles++;
        fs.writeFileSync(fullPath, minified, 'utf8');
    }
}

// Process JS files: strip comments and dead whitespace without renaming
// top-level identifiers, because pages call them from inline handlers.
const jsDir = path.join(ASSETS_DIR, 'js');
if (fs.existsSync(jsDir)) {
    const jsFiles = [];
    (function collect(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) collect(full);
            else if (entry.isFile() && entry.name.endsWith('.js')) jsFiles.push(full);
        }
    })(jsDir);

    for (const fullPath of jsFiles) {
        const orig = fs.readFileSync(fullPath, 'utf8');
        const result = esbuild.transformSync(orig, {
            minifyWhitespace: true,
            minifySyntax: true,
            minifyIdentifiers: false,
            legalComments: 'none',
            target: 'es2020'
        });
        const minified = result.code.replace(/\n?\/\/# sourceMappingURL=.*$/m, '').trim();
        totalOriginalBytes += orig.length;
        totalMinifiedBytes += minified.length;
        processedFiles++;
        fs.writeFileSync(fullPath, minified, 'utf8');
    }
}

// Process HTML files in .site-assets
function safeMinifyHtml(html) {
    let res = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');
    const parts = [];
    let lastIndex = 0;
    const tagRegex = /<(script|style|pre|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi;
    let match;
    while ((match = tagRegex.exec(res)) !== null) {
        let before = res.slice(lastIndex, match.index);
        before = before.replace(/>\s+</g, '><');
        parts.push(before);

        let blockContent = match[0];
        if (/^<style\b/i.test(blockContent)) {
            blockContent = blockContent.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/i, (_, open, css, close) => {
                return open + minifyCss(css) + close;
            });
        }
        parts.push(blockContent);
        lastIndex = tagRegex.lastIndex;
    }
    let rest = res.slice(lastIndex).replace(/>\s+</g, '><');
    parts.push(rest);
    return parts.join('');
}

const htmlFiles = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.html'));

// Fast and safe in-process HTML minification
for (const file of htmlFiles) {
    const fullPath = path.join(ASSETS_DIR, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    totalOriginalBytes += content.length;

    // Inject critical connection hints
    content = injectPreloads(content);

    // Minify HTML structure safely without corrupting inline JavaScript
    const minified = safeMinifyHtml(content);

    fs.writeFileSync(fullPath, minified, 'utf8');
    totalMinifiedBytes += minified.length;
    processedFiles++;
}

const savedBytes = totalOriginalBytes - totalMinifiedBytes;
const savedPercent = totalOriginalBytes > 0 ? ((savedBytes / totalOriginalBytes) * 100).toFixed(1) : 0;
const origKb = (totalOriginalBytes / 1024).toFixed(1);
const miniKb = (totalMinifiedBytes / 1024).toFixed(1);

console.log('\x1b[32m%s\x1b[0m', `✔ Build Optimization Complete!`);
console.log(`  Processed: ${processedFiles} files`);
console.log(`  Size Reduction: ${origKb} KB → ${miniKb} KB (${savedPercent}% saved)`);
console.log(`  All production files are now single-line, minified, and preload-optimized!`);

