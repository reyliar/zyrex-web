/**
 * Zyrex Web — Automated Production Build Optimizer
 * Minifies all HTML, CSS, and JS assets into ultra-compact, single-line production files
 * (equivalent to Next.js / Turbopack production builds like 6ureleaks.com).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
function minifyCss(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([\{\}:;,])\s*/g, '$1')
        .replace(/;}/g, '}')
        .trim();
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

// Process HTML files in .site-assets
const htmlFiles = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.html'));

// Ensure html-minifier-terser is used for full single-line HTML + Inline CSS + Inline JS minification
for (const file of htmlFiles) {
    const fullPath = path.join(ASSETS_DIR, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    totalOriginalBytes += content.length;

    // Inject critical connection hints
    content = injectPreloads(content);
    fs.writeFileSync(fullPath, content, 'utf8');

    try {
        // Run html-minifier-terser on the file
        execSync(`npx html-minifier-terser "${fullPath}" --collapse-whitespace --remove-comments --remove-redundant-attributes --remove-script-type-attributes --remove-style-link-type-attributes --use-short-doctype --minify-css true --minify-js true -o "${fullPath}"`, {
            stdio: 'pipe'
        });
        const minified = fs.readFileSync(fullPath, 'utf8');
        totalMinifiedBytes += minified.length;
        processedFiles++;
    } catch (e) {
        // Fallback lightweight regex minifier if html-minifier-terser encounters non-standard markup
        const fallback = content
            .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
            .replace(/>\s+</g, '><')
            .replace(/\s+/g, ' ')
            .trim();
        fs.writeFileSync(fullPath, fallback, 'utf8');
        totalMinifiedBytes += fallback.length;
        processedFiles++;
    }
}

const savedBytes = totalOriginalBytes - totalMinifiedBytes;
const savedPercent = totalOriginalBytes > 0 ? ((savedBytes / totalOriginalBytes) * 100).toFixed(1) : 0;
const origKb = (totalOriginalBytes / 1024).toFixed(1);
const miniKb = (totalMinifiedBytes / 1024).toFixed(1);

console.log('\x1b[32m%s\x1b[0m', `✔ Build Optimization Complete!`);
console.log(`  Processed: ${processedFiles} files`);
console.log(`  Size Reduction: ${origKb} KB → ${miniKb} KB (${savedPercent}% saved)`);
console.log(`  All production files are now single-line, minified, and preload-optimized!`);

