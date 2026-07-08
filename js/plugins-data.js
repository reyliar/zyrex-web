/* ===================== PLUGINS & SOFTWARE DATA =====================
 * Sources: codec.kyiv.ua (ad0be, avid), monkrus.ws, macked.app
 * Password per source:
 *   codec.kyiv.ua → mostly no password (VR4ALL only for old archives marked on site)
 *   monkrus.ws → no password (torrent, pre-activated)
 *   macked.app → no password (direct download)
 * =================================================================== */

// Per-source passwords
const PW_CODEC = 'VR4ALL';
const PW_MONKRUS = null; const PW_MACKED = null;

function makeId(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .replace(/--+/g, '-');
}

window.pluginsData = [

    // ═══════════════════════════════════════════
    // ADOBE SOFTWARE
    // ═══════════════════════════════════════════
    {
        vt_scan: { id: 'aHR0cHM6Ly9rb3JzYXJzLnByby92aWV3dG9waWMucGhwP3Q9MTQxMjc3', harmless: 57, malicious: 0 },
        id: makeId('Adobe Premiere Pro 2026 v26.3'),
        name: 'Adobe Premiere Pro 2026 (v26.3)',
        category: 'software', platform: 'win', password: null,
        desc: 'Adobe Premiere Pro 2026 v26.3 Multilingual — professional video editing software.',
        notes: 'Direct download.',
        links: [
            { url: 'https://korsars.pro/viewtopic.php?t=141277', label: 'Korsars (torrent)' },
            { url: 'https://tapochek.net/viewtopic.php?t=287252', label: 'Tapochek (torrent)' },
            { url: 'https://uztracker.me/threads/70666', label: 'UZTracker (torrent)' }
        ]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9pczEyLmFyZmlsZXMubmV0L0FmdGVyLkVmZmVjdHMuMjAyNi52MjYuMC4wLnJhcg', harmless: 62, malicious: 0 },
        id: makeId('After Effects 2026 v26.0 Direct'),
        name: 'After Effects 2026 (v26.0)',
        category: 'software', platform: 'win', password: null,
        desc: 'Adobe After Effects 2026 v26.0.0 — direct download for Windows.',
        links: [{ url: 'https://is12.arfiles.net/After.Effects.2026.v26.0.0.rar', label: 'ArFiles (direct)' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9pczIuYXJmaWxlcy5uZXQvQWZ0ZXJfRWZmZWN0c18yNS41LnJhcg', harmless: 58, malicious: 0 },
        id: makeId('After Effects 2025 v25.5'),
        name: 'After Effects 2025 (v25.5)',
        category: 'software', platform: 'win', password: null,
        desc: 'Adobe After Effects 2025 v25.5 — direct download for Windows.',
        links: [{ url: 'https://is2.arfiles.net/After_Effects_25.5.rar', label: 'ArFiles (direct)' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9pczE0LmFyZmlsZXMubmV0L0Fkb2JlX0FmdGVyX0VmZmVjdHNfMjAyNF8yNC41LjAuMDUyLnJhcg', harmless: 59, malicious: 0 },
        id: makeId('After Effects 2024 v24.5'),
        name: 'After Effects 2024 (v24.5)',
        category: 'software', platform: 'win', password: null,
        desc: 'Adobe After Effects 2024 v24.5.0.052 — direct download for Windows.',
        links: [{ url: 'https://is14.arfiles.net/Adobe_After_Effects_2024_24.5.0.052.rar', label: 'ArFiles (direct)' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kb3dubG9hZDIyNjgubWVkaWFmaXJlLmNvbS8yeXh0aW81ZjF5emc3c3NVUzFuZUMyRThHYS1ZNHpkOFpzQldycUtRbE5WNUV6LWhSYmtxeVUyNVU3cHl6d29FVzlwZGk1Nm1rRGpvV0dteWszdWJQRjVsNFI2UWs2S1dGVWJEdHJaM0dBT2hFNjc4Ym9Bbmx6eUMySXdMbXhyUjc3MjFTeHFsQ0c5bmRmSXZKVDRkY2RRZVVHUHFfS1dNaVV2VUc1U0lSSlEvMGIwZHkxOHFienAxMmp1L0Fkb2JlX0FmdGVyX0VmZmVjdHNfMjAyM194NjQucmFy', harmless: 59, malicious: 0 },
        id: makeId('After Effects 2023 v23.2'),
        name: 'After Effects 2023 (v23.2)',
        category: 'software', platform: 'win', password: null,
        desc: 'Adobe After Effects 2023 x64 — direct download for Windows.',
        links: [{ url: 'https://download2268.mediafire.com/2yxtio5f1yzg7ssUS1neC2E8Ga-Y4zd8ZsBWrqKQlNV5Ez-hRbkqyU25U7pyzwoEW9pdi56mkDjoWGmyk3ubPF5l4R6Qk6KWFUbDtrZ3GAOhE678boAnlzyC2IwLmxrR7721SxqlCG9ndfIvJT4dcdQeUGPq_KWMiUvUG5SIRJQ/0b0dy18qbzp12ju/Adobe_After_Effects_2023_x64.rar', label: 'MediaFire (direct)' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9pbnMyLmFyZmlsZXMubmV0L0Fkb2JlJTIwQWZ0ZXIlMjBFZmZlY3RzJTIwMjAyMiUyMHYyMi42LjAuNjQlMjAoeDY0KSUyME11bHRpbGluZ3VhbC56aXA', harmless: 56, malicious: 1 },
        id: makeId('After Effects 2022 v22.6'),
        name: 'After Effects 2022 (v22.6)',
        category: 'software', platform: 'win', password: null,
        desc: 'Adobe After Effects 2022 v22.6.0.64 Multilingual — direct download for Windows.',
        links: [{ url: 'https://ins2.arfiles.net/Adobe%20After%20Effects%202022%20v22.6.0.64%20(x64)%20Multilingual.zip', label: 'ArFiles (direct)' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly93d3cubWVkaWFmaXJlLmNvbS9maWxlL2R5amZ6aXhtMXRybTVqaS9BZG9iZUFmdGVyRWZmZWN0czIwMjF2MTguNC4xLjR4NjQuN3ovZmlsZQ', harmless: 73, malicious: 0 },
        id: makeId('After Effects 2021 v18.4'),
        name: 'After Effects 2021 (v18.4)',
        category: 'software', platform: 'win', password: null,
        desc: 'Adobe After Effects 2021 v18.4.1.4 x64 — direct download for Windows.',
        links: [{ url: 'https://www.mediafire.com/file/dyjfzixm1trm5ji/AdobeAfterEffects2021v18.4.1.4x64.7z/file', label: 'MediaFire (direct)' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9zZXJ2ZXI4MS5zYWZlZmlsZWhvc3RpbmcuY29tOjIyMzcyL2lnZXRpbnRvcGMuY29tL2Rvd25sb2FkLnBocD91cmxfc3RyPWh0dHBzJTNBJTJGJTJGc2VydmVyODEuc2FmZWZpbGVob3N0aW5nLmNvbSUyRmlHZXRpbnRvcGMuY29tJTJGZG93bmxvYWQucGhwJTNGZmlsZW5hbWUlM0RfaWdldGludG9wYy5jb21fQWRvYmVfQWZ0ZXJfRWZmZWN0c18yMDIwX3g2NC5yYXIlMjZleHBpcmVzJTNEMTc4MzI3MjI5NCUyNnNpZ25hdHVyZSUzRDdhNWM0Njk2NDY4N2ZkNDQxOTY3MmMwOTM2NDk2NTE2JmZpbGVuYW1lPV9pZ2V0aW50b3BjLmNvbV9BZG9iZV9BZnRlcl9FZmZlY3RzXzIwMjBfeDY0LnJhciZzZG9tYWluPWlnZXRpbnRvcGMuY29t', harmless: 58, malicious: 0 },
        id: makeId('After Effects 2020 v17.5'),
        name: 'After Effects 2020 (v17.5)',
        category: 'software', platform: 'win', password: 'igetintopc.com',
        desc: 'Adobe After Effects 2020 x64 — from igetintopc.com.',
        notes: 'ZIP password: igetintopc.com',
        links: [{ url: 'https://server81.safefilehosting.com:22372/igetintopc.com/download.php?url_str=https%3A%2F%2Fserver81.safefilehosting.com%2FiGetintopc.com%2Fdownload.php%3Ffilename%3D_igetintopc.com_Adobe_After_Effects_2020_x64.rar%26expires%3D1783272294%26signature%3D7a5c46964687fd4419672c0936496516&filename=_igetintopc.com_Adobe_After_Effects_2020_x64.rar&sdomain=igetintopc.com', label: 'iGetIntoPC (direct)' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9pczcuYXJmaWxlcy5uZXQvQWRvYmVfQWZ0ZXJfRWZmZWN0c18yMDE5X3YxNi4xLjIuNTVfTXVsdGlsaW5ndWFsLnppcA', harmless: 63, malicious: 0 },
        id: makeId('After Effects 2019 v16.1'),
        name: 'After Effects 2019 (v16.1)',
        category: 'software', platform: 'win', password: null,
        desc: 'Adobe After Effects 2019 v16.1.2.55 Multilingual — direct download for Windows.',
        links: [{ url: 'https://is7.arfiles.net/Adobe_After_Effects_2019_v16.1.2.55_Multilingual.zip', label: 'ArFiles (direct)' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9nb2ZpbGUuaW8vZC9Kc1Y0b3M', harmless: 57, malicious: 0 },
        id: makeId('Adobe Photoshop 2026 GoFile'),
        name: 'Adobe Photoshop 2026',
        category: 'software', platform: 'win', password: 'star',
        desc: 'Adobe Photoshop 2026 — direct download for Windows.',
        links: [{ url: 'https://gofile.io/d/JsV4os', label: 'GoFile (direct)' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9waXhlbGRyYWluLmNvbS9hcGkvZmlsZS9ZdUxScGpzTg', harmless: 60, malicious: 0 },
        id: makeId('Adobe Photoshop 2025'),
        name: 'Adobe Photoshop 2025',
        category: 'software', platform: 'win', password: '09',
        desc: 'Adobe Photoshop 2025 — direct download for Windows.',
        notes: 'ZIP password: 09',
        links: [{ url: 'https://pixeldrain.com/api/file/YuLRpjsN', label: 'Pixeldrain (direct)' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9nb2ZpbGUuaW8vZC82Q3dZcnI', harmless: 59, malicious: 0 },
        id: makeId('Adobe Photoshop 2024 GoFile'),
        name: 'Adobe Photoshop 2024',
        category: 'software', platform: 'win', password: 'star',
        desc: 'Adobe Photoshop 2024 — direct download for Windows.',
        links: [{ url: 'https://gofile.io/d/6CwYrr', label: 'GoFile (direct)' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9nb2ZpbGUuaW8vZC9ZQmcwSUc', harmless: 63, malicious: 0 },
        id: makeId('Substance 3D Designer'),
        name: 'Substance 3D Designer',
        category: 'software', platform: 'win', password: 'star',
        desc: 'Adobe Substance 3D Designer — material authoring tool for 3D. Direct download for Windows.',
        links: [{ url: 'https://gofile.io/d/YBg0IG', label: 'GoFile (direct)' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9nb2ZpbGUuaW8vZC9kTGhaSFA', harmless: 59, malicious: 0 },
        id: makeId('Substance 3D Modeler'),
        name: 'Substance 3D Modeler',
        category: 'software', platform: 'win', password: 'star',
        desc: 'Adobe Substance 3D Modeler — 3D modeling tool. Direct download for Windows.',
        links: [{ url: 'https://gofile.io/d/dLhZHP', label: 'GoFile (direct)' }]
    },    {
        id: makeId('Adobe Lightroom Classic v15.4.1'),
        name: 'Adobe Lightroom Classic v15.4.1',
        category: 'software', platform: 'win', password: "star",
        desc: 'Adobe Lightroom Classic v15.4.1 Multilingual — powerful photo editing and organization tools. Pre-activated by m0nkrus.',
        notes: 'Direct download.',
        links: [{ url: "https://gofile.io/d/EummVn", label: "GoFile (direct)" }]
    },
    {
        id: makeId('Adobe Illustrator 2026 v30.6'),
        name: 'Adobe Illustrator 2026 (v30.6)',
        category: 'software', platform: 'win', password: "star",
        desc: 'Adobe Illustrator 2026 v30.6 Multilingual — vector graphics and illustration software. Pre-activated by m0nkrus.',
        notes: 'Direct download.',
        links: [{ url: "https://gofile.io/d/UxyytM", label: "GoFile (direct)" }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly93MTgubW9ua3J1cy53cy8yMDI2LzA2L2Fkb2JlLWluZGVzaWduLTIwMjYtdjIxNDEtbXVsdGlsaW5ndWFsLmh0bWw', harmless: 57, malicious: 3 },
        id: makeId('Adobe InDesign 2026 v21.4.1'),
        name: 'Adobe InDesign 2026 (v21.4.1)',
        category: 'software', platform: 'win', password: null,
        desc: 'Adobe InDesign 2026 v21.4.1 Multilingual — page design and layout for print and digital. Pre-activated by m0nkrus.',
        notes: 'Direct download.',
        links: [{ url: 'https://w18.monkrus.ws/2026/06/adobe-indesign-2026-v2141-multilingual.html', label: 'Torrent (monkrus.ws)' }]
    },
    {
        id: makeId('Adobe Substance 3D Painter v12.1.0'),
        name: 'Adobe Substance 3D Painter v12.1.0',
        category: 'software', platform: 'win', password: "star",
        desc: 'Adobe Substance 3D Painter v12.1.0 Multilingual — 3D texturing tool for games, films, and design. Pre-activated by m0nkrus.',
        notes: 'Direct download.',
        links: [{ url: "https://gofile.io/d/DgVY26", label: "GoFile (direct)" }]
    },

    // ═══════════════════════════════════════════
    // AFTER EFFECTS PLUGINS (from codec.kyiv.ua/ad0be.html) — password: VR4ALL
    // ═══════════════════════════════════════════
    {
        vt_scan: { id: 'aHR0cHM6Ly9mdWNraW5nZmFzdC5uZXQvbTh4ZmtqbG0yNGxy', harmless: 54, malicious: 5 },
        id: makeId('Maxon Red Giant 2026.4.1'),
        name: 'Maxon Red Giant 2026.4.1',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Maxon Red Giant Complete 2026.4.1 — includes Trapcode Suite, Magic Bullet Suite, Universe, VFX Suite. The essential plugin collection for AE.',
        notes: 'Compatible with AE 2025+. Includes Trapcode Particular, Magic Bullet Looks, Universe transitions.',
        links: [{ url: 'https://fuckingfast.net/m8xfkjlm24lr', label: 'FuckingFast' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9mdWNraW5nZmFzdC5uZXQvZzMzbWR2dnYwb3h4', harmless: 53, malicious: 4 },
        id: makeId('BorisFX Continuum 2026.5 AE'),
        name: 'BorisFX Continuum 2026.5 (AE)',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'BorisFX Continuum 2026.5 v19.5.4 — comprehensive VFX plugin suite with 300+ effects, transitions, and tools for After Effects.',
        notes: 'Industry standard VFX suite. Includes Particle Illusion, Title Studio, and more.',
        links: [{ url: 'https://fuckingfast.net/g33mdvvv0oxx', label: 'FuckingFast' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svbmR4aXB0cWpsbmw3L0JvcmlzRlguU2FwcGhpcmUuQUUuMjAyNi41LnJhcg', harmless: 58, malicious: 0 },
        id: makeId('BorisFX Sapphire AE 2026.5'),
        name: 'BorisFX Sapphire AE 2026.5',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'BorisFX Sapphire 2026.5 for After Effects — 270+ visual effects and presets. Industry-standard glow, blur, and lighting effects.',
        notes: 'Essential for professional editors. S_Glow, S_Blur, S_Shake are staples.',
        links: [{ url: 'https://clicknupload.click/ndxiptqjlnl7/BorisFX.Sapphire.AE.2026.5.rar', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svbWE1M2NqZWoyYml6L0JvcmlzRlguTW9jaGEuUHJvLkFkb2JlLjIwMjYuNS4wLnJhcg', harmless: 58, malicious: 0 },
        id: makeId('BorisFX Mocha Pro AE 2026.5'),
        name: 'BorisFX Mocha Pro AE 2026.5',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'BorisFX Mocha Pro 2026.5 for Adobe — award-winning planar tracking, rotoscoping, and object removal.',
        notes: 'Industry standard for tracking and rotoscoping.',
        links: [{ url: 'https://clicknupload.click/ma53cjej2biz/BorisFX.Mocha.Pro.Adobe.2026.5.0.rar', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzLzRnODVtNDY0cw', harmless: 69, malicious: 0 },
        id: makeId('VideoCopilot Element 3D v2.2.2'),
        name: 'VideoCopilot Element 3D v2.2.2',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'VideoCopilot Element 3D v2.2.2 — advanced 3D object rendering and animation inside After Effects. Import OBJ/C4D models.',
        notes: 'One of the most popular AE plugins ever. 3D engine inside AE.',
        links: [{ url: 'https://depositfiles.com/files/4g85m464s', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL2Q5ODB5c3hlcA', harmless: 68, malicious: 0 },
        id: makeId('VideoCopilot Optical Flares Pro v1.3.5'),
        name: 'VideoCopilot Optical Flares Pro v1.3.5',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'VideoCopilot Optical Flares Pro v1.3.5 — realistic lens flare plugin with 3D occlusion, custom flare editor.',
        notes: 'The go-to lens flare plugin for AE.',
        links: [{ url: 'https://depositfiles.com/files/d980ysxep', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL3BtZGc3M216bA', harmless: 69, malicious: 0 },
        id: makeId('VideoCopilot Twitch v1.1'),
        name: 'VideoCopilot Twitch v1.1',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'VideoCopilot Twitch v1.1 — glitch and distortion effects plugin for AE. Create analog-style glitches.',
        links: [{ url: 'https://depositfiles.com/files/pmdg73mzl', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL3NxMnBjZTJtdQ', harmless: 60, malicious: 0 },
        id: makeId('VideoCopilot Heat Distortion v1.0.31'),
        name: 'VideoCopilot Heat Distortion v1.0.31',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'VideoCopilot Heat Distortion v1.0.31 — realistic heat haze and distortion effects for After Effects.',
        links: [{ url: 'https://depositfiles.com/files/sq2pce2mu', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9mdWNraW5nZmFzdC5uZXQvc2k5aTBpejFjNDl0', harmless: 67, malicious: 0 },
        id: makeId('Red Giant Universe 2026.0.1'),
        name: 'Red Giant Universe 2026.0.1',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Red Giant Universe 2026.0.1 — 80+ GPU-accelerated transitions, effects, and text tools. Now included in Maxon Red Giant.',
        notes: 'Universe transitions and glows are editor favorites.',
        links: [{ url: 'https://fuckingfast.net/si9i0iz1c49t', label: 'FuckingFast' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svZ3MzcnZmcWQ2aGMwL0RlaGFuY2VyLlByby5BZS5Qci52Ny40LjAucmFy', harmless: 59, malicious: 0 },
        id: makeId('Dehancer Pro Ae/Pr v7.4.0'),
        name: 'Dehancer Pro Ae/Pr v7.4.0',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Dehancer Pro v7.4.0 for AE & Premiere Pro — film emulation, grain, halation, bloom, and color grading tools.',
        notes: 'Excellent film emulation plugin.',
        links: [{ url: 'https://clicknupload.click/gs3rvfqd6hc0/Dehancer.Pro.Ae.Pr.v7.4.0.rar', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuc2l0ZS9uazVmYTVwNGx3Y20', harmless: 56, malicious: 0 },
        id: makeId('Neat Video Pro AE v6.0.0'),
        name: 'Neat Video Pro AE v6.0.0',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Neat Video Pro v6.0.0 for AE — best-in-class video noise reduction. Remove noise and grain while preserving detail.',
        notes: 'Best video denoiser on the market.',
        links: [{ url: 'https://clicknupload.site/nk5fa5p4lwcm', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svdmVrNzB0NzNmaTBiL1RvcGF6LlZpZGVvLlByby52MS42LjIucmFy', harmless: 57, malicious: 0 },
        id: makeId('Topaz Video Pro v1.6.2'),
        name: 'Topaz Video Pro v1.6.2',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Topaz Video Pro v1.6.2 — AI-powered video enhancement. Upscale, denoise, deinterlace, and restore video quality.',
        notes: 'AI upscaling up to 8K. Excellent for restoring old footage.',
        links: [{ url: 'https://clicknupload.click/vek70t73fi0b/Topaz.Video.Pro.v1.6.2.rar', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9rYXRmaWxlLmNvbS81ZmIxaGdvYzBoZTQvUkVWaXNpb25GWC5FZmZlY3Rpb25zLlBsdXMudjI1LjgucmFyLmh0bWw', harmless: 68, malicious: 1 },
        id: makeId('RE:VisionFX Effections Plus v25.08'),
        name: 'RE:VisionFX Effections Plus v25.08',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'RE:VisionFX Effections Plus v25.08 — includes Twixtor (slow motion), ReelSmart Motion Blur, DE:Noise, and more.',
        notes: 'Twixtor is the industry standard for slow-motion.',
        links: [{ url: 'https://katfile.com/5fb1hgoc0he4/REVisionFX.Effections.Plus.v25.8.rar.html', label: 'KatFile' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9yYXBpZGdhdG9yLm5ldC9maWxlLzg2MTI3NDEwODZhY2NlM2FhNzZlYzA2ZTMzZjRlY2U4L1Jvd2J5dGUuYnVuZGxlLnJhci5odG1s', harmless: 60, malicious: 0 },
        id: makeId('Rowbyte bundle v2025.8'),
        name: 'Rowbyte Bundle v2025.8',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Rowbyte plugin bundle v2025.8 — includes Plexus, Newton, and other creative AE plugins.',
        notes: 'Plexus is great for data visualization and particle effects.',
        links: [{ url: 'https://rapidgator.net/file/8612741086acce3aa76ec06e33f4ece8/Rowbyte.bundle.rar.html', label: 'RapidGator' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9yZy50by9maWxlLzM0OTMxMDQxMjAxN2U3MzhlNjMxNmI1ZDhhZTQ4OTJkL1BhaW50JlN0aWNrLnYyLjEuMi5DRS5yYXIuaHRtbA', harmless: 59, malicious: 0 },
        id: makeId('aescripts Paint & Stick v2.1.2'),
        name: 'aescripts Paint & Stick v2.1.2',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'aescripts Paint & Stick v2.1.2 — paint and track objects in After Effects with realistic results.',
        links: [{ url: 'https://rg.to/file/349310412017e738e6316b5d8ae4892d/Paint&Stick.v2.1.2.CE.rar.html', label: 'RapidGator' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL3M5NnpleWp0aQ', harmless: 70, malicious: 0 },
        id: makeId('DigiEffects Suite v3.0.2'),
        name: 'DigiEffects Suite v3.0.2',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'DigiEffects Suite v3.0.2 — collection of creative plugins including Damage, Delirium, and more.',
        links: [{ url: 'https://depositfiles.com/files/s96zeyjti', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2ZkL3Nxczhsank2ZjFmdg', harmless: 50, malicious: 10 },
        id: makeId('Digital Anarchy bundle 2025.5'),
        name: 'Digital Anarchy Bundle 2025.5',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Digital Anarchy bundle 2025.5 — includes Beauty Box, Flicker Free, and other video enhancement plugins.',
        notes: 'Flicker Free is excellent for removing flicker from timelapse and slow-motion.',
        links: [{ url: 'https://clicknupload.cfd/sqs8ljy6f1fv', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL24zZWpxNXEyeA', harmless: 69, malicious: 0 },
        id: makeId('FXhome Ignite Pro v4.0'),
        name: 'FXhome Ignite Pro v4.0',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'FXhome Ignite Pro v4.0 — 170+ VFX plugins for After Effects including glows, grading, and keying.',
        links: [{ url: 'https://depositfiles.com/files/n3ejq5q2x', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzLzRyODZzNGMyYg', harmless: 59, malicious: 0 },
        id: makeId('GraniteBay GBDeflicker v4.5.0'),
        name: 'GraniteBay GBDeflicker v4.5.0',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'GraniteBay GBDeflicker v4.5.0 — remove flicker from video footage. Essential for timelapse and slow-motion.',
        links: [{ url: 'https://depositfiles.com/files/4r86s4c2b', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL2Vvdm9zeGd6dA', harmless: 59, malicious: 0 },
        id: makeId('Motion Boutique Newton v3.0'),
        name: 'Motion Boutique Newton v3.0',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Motion Boutique Newton v3.0 — 2D physics simulator for After Effects.',
        links: [{ url: 'https://depositfiles.com/files/eovosxgzt', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuc3BhY2UvdjY0cGZkaHkxazA5', harmless: 60, malicious: 0 },
        id: makeId('proDAD Mercalli v6.0.671'),
        name: 'proDAD Mercalli v6.0.671',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'proDAD Mercalli v6.0.671 — professional video stabilization plugin.',
        links: [{ url: 'https://clicknupload.space/v64pfdhy1k09', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9rYXRmaWxlLmNvbS9heGxlM25taml0ODU', harmless: 68, malicious: 0 },
        id: makeId('Rubber Monkey FilmConvert Nitrate AE v3.47'),
        name: 'Rubber Monkey FilmConvert Nitrate AE v3.47',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Rubber Monkey FilmConvert Nitrate v3.47 — film grain and color grading emulation for AE.',
        links: [{ url: 'https://katfile.com/axle3nmjit85', label: 'KatFile' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL250Z3cwYWg3OA', harmless: 60, malicious: 0 },
        id: makeId('SuperLuminal StarDust v1.3.1'),
        name: 'SuperLuminal StarDust v1.3.1',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'SuperLuminal StarDust v1.3.1 — 3D particle system plugin for After Effects.',
        links: [{ url: 'https://depositfiles.com/files/ntgw0ah78', label: 'DepositFiles' }]
    },


    // ═══════════════════════════════════════════
    // MORE AE PLUGINS (from codec.kyiv.ua/ad0be.html)
    // ═══════════════════════════════════════════
    {
        vt_scan: { id: 'aHR0cHM6Ly9mdWNraW5nZmFzdC5uZXQvYTg3Z296bGF5YTJ3', harmless: 54, malicious: 4 },
        id: makeId('BorisFX Silhouette 2026.0.2'),
        name: 'BorisFX Silhouette 2026.0.2',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'BorisFX Silhouette 2026.0.2 — GPU-accelerated rotoscoping and paint tool. Industry standard for visual effects.',
        links: [{ url: 'https://fuckingfast.net/a87gozlaya2w', label: 'FuckingFast' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9mdWNraW5nZmFzdC5uZXQvdDNjZmVzMWhrODk2', harmless: 53, malicious: 4 },
        id: makeId('BorisFX SynthEyes Pro 2026.0.3'),
        name: 'BorisFX SynthEyes Pro 2026.0.3',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'BorisFX SynthEyes Pro 2026.0.3 — 3D camera tracking and match moving. Solve 3D cameras from video footage.',
        links: [{ url: 'https://fuckingfast.net/t3cfes1hk896', label: 'FuckingFast' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9yYXBpZGdhdG9yLm5ldC9maWxlLzkxNmI5OWYyMGM3YzlkMDVlNTdhZGM0NmM0ZmFlMmE2L0F1dG9jcm9tYS5idW5kbGUuMjAyNS43LnJhci5odG1s', harmless: 59, malicious: 0 },
        id: makeId('Autocroma bundle 2025.7'),
        name: 'Autocroma Bundle 2025.7',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Autocroma bundle 2025.7 — chromatic aberration and color fringe plugins.',
        links: [{ url: 'https://rapidgator.net/file/916b99f20c7c9d05e57adc46c4fae2a6/Autocroma.bundle.2025.7.rar.html', label: 'RapidGator' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2ZkLzlwM3k3MHFyd2x6OA', harmless: 49, malicious: 10 },
        id: makeId('BAO plugins bundle 2025.5'),
        name: 'BAO Plugins Bundle 2025.5',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'BAO plugins bundle 2025.5 — masking and rotoscoping plugins for AE.',
        links: [{ url: 'https://clicknupload.cfd/9p3y70qrwlz8', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9yZy50by9maWxlLzFmNDhkNjBhZWJmYWEzZTVmMzA5YmRjNzI4ZjNiYmVmL0NST1NTUEhFUkUucmFyLmh0bWw', harmless: 59, malicious: 0 },
        id: makeId('CROSSPHERE bundle 2025'),
        name: 'CROSSPHERE Bundle 2025',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'CROSSPHERE plugins bundle 2025 — creative effects and transitions.',
        links: [{ url: 'https://rg.to/file/1f48d60aebfaa3e5f309bdc728f3bbef/CROSSPHERE.rar.html', label: 'RapidGator' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svMjhuOWF4MzF2MDEwL0N5Y29yZUZYLmJ1bmRsZS52MS4zLjIucmFy', harmless: 58, malicious: 0 },
        id: makeId('CycoreFX bundle v1.3.2'),
        name: 'CycoreFX Bundle v1.3.2',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'CycoreFX bundle v1.3.2 — classic AE plugin collection.',
        links: [{ url: 'https://clicknupload.click/28n9ax31v010/CycoreFX.bundle.v1.3.2.rar', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL2gybXE0cXl3Yw', harmless: 59, malicious: 0 },
        id: makeId('DataClay Templater v2.8.4'),
        name: 'DataClay Templater v2.8.4',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'DataClay Templater v2.8.4 — batch rendering and data-driven automation for AE.',
        links: [{ url: 'https://depositfiles.com/files/h2mq4qywc', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzLzV3Y3JmNjBxMg', harmless: 60, malicious: 0 },
        id: makeId('DFT FilmStocks v3.0.2'),
        name: 'DFT FilmStocks v3.0.2',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'DFT FilmStocks v3.0.2 — film stock emulation plugins.',
        links: [{ url: 'https://depositfiles.com/files/5wcrf60q2', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL2wxdHZhdW9mYw', harmless: 59, malicious: 0 },
        id: makeId('DFT Rays v2.1'),
        name: 'DFT Rays v2.1',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'DFT Rays v2.1 — volumetric light ray effects.',
        links: [{ url: 'https://depositfiles.com/files/l1tvauofc', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svOXhsb2F0ZnlmaXd5L0ZhbmRldi5idW5kbGUucmFy', harmless: 57, malicious: 0 },
        id: makeId('FanDev bundle 2025'),
        name: 'FanDev Bundle 2025',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'FanDev bundle 2025 — community-developed AE plugins and scripts.',
        links: [{ url: 'https://clicknupload.click/9xloatfyfiwy/Fandev.bundle.rar', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuc3BhY2UvZndmMmt6c2RqNnhp', harmless: 59, malicious: 0 },
        id: makeId('Filmworkz Adobe DVO v1.0.1'),
        name: 'Filmworkz Adobe DVO v1.0.1',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Filmworkz Adobe DVO v1.0.1 — professional film restoration and enhancement.',
        links: [{ url: 'https://clicknupload.space/fwf2kzsdj6xi', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL3dvcWtlMjU3ZA', harmless: 59, malicious: 0 },
        id: makeId('Fixel Algorithms bundle v2.0.3'),
        name: 'Fixel Algorithms Bundle v2.0.3',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Fixel Algorithms bundle v2.0.3 — AI-powered image enhancement plugins.',
        links: [{ url: 'https://depositfiles.com/files/woqke257d', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly93d3cuZmlsZWZhY3RvcnkuY29tL2ZpbGUvNWg3ZzQ3YXFjNDJtL0ZyaXNjaGx1ZnQuY29tLnJhcg', harmless: 70, malicious: 1 },
        id: makeId('frischluft AEX bundle'),
        name: 'frischluft AEX Bundle',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'frischluft.com AEX bundle — Lenscare and depth of field plugins.',
        links: [{ url: 'https://www.filefactory.com/file/5h7g47aqc42m/Frischluft.com.rar', label: 'FileFactory' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzLzBjZHhsdXA5ZA', harmless: 60, malicious: 0 },
        id: makeId('GenArts Monsters GT v7.0.5'),
        name: 'GenArts Monsters GT v7.0.5',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'GenArts Monsters GT v7.0.5 — creative effects plugin collection.',
        links: [{ url: 'https://depositfiles.com/files/0cdxlup9d', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL241amNxYmlodA', harmless: 59, malicious: 0 },
        id: makeId('Imagenomic Video Plugin Suite'),
        name: 'Imagenomic Video Plugin Suite',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Imagenomic Video Plugin Suite build 1007 — Portraiture for video, skin smoothing.',
        links: [{ url: 'https://depositfiles.com/files/n5jcqbiht', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9yZy50by9maWxlLzM1ZWVlZDMxMDFkZWVlNjBiZmQyOGI1MzRmMjEwMDk2', harmless: 60, malicious: 0 },
        id: makeId('RE:VisionFX Color Genius Plus v25.11'),
        name: 'RE:VisionFX Color Genius Plus v25.11',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'RE:VisionFX Color Genius Plus v25.11 — color correction and grading tools.',
        links: [{ url: 'https://rg.to/file/35eeed3101deee60bfd28b534f210096', label: 'RapidGator' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9yZy50by9maWxlL2ZiZTMzYTNlNzg2YjFmODEwYTA0YjZiNTIzNTdhYTExL0dHLlBpeGVsU29ydGVyLnJhci5odG1s', harmless: 62, malicious: 0 },
        id: makeId('Pixel Sorter Studio bundle 2025.7'),
        name: 'Pixel Sorter Studio Bundle 2025.7',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Pixel Sorter Studio bundle 2025.7 — glitch and pixel sorting effects.',
        links: [{ url: 'https://rg.to/file/fbe33a3e786b1f810a04b6b52357aa11/GG.PixelSorter.rar.html', label: 'RapidGator' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9mdWNraW5nZmFzdC5uZXQvcXlnM2sydzQzMXAx', harmless: 54, malicious: 5 },
        id: makeId('ProductionCrate LaForge Suite v1.5.07'),
        name: 'ProductionCrate LaForge Suite v1.5.07',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'ProductionCrate LaForge Suite v1.5.07 — VFX and compositing plugins from ProductionCrate.',
        links: [{ url: 'https://fuckingfast.net/qyg3k2w431p1', label: 'FuckingFast' }]
    },    // ═══════════════════════════════════════════
    // PREMIERE PRO PLUGINS (from codec.kyiv.ua/ad0be.html)
    // ═══════════════════════════════════════════
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2ZkL2RwaGNyaDE0ejZ2aQ', harmless: 64, malicious: 2 },
        id: makeId('Neat Video Pro v6.0.5 for Premiere'),
        name: 'Neat Video Pro v6.0.5 (Premiere)',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Neat Video Pro v6.0.5 for Premiere Pro — professional video noise reduction plugin.',
        links: [{ url: 'https://clicknupload.cfd/dphcrh14z6vi', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuc2l0ZS9qd2R3ZWZvYWU5MXA', harmless: 56, malicious: 0 },
        id: makeId('NewBlue TotalFX 360 build 250207'),
        name: 'NewBlue TotalFX 360 (build 250207)',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'NewBlue TotalFX 360 — comprehensive plugin bundle with 1500+ presets, transitions, titles, and effects for Premiere Pro.',
        notes: 'Massive bundle. Includes Titler Pro, transitions, filters.',
        links: [{ url: 'https://clicknupload.site/jwdwefoae91p', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2ZkLzJkYTI3MGxpdjUyZA', harmless: 49, malicious: 10 },
        id: makeId('FilmImpact Premium Video Effects v25.2.5'),
        name: 'FilmImpact Premium Video Effects v25.2.5',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'FilmImpact Premium Video Effects v25.2.5 — professional transitions and effects for Premiere Pro.',
        links: [{ url: 'https://clicknupload.cfd/2da270liv52d', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svYjA1NDZibTY1cWJqL0NvbG91cmxhYi5Qcm8uVjMuNS4wLnJhcg', harmless: 68, malicious: 1 },
        id: makeId('Colourlab Ai Pro v3.5.0'),
        name: 'Colourlab Ai Pro v3.5.0',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Colourlab Ai Pro v3.5.0 — AI-powered color grading. Auto-match colors between shots with one click.',
        notes: 'Game-changer for color grading workflow.',
        links: [{ url: 'https://clicknupload.click/b0546bm65qbj/Colourlab.Pro.V3.5.0.rar', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQubmFtZS92aGZxYTd2NmN5dWY', harmless: 66, malicious: 0 },
        id: makeId('Red Giant PluralEyes 2023.0.0'),
        name: 'Red Giant PluralEyes 2023.0.0',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Red Giant PluralEyes 2023.0.0 — automatic audio/video sync tool. Sync multiple cameras and audio tracks instantly.',
        notes: 'Essential for multi-camera shoots.',
        links: [{ url: 'https://clicknupload.name/vhfqa7v6cyuf', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svbnVqc2ZidmNvNmlq', harmless: 59, malicious: 0 },
        id: makeId('Rubber Monkey CineMatch v1.24'),
        name: 'Rubber Monkey CineMatch v1.24',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Rubber Monkey CineMatch v1.24 — sensor-based color matching. Match any camera to any other camera.',
        links: [{ url: 'https://clicknupload.click/nujsfbvco6ij', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL2wzazl4NWtibw', harmless: 60, malicious: 0 },
        id: makeId('FanDev CuteDCP Pr v1.5.11'),
        name: 'FanDev CuteDCP Pr v1.5.11',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'FanDev CuteDCP v1.5.11 for Premiere — DCP (Digital Cinema Package) export plugin.',
        notes: 'Export DCP directly from Premiere Pro.',
        links: [{ url: 'https://depositfiles.com/files/l3k9x5kbo', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL2Nmd2ZqcDhiYQ', harmless: 60, malicious: 0 },
        id: makeId('Sorenson Squeeze Pro v11.1.0.9'),
        name: 'Sorenson Squeeze Pro v11.1.0.9',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Sorenson Squeeze Pro v11.1.0.9 — video encoding and compression tool with SendTo plugin for Premiere.',
        links: [{ url: 'https://depositfiles.com/files/cfwfjp8ba', label: 'DepositFiles' }]
    },

    // ═══════════════════════════════════════════
    // PHOTOSHOP PLUGINS (from codec.kyiv.ua/ad0be.html)
    // ═══════════════════════════════════════════
    {
        vt_scan: { id: 'aHR0cHM6Ly9mdWNraW5nZmFzdC5uZXQvMG1wbHh4cGNlZmJi', harmless: 53, malicious: 4 },
        id: makeId('BorisFX Optics 2026.0.3 for Photoshop'),
        name: 'BorisFX Optics 2026.0.3 (Photoshop)',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'BorisFX Optics 2026.0.3 for Photoshop — lens flares, filters, lighting effects, and color correction.',
        links: [{ url: 'https://fuckingfast.net/0mplxxpcefbb', label: 'FuckingFast' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svdmdpMmd6cms0anZxL0JvcmlzRlguU2FwcGhpcmUuUFMuMjAyNi41LnJhcg', harmless: 58, malicious: 0 },
        id: makeId('BorisFX Sapphire 2026.5 for Photoshop'),
        name: 'BorisFX Sapphire 2026.5 (Photoshop)',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'BorisFX Sapphire 2026.5 for Photoshop — 270+ VFX plugins for photo editing.',
        links: [{ url: 'https://clicknupload.click/vgi2gzrk4jvq/BorisFX.Sapphire.PS.2026.5.rar', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svZmVjYWdzenpiM3FhL0RlaGFuY2VyLkZpbG0uUHMuTHIudjIuOC4wLnJhcg', harmless: 58, malicious: 0 },
        id: makeId('Dehancer Film Ps/Lr v2.8.0'),
        name: 'Dehancer Film Ps/Lr v2.8.0',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Dehancer Film v2.8.0 for Photoshop & Lightroom — cinematic film emulation, grain, and halation.',
        links: [{ url: 'https://clicknupload.click/fecagszzb3qa/Dehancer.Film.Ps.Lr.v2.8.0.rar', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly93d3cuZmlsZWZhY3RvcnkuY29tL2ZpbGUvODdqZ3c1enB3NDQvQmVhdXR5LkJveC5QUy52NS4wLjYuQ0UucmFy', harmless: 58, malicious: 1 },
        id: makeId('Digital Anarchy Beauty Box PS v5.0.6'),
        name: 'Digital Anarchy Beauty Box PS v5.0.6',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Digital Anarchy Beauty Box v5.0.6 for Photoshop — professional skin retouching plugin.',
        links: [{ url: 'https://www.filefactory.com/file/87jgw5zpw44/Beauty.Box.PS.v5.0.6.CE.rar', label: 'FileFactory' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL3pxZTF3YmVkdg', harmless: 59, malicious: 0 },
        id: makeId('Imagenomic Portraiture v3.0.2.7'),
        name: 'Imagenomic Portraiture v3.0.2.7',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Imagenomic Portraiture v3.0.2.7 — intelligent skin smoothing, healing, and enhancing plugin for Photoshop.',
        notes: 'The gold standard for portrait retouching.',
        links: [{ url: 'https://depositfiles.com/files/zqe1wbedv', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svbDJtb3FhMmh3cDZ2L1RvcGF6LkdpZ2FwaXhlbC5Qcm8udjEuMy4wLnJhcg', harmless: 60, malicious: 0 },
        id: makeId('Topaz Gigapixel Pro v1.3.0'),
        name: 'Topaz Gigapixel Pro v1.3.0',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Topaz Gigapixel Pro v1.3.0 — AI image upscaling. Enlarge images up to 600% without quality loss.',
        links: [{ url: 'https://clicknupload.click/l2moqa2hwp6v/Topaz.Gigapixel.Pro.v1.3.0.rar', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2sveHR3bm9ramYycGhlL1RvcGF6LlBob3RvLlByby52MS42LjEucmFy', harmless: 57, malicious: 0 },
        id: makeId('Topaz Photo Pro v1.6.1'),
        name: 'Topaz Photo Pro v1.6.1',
        category: 'adobe-plugin', platform: 'win', password: null,
        desc: 'Topaz Photo Pro v1.6.1 — AI photo enhancement. Denoise, sharpen, and upscale images automatically.',
        links: [{ url: 'https://clicknupload.click/xtwnokjf2phe/Topaz.Photo.Pro.v1.6.1.rar', label: 'ClicknUpload' }]
    },

        {
        vt_scan: { id: 'aHR0cHM6Ly9kb3dubG9hZDIzOTAubWVkaWFmaXJlLmNvbS8xcmNyNXlwN2NnemdySWtqaXNHWFRGTUxiSTVKd3llbzdqeGN5MDFVSjA0YzFvR3dabVF3cTdBalg1akFranVVSW1POUxHMXhpbkhqMndYV05jOUhNQVhCYzZOcGI5ZmRZd1dmUW14bEhxamVfaXAwbmhUX25hLVVZVURBWWJXNUVoUTNZcXphcmdKVzk1ZTY2T3UxSnozSjluY0MxdEViQ0dQNjc2Mi1WN3MvZ3l1cms5NmV5dWNiN25rL1RvcGF6K1ZpZGVvK0FJKzMuMy4xMCslMjhXaW4lMjkucmFy', harmless: 58, malicious: 0 },

            id: makeId('Topaz Video AI 3.3.10 (Recommended)'),
        name: 'Topaz Video AI 3.3.10 (Recommended)',
        category: 'software', platform: 'win', password: 'Editing',
        desc: 'I recommend this version of Topaz Video AI. cuz It works good. 😊',
        links: [{ url: 'https://download2390.mediafire.com/1rcr5yp7cgzgrIkjisGXTFMLbI5Jwyeo7jxcy01UJ04c1oGwZmQwq7AjX5jAkjuUImO9LG1xinHj2wXWNc9HMAXBc6Npb9fdYwWfQmxlHqje_ip0nhT_na-UYUDAYbW5EhQ3YqzargJW95e66Ou1Jz3J9ncC1tEbCGP6762-V7s/gyurk96eyucb7nk/Topaz+Video+AI+3.3.10+%28Win%29.rar', label: 'Mediafire' }]
    },

    // ═══════════════════════════════════════════
    // AVID SOFTWARE & PLUGINS (from codec.kyiv.ua/avid.html)
    // ═══════════════════════════════════════════
    {
        vt_scan: { id: 'aHR0cHM6Ly9mdWNraW5nZmFzdC5uZXQvYWNraWZyMTBhOGEw', harmless: 53, malicious: 4 },
        id: makeId('Avid Media Composer v25.6 Windows'),
        name: 'Avid Media Composer v25.6 (Windows)',
        category: 'software', platform: 'win', password: null,
        desc: 'Avid Media Composer v25.6 for Windows 64-bit — professional video editing software used in Hollywood productions.',
        links: [{ url: 'https://fuckingfast.net/ackifr10a8a0', label: 'FuckingFast' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9kZXBvc2l0ZmlsZXMuY29tL2ZpbGVzL3ZoZ2R1bnhrbA', harmless: 78, malicious: 0 },
        id: makeId('Avid Media Composer v8.4.5 Mac'),
        name: 'Avid Media Composer v8.4.5 (Mac)',
        category: 'software', platform: 'mac', password: null,
        desc: 'Avid Media Composer v8.4.5 for Mac OSX — professional NLE for macOS.',
        links: [{ url: 'https://depositfiles.com/files/vhgdunxkl', label: 'DepositFiles' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9mdWNraW5nZmFzdC5uZXQvc3NuZW91bnl2YnNl', harmless: 54, malicious: 4 },
        id: makeId('BorisFX Continuum AVX 2026.5'),
        name: 'BorisFX Continuum AVX 2026.5',
        category: 'avx', platform: 'win', password: null,
        desc: 'BorisFX Continuum AVX 2026.5 v19.5.4 — comprehensive VFX plugins for Avid Media Composer.',
        links: [{ url: 'https://fuckingfast.net/ssneounyvbse', label: 'FuckingFast' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svN3ZsMmxrN2VwejhlL0JvcmlzRlguU2FwcGhpcmUuQVZYLnYyMDI2LjUucmFy', harmless: 58, malicious: 0 },
        id: makeId('BorisFX Sapphire AVX 2026.5'),
        name: 'BorisFX Sapphire AVX 2026.5',
        category: 'avx', platform: 'win', password: null,
        desc: 'BorisFX Sapphire AVX 2026.5 — 270+ effects and presets for Avid Media Composer.',
        links: [{ url: 'https://clicknupload.click/7vl2lk7epz8e/BorisFX.Sapphire.AVX.v2026.5.rar', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuY2xpY2svdXoxNmpyMjhpZ2FsL0JvcmlzRlguTW9jaGEuUHJvLjIwMjYuNS4wLkFWWC5yYXI', harmless: 58, malicious: 0 },
        id: makeId('BorisFX Mocha Pro AVX 2026.5'),
        name: 'BorisFX Mocha Pro AVX 2026.5',
        category: 'avx', platform: 'win', password: null,
        desc: 'BorisFX Mocha Pro AVX 2026.5 — planar tracking and rotoscoping for Avid.',
        links: [{ url: 'https://clicknupload.click/uz16jr28igal/BorisFX.Mocha.Pro.2026.5.0.AVX.rar', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQuc2l0ZS84NW54Zmg2b3dqd2I', harmless: 56, malicious: 0 },
        id: makeId('NeatVideo AVX v4.1.1'),
        name: 'NeatVideo AVX v4.1.1',
        category: 'avx', platform: 'win', password: null,
        desc: 'NeatVideo AVX v4.1.1 — noise reduction plugin for Avid Media Composer.',
        links: [{ url: 'https://clicknupload.site/85nxfh6owjwb', label: 'ClicknUpload' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9jbGlja251cGxvYWQubmFtZS92aGNrbW94Z3B6Mnc', harmless: 57, malicious: 0 },
        id: makeId('FilmLight BaseLight for Avid v6.0'),
        name: 'FilmLight BaseLight for Avid v6.0',
        category: 'others', platform: 'win', password: null,
        desc: 'FilmLight BaseLight for Avid v6.0.21185 — professional color grading plugin for Avid.',
        links: [{ url: 'https://clicknupload.name/vhckmoxgpz2w', label: 'ClicknUpload' }]
    },

    // ═══════════════════════════════════════════
    // MAC APPS (from macked.app & audioz)
    // ═══════════════════════════════════════════
    {
        vt_scan: { id: 'aHR0cHM6Ly9tYWNrZWQuYXBwL2Fkb2JlLWFjdGl2YXRpb24tdG9vbC1jcmFjay5odG1s', harmless: 67, malicious: 0 },
        id: makeId('Adobe Activation Tool Mac'),
        name: 'Adobe Activation Tool 1.2.7/2.1.5 (Mac)',
        category: 'software', platform: 'mac', password: null,
        desc: 'Adobe Suite Activation Tools/Crack Patches for macOS. Activate Adobe CC apps on Mac.',
        links: [{ url: 'https://macked.app/adobe-activation-tool-crack.html', label: 'MacKed' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9tYWNrZWQuYXBwL3NldGFwcC1tYWMtY3JhY2suaHRtbA', harmless: 66, malicious: 1 },
        id: makeId('Setapp 3.53.2 Mac'),
        name: 'Setapp 3.53.2 (Mac)',
        category: 'software', platform: 'mac', password: null,
        desc: 'Setapp 3.53.2 Cracked — third-party macOS app store with 240+ premium apps.',
        notes: 'Subscription-free access to premium Mac apps.',
        links: [{ url: 'https://macked.app/setapp-mac-crack.html', label: 'MacKed' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9hdWRpb3ouZG93bmxvYWQvc29mdHdhcmUvMjk3MTEwLWRvd25sb2FkX3BhcmFsbGVscy1kZXNrdG9wLWJ1c2luZXNzLWVkaXRpb24tMjY0MDU3NTEzLW1hY29zLWF0Yi5odG1s', harmless: 0, malicious: 0 },
        id: makeId('Parallels Desktop Business Edition 26.4 Mac'),
        name: 'Parallels Desktop 26.4 Business (Mac)',
        category: 'software', platform: 'mac', password: null,
        desc: 'Parallels Desktop Business Edition 26.4.0.57513 macOS — run Windows on Mac seamlessly. Intel + Apple Silicon support.',
        links: [{ url: 'https://audioz.download/software/297110-download_parallels-desktop-business-edition-264057513-macos-atb.html', label: 'AudioZ' }]
    },

    // ═══════════════════════════════════════════
    // VIDEO SOFTWARE & UTILITIES
    // ═══════════════════════════════════════════
    {
        vt_scan: { id: 'aHR0cHM6Ly9hdWRpb3ouZG93bmxvYWQvc29mdHdhcmUvd2luLzI5NzE1Ni1kb3dubG9hZF9jeWJlcmxpbmstcG93ZXJkaXJlY3Rvci11bHRpbWF0ZS0yMDI2LXYyNDYxODI0Mi5odG1s', harmless: 55, malicious: 4 },
        id: makeId('CyberLink PowerDirector Ultimate 2026'),
        name: 'CyberLink PowerDirector Ultimate 2026',
        category: 'software', platform: 'win', password: null,
        desc: 'CyberLink PowerDirector Ultimate 2026 v24.6.1824.2 — award-winning video editing software for professional creators.',
        links: [{ url: 'https://audioz.download/software/win/297156-download_cyberlink-powerdirector-ultimate-2026-v24618242.html', label: 'AudioZ' }]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9hdWRpb3ouZG93bmxvYWQvc29mdHdhcmUvd2luLzI5NzE2Ni1kb3dubG9hZF92aXJ0dWFsLWF1ZGlvLWNhYmxlLXY0NzEuaHRtbA', harmless: 54, malicious: 4 },
        id: makeId('Virtual Audio Cable v4.71'),
        name: 'Virtual Audio Cable v4.71',
        category: 'software', platform: 'win', password: null,
        desc: 'Virtual Audio Cable v4.71 — transfer audio streams between applications. Create virtual audio devices.',
        notes: 'Useful for routing audio between apps.',
        links: [{ url: 'https://audioz.download/software/win/297166-download_virtual-audio-cable-v471.html', label: 'AudioZ' }]
    },

    // ═══════════════════════════════════════════
    // OFX PLUGINS
    // ═══════════════════════════════════════════
    {
        vt_scan: { id: 'aHR0cHM6Ly9waXhlbGRyYWluLmNvbS91L3h3dGJTdGJ0', harmless: 61, malicious: 0 },
        id: makeId('Continuum 2026 OFX'),
        name: 'BorisFX Continuum 2026 OFX',
        category: 'ofx-plugin',
        platform: 'win',
        password: null,
        desc: 'BorisFX Continuum 2026 OFX v19.0.0 for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/xwtbStbt', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/3IaiOT', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/32npiq3z89zmvh4/BorisFX_Continuum_2026_OFX_v19.0.0_win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9waXhlbGRyYWluLmNvbS91L2tCVWY2dHh0', harmless: 65, malicious: 0 },
        id: makeId('Sapphire 2026 OFX'),
        name: 'BorisFX Sapphire 2026 OFX',
        category: 'ofx-plugin',
        platform: 'win',
        password: null,
        desc: 'BorisFX Sapphire 2026 OFX for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/kBUf6txt', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/oUPHHu', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/01vm0agltgnwe0y/Sapphire_OFX_2026_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9waXhlbGRyYWluLmNvbS91L01vRktoV1hF', harmless: 65, malicious: 0 },
        id: makeId('Twixtor 8.1.0 OFX'),
        name: 'Twixtor 8.1.0 OFX',
        category: 'ofx-plugin',
        platform: 'win',
        password: null,
        desc: 'RE:VisionFX Twixtor v8.1.0 OFX for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/MoFKhWXE', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/Uku6ac', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/ydz6rvid4su4rj6/Twixtor_v8.1.0_OFX_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9waXhlbGRyYWluLmNvbS91L3NVN3dxNnRI', harmless: 65, malicious: 0 },
        id: makeId('RSMB 6.6.0 OFX'),
        name: 'RSMB 6.6.0 OFX',
        category: 'ofx-plugin',
        platform: 'win',
        password: null,
        desc: 'RE:VisionFX RSMB v6.6.0 OFX - Motion Blur for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/sU7wq6tH', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/eWhvmj', label: 'GoFile' }
        ]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9waXhlbGRyYWluLmNvbS91LzR6TXRHcERH', harmless: 64, malicious: 0 },
        id: makeId('REVisionFX Bundle 25.08 OFX'),
        name: 'RE:VisionFX Bundle 25.08 OFX',
        category: 'ofx-plugin',
        platform: 'win',
        password: null,
        desc: 'RE:VisionFX Effects Bundle v25.08 OFX for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/4zMtGpDG', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/Z7SJki', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/hkms9jglcj8o9r4/RE-VisionFX.Effections.OFX.v25.08_win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9waXhlbGRyYWluLmNvbS91L3JKdDg1NjR3', harmless: 60, malicious: 0 },
        id: makeId('Dehancer Pro 7.3.1 OFX'),
        name: 'Dehancer Pro 7.3.1 OFX',
        category: 'ofx-plugin',
        platform: 'win',
        password: null,
        desc: 'Dehancer Pro OFX v7.3.1 for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/rJt8564w', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/VgijJJ', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/ni6o0s1m3eb562i/Dehancer_Pro_OFX_7.3.1_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        vt_scan: { id: 'aHR0cHM6Ly9waXhlbGRyYWluLmNvbS91Lzl1Z2o4SmZ0', harmless: 60, malicious: 0 },
        id: makeId('Bullet Time 1.1 OFX'),
        name: 'Bullet Time 1.1 OFX',
        category: 'ofx-plugin',
        platform: 'win',
        password: null,
        desc: 'Bullet Time 1.1.14 OFX for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/9ugj8Jft', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/g7oBJU', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/s1g8e6zktwtkqt0/BulletTime1.1.14_OFX_Win_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('FilmConvert Nitrate OFX'),
        name: 'FilmConvert Nitrate Pro 2.20 OFX (VEGAS)',
        category: 'ofx-plugin',
        platform: 'win',
        password: null,
        desc: 'FilmConvert Nitrate Pro 2.20 OFX for VEGAS Pro only.',
        notes: 'Discontinued version, only version supporting VEGAS Pro.',
        links: [
            { url: 'https://pixeldrain.com/u/FzbhQ29c', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/ROPafq', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/mieqgz1qzwrkxy8/FilmConvert.OFX.v2.20.CE_Win_VEGAS_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    }
];

// Post-process for compatibility
window.pluginsData = window.pluginsData.map(p => {
    if (p.platform) p.platform = p.platform.toLowerCase();
    if (!p.downloadUrl && p.links && p.links.length > 0) {
        p.downloadUrl = p.links[0].url;
    }
    if (!p.desc && p.description) p.desc = p.description;
    return p;
});

console.log('📦 Zyrex Plugins loaded: ' + window.pluginsData.length + ' entries');
