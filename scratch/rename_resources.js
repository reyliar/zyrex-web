const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace navbar and footer links
    content = content.replace(/href="\/resources"/g, 'href="/presets"');
    content = content.replace(/href="resources"/g, 'href="presets"');
    content = content.replace(/https:\/\/zyrexediting\.xyz\/resources/g, 'https://zyrexediting.xyz/presets');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

// 1. Update plugins directory
const pluginsDir = path.join(__dirname, '..', 'plugins');
if (fs.existsSync(pluginsDir)) {
    fs.readdirSync(pluginsDir).forEach(f => {
        if (f.endsWith('.html')) {
            replaceInFile(path.join(pluginsDir, f));
        }
    });
}

// 2. Update root html files
const rootDir = path.join(__dirname, '..');
fs.readdirSync(rootDir).forEach(f => {
    if (f.endsWith('.html')) {
        replaceInFile(path.join(rootDir, f));
    }
});

console.log("Done updating links!");
