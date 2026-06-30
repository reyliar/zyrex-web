/* ===================== COMPLETE RESOURCES DATA ===================== */
const PASSWORD = '';  // No ZIP password for presets

function makeId(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .replace(/--+/g, '-');
}

const resourcesData = [
    // ═══════════════════════════════════════════
    // SOFTWARE - WINDOWS
    // ═══════════════════════════════════════════
    {
        id: makeId('After Effects 2026.0'),
        name: 'After Effects 2026.0',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe After Effects 2026.0 full installer for Windows.',
        notes: 'Use a VPN to bypass Pixeldrain transfer limit.',
        links: [
            { url: 'https://pixeldrain.com/u/UtdWrXrr', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/QiYZ9s', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/d8gr3jf5xow0f1b/After_Effects_2026_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('After Effects 2025.6'),
        name: 'After Effects 2025.6',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe After Effects 2025.6 full installer for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/twZB4iTm', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/WoJwUu', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/vvtdsi96uuzrwhw/Adobe_After_Effects_2025.6_WIN_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('After Effects 2024.5'),
        name: 'After Effects 2024.5',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe After Effects 2024.5 full installer for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/rJDt2Fzr', label: 'Pixeldrain' }
        ]
    },
    {
        id: makeId('Premiere Pro 2026'),
        name: 'Premiere Pro 2026',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Premiere Pro 2026 full installer for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/Gb78gPNE', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/ZHoK4E', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/sl5o2ggrblgkeup/Premiere_Pro_2026_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Premiere Pro 2025.5'),
        name: 'Premiere Pro 2025.5',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Premiere Pro 2025.5 full installer for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/dV633qWx', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/lgjNuL', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/ird28gnna2yaush/Premiere.Pro.2025.5_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Premiere Pro 2024.0'),
        name: 'Premiere Pro 2024.0',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Premiere Pro 2024.0 full installer for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/rQynW7a1', label: 'Pixeldrain' }
        ]
    },
    {
        id: makeId('Media Encoder 2026.0'),
        name: 'Media Encoder 2026.0',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Media Encoder 2026.0 for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/8tSnCi3Q', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/KdgyhI', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/oc0p0kc7bcv3jko/Media_Encoder_2026_Win_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Media Encoder 2025.6'),
        name: 'Media Encoder 2025.6',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Media Encoder 2025.6 for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/eMvbY8bn', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/a2ty1b', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/1vdz37eji47hsw3/Media.Encoder.2025.6_WIN_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Media Encoder 2024.5'),
        name: 'Media Encoder 2024.5',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Media Encoder 2024.5 for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/zZGskAC2', label: 'Pixeldrain' }
        ]
    },
    {
        id: makeId('Photoshop 2026 v27.0'),
        name: 'Photoshop 2026 (v27.0)',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Photoshop 2026 v27.0 for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/phiG7Mgi', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/JsV4os', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/u1kx9092stsrbup/Photoshop.2026_%28v27.0%29_WIN_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Photoshop 2025 26.11'),
        name: 'Photoshop 2025 (26.11)',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Photoshop 2025 v26.11 for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/ZeYxQfv7', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/jP3UPU', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/o52rxal2mmemev0/Photoshop.2025_%2826.11%29_WIN_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Illustrator 2026 30.1'),
        name: 'Illustrator 2026 (30.1)',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Illustrator 2026 v30.1 for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/8nFDMFH7', label: 'Pixeldrain' }
        ]
    },
    {
        id: makeId('Audition 2025.3'),
        name: 'Audition 2025.3',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Audition 2025.3 for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/ugKPR17g', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/l3zaWa', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/9b69n3wjg0d522s/Adobe_Audition_2025.3_WIN_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Animate 24.0.12'),
        name: 'Animate 2024 (24.0.12)',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Animate 2024.0.12 for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/2cPkycEa', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/RGPI5t', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/qatz4usrjls1hck/Adobe_Animate_2024.0.12_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('DaVinci Resolve Studio 20 Patcher'),
        name: 'DaVinci Resolve Studio 20 (Patcher)',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Blackmagic DaVinci Resolve Studio 20.X Patcher for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/YnoEb6YJ', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/taeGSl', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/yl807ieicadd459/Davinci_Resolve_Patcher_WIN_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Vegas Pro 23.0.0.278'),
        name: 'Vegas Pro 23.0.0.278',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'MAGIX Vegas Pro v23.0.0.278 with Emulator-R2R.',
        links: [
            { url: 'https://pixeldrain.com/u/RUGRd3V5', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/tNf0XL', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/1uiiqwf79cyp34l/MAGIX.VEGAS.Pro.v23.0.0.278.Incl.Emulator-R2R_WIN_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Vegas Pro Deep Learning 23.1.0.1'),
        name: 'Vegas Pro Deep Learning 23.1.0.1',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'MAGIX Vegas Pro Deep Learning model v23.1.0.1.',
        links: [
            { url: 'https://pixeldrain.com/u/NxYo5uS9', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/3QXp1O', label: 'GoFile' }
        ]
    },
    {
        id: makeId('Cinema 4D 2026.0'),
        name: 'Cinema 4D 2026.0',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Maxon Cinema 4D 2026.0 for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/yCTeaiZb', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/qMTdTy', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/5kvhw6foilzeu7g/Cinema_4D_2026.0_win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('FL Studio 25.1.6'),
        name: 'FL Studio 25.1.6',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'FL Studio v25.1.6 Build 4997 Rev1.',
        links: [
            { url: 'https://pixeldrain.com/u/SruvC3je', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/AZJ0nB', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/xwtt5zt35rnxeps/FL_Studio_v25.1.6_Build_4997_Rev1_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Serum 2.0.20'),
        name: 'Serum 2.0.20',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Xfer Records Serum v2.0.20 Synthesizer.',
        links: [
            { url: 'https://pixeldrain.com/u/67jHvDFi', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/G45dLz', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/xea1a2c5wm5oavj/Xfer.Records.Serum_v2.0.20_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Topaz Video Activator'),
        name: 'Topaz Video Activator',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Topaz Video AI Activator for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/82SR9mD4', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/bUEqsf', label: 'GoFile' }
        ]
    },
    {
        id: makeId('Topaz Photo Activator v2'),
        name: 'Topaz Photo Activator v2',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Topaz Photo AI Activator v2 for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/V17gKnNo', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/mxM6Dv', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file/3m2slwe7gm4t88w/Topaz+Photo+Activator+v2+(win)+-+satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Topaz Gigapixel Activator'),
        name: 'Topaz Gigapixel Activator',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Topaz Gigapixel AI Activator for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/9q31KStN', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/4VZVz7', label: 'GoFile' }
        ]
    },
    {
        id: makeId('Marvelous Designer 2025.2.81'),
        name: 'Marvelous Designer Enterprise 2025.2.81',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Marvelous Designer Enterprise v2025.2.81.',
        links: [
            { url: 'https://pixeldrain.com/u/6ALNHXFB', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/qlbaIZ', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/gjjr5jyta4yhb8a/Marvelous_Designer_Enterprise_v2025.2.81_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('TouchDesigner Pro 2023'),
        name: 'TouchDesigner Pro 2023.12230',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'TouchDesigner Pro 2023.12230 for Windows.',
        links: [
            { url: 'https://pixeldrain.com/u/r8nW4cxx', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/RMPedp', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/bhs3ami4uqjxj9e/TouchDesigner_Pro_2023.12230_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Substance 3D Painter 11.1.2'),
        name: 'Substance 3D Painter 11.1.2',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Substance 3D Painter v11.1.2.',
        links: [
            { url: 'https://pixeldrain.com/u/kGP44cLy', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/DgVY26', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/y32cqto1107zwlj/Substance_3D_Painter_11.1.2_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Substance 3D Designer 15.1.2'),
        name: 'Substance 3D Designer 15.1.2',
        category: 'software',
        platform: 'win',
        password: PASSWORD,
        desc: 'Adobe Substance 3D Designer v15.1.2.',
        links: [
            { url: 'https://pixeldrain.com/u/xHJdTg2J', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/YBg0IG', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/xpvq5mrdzqmu9b1/Substance_3D_Designer_15.1.2_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },

    // ═══════════════════════════════════════════
    // SOFTWARE - MAC
    // ═══════════════════════════════════════════
    {
        id: makeId('AE 2026.0 Mac'),
        name: 'After Effects 2026.0 (M1+)',
        category: 'software',
        platform: 'mac',
        password: PASSWORD,
        desc: 'Adobe After Effects 2026.0 for Mac (M1+ only).',
        links: [
            { url: 'https://pixeldrain.com/u/QEdNp8VW', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/FX53aC', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/b1bebqg7eou8mk6/After_Effects_26.0_Mac_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('AE 2025.6 Mac'),
        name: 'After Effects 2025.6 (M1+)',
        category: 'software',
        platform: 'mac',
        password: PASSWORD,
        desc: 'Adobe After Effects 2025.6 for Mac (M1+ only).',
        links: [
            { url: 'https://pixeldrain.com/u/nxqSEJm2', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/Roj7mG', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/uehha34jv5998r9/After_Effects_2025.6_Mac_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Premiere Pro 2026 Mac'),
        name: 'Premiere Pro 2026.0 (M1+)',
        category: 'software',
        platform: 'mac',
        password: PASSWORD,
        desc: 'Adobe Premiere Pro 2026.0 for Mac (M1+ only).',
        links: [
            { url: 'https://pixeldrain.com/u/nMRpRMJ6', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/OeN8SR', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/kdelpozd3wcvpoh/Premiere_Pro_26.0_Mac_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Premiere Pro 2025.5 Mac'),
        name: 'Premiere Pro 2025.5 (M1+)',
        category: 'software',
        platform: 'mac',
        password: PASSWORD,
        desc: 'Adobe Premiere Pro 2025.5 for Mac (M1+ only).',
        links: [
            { url: 'https://pixeldrain.com/u/BULKmAMU', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/LshUGD', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/56gj933suh68b12/Premiere_Pro_2025.5_MacOS_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Media Encoder 2026 Mac'),
        name: 'Media Encoder 2026.0 (M1+)',
        category: 'software',
        platform: 'mac',
        password: PASSWORD,
        desc: 'Adobe Media Encoder 2026.0 for Mac (M1+ only).',
        links: [
            { url: 'https://pixeldrain.com/u/oaLpr4TK', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/VGIETT', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/f536hvd6fwcqi4w/Media_Encoder_26.0_Mac_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Photoshop 2026 Mac'),
        name: 'Photoshop 2026 v27.3 (M1+)',
        category: 'software',
        platform: 'mac',
        password: PASSWORD,
        desc: 'Adobe Photoshop 2026 v27.3 for Mac (M1+ only).',
        links: [
            { url: 'https://pixeldrain.com/u/mgTVLGt8', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/F4bJHv', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/vjhdj1k2bcq18yf/Photoshop_2026_%2827.3%29_Mac_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Illustrator 2026 Mac'),
        name: 'Illustrator 2026 v30.1 (M1+)',
        category: 'software',
        platform: 'mac',
        password: PASSWORD,
        desc: 'Adobe Illustrator 2026 v30.1 for Mac (M1+ only).',
        links: [
            { url: 'https://pixeldrain.com/u/soJ5fu54', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/6LopvU', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/yv4c965kw33cvk5/Illustrator_30.1_Mac_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('DaVinci Resolve Mac'),
        name: 'DaVinci Resolve Studio 20.3.1',
        category: 'software',
        platform: 'mac',
        password: PASSWORD,
        desc: 'DaVinci Resolve Studio v20.3.1 for Mac.',
        links: [
            { url: 'https://pixeldrain.com/u/xZk8cMgM', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/TpIaX3', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/eq7jr9frh8n7yf1/DaVinci_Resolve_Studio_v20.3.1_Mac_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Cinema 4D Mac'),
        name: 'Cinema 4D 2024 (Mac)',
        category: 'software',
        platform: 'mac',
        password: PASSWORD,
        desc: 'Maxon Cinema 4D 2024.2 for Mac.',
        links: [
            { url: 'https://pixeldrain.com/u/4CGXwVDz', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/T4kBKa', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/87ymxa6j7hcapaq/C4D_2024.2_Mac_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Topaz Video Patch Mac'),
        name: 'Topaz Video Patch (Mac)',
        category: 'software',
        platform: 'mac',
        password: PASSWORD,
        desc: 'Topaz Video AI Patch for Mac.',
        links: [
            { url: 'https://pixeldrain.com/u/cUzwusXu', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/6ZX5aA', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/vcla59xj8xb9otj/Topaz_Video_Patch_Mac_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('TouchDesigner Mac'),
        name: 'TouchDesigner 2023 (ARM)',
        category: 'software',
        platform: 'mac',
        password: PASSWORD,
        desc: 'TouchDesigner 2023.12230 for Mac (M1+ only).',
        links: [
            { url: 'https://pixeldrain.com/u/u3s2ZAfN', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/Pxzpxv', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/znk8clyc6aa14t0/TouchDesigner_2023.12230_%28ARM%29_MacOS_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },

    // ═══════════════════════════════════════════
    // ADOBE PLUGINS - WINDOWS
    // ═══════════════════════════════════════════
    {
        id: makeId('Continuum 2026 Adobe'),
        name: 'BorisFX Continuum 2026.0.1 (Adobe)',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'BorisFX Continuum 2026 Adobe v19.0.1. For After Effects & Premiere Pro.',
        links: [
            { url: 'https://pixeldrain.com/u/ctrKmQ9n', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/Pt51Hg', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/br2e5e5m0z0390t/Continuum_2026.Adobe_.v19.0.1_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Sapphire 2026 AE'),
        name: 'BorisFX Sapphire 2026.0 (AE)',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'BorisFX Sapphire 2026.0 for After Effects.',
        links: [
            { url: 'https://pixeldrain.com/u/YktPR5iW', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/vrzRJ3', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/3n0rjz0i6cwq95m/BorisFX_Sapphire_AE_WIN_2026.0_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Red Giant 2026 Win'),
        name: 'Red Giant 2026.3.0',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Maxon Red Giant Bundle 2026.3. Includes: Magic Bullet Suite, Trapcode Suite, VFX Suite, Universe.',
        links: [
            { url: 'https://pixeldrain.com/u/M2uczDR2', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/yY4QdY', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/zfqjr8vo2n2kuq1/RedGiant.v2026.3.0_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Twixtor 8.1.0'),
        name: 'Twixtor 8.1.0',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'RE:VisionFX Twixtor v8.1.0. High-quality optical flow slow motion.',
        links: [
            { url: 'https://pixeldrain.com/u/RpSfvLyt', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/ARWbpD', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/xbw9cl25c8q2jgu/Twixtor_v8.1.0_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('REVisionFX Bundle 25.08'),
        name: 'RE:VisionFX Bundle 25.08',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'RE:VisionFX Effects Plus Bundle v25.08. Includes Twixtor, RSMB, ReelSmart & more.',
        notes: 'Full list: https://pastebin.com/f8xnCgVi',
        links: [
            { url: 'https://pixeldrain.com/u/mBa5hf3Z', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/tusFGY', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/zwh5xd3vv65dc5l/REVisionFX.Effections.Plus.v25.08_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('REVisionFX Bundle 23.08'),
        name: 'RE:VisionFX Bundle 23.08',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'RE:VisionFX Bundle v23.08. Includes RSMB 6.4.1 & Twixtor 7.5.5 + Pro versions.',
        notes: 'Full list: https://pastebin.com/xxRuWiPH',
        links: [
            { url: 'https://pixeldrain.com/u/Qx2DQgjp', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/Q303TO', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/cwjkwug5091kkyb/REVisionFX_bundle_23.08_WIN_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Element 3D 2.2.3'),
        name: 'Element 3D 2.2.3',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Video Copilot Element 3D v2.2.3. 3D object rendering for After Effects.',
        links: [
            { url: 'https://pixeldrain.com/u/BYY7Uu51', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/0YnuAK', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/qydyc7ppeyx71yw/Element_3D_2.2.3_Win_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Heat Distortion 1.0.31'),
        name: 'Heat Distortion 1.0.31',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Video Copilot Heat Distortion v1.0.31.',
        links: [
            { url: 'https://pixeldrain.com/u/hspsVoSx', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/cjddGy', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/lmllpwc8uvxu1fw/HeatDistortion_Win_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Pro Shaders 1'),
        name: 'Pro Shaders 1',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Video Copilot Pro Shaders 1 for After Effects.',
        links: [
            { url: 'https://pixeldrain.com/u/xz1weY4M', label: 'Pixeldrain' }
        ]
    },
    {
        id: makeId('AutoKroma Bundle 2025.7'),
        name: 'AutoKroma Bundle 2025.7',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'AutoKroma Bundle: AfterCodecs 1.20.0, BRAW Studio 3.3.8, PlumePack 2.4.6, Influx Premium 1.5.7.',
        links: [
            { url: 'https://pixeldrain.com/u/eQt5AeH1', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/oSKpsJ', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/jmrm7vs37rwb4m1/Autokroma.bundle.2025.7_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('AfterCodecs 1.12.1'),
        name: 'AfterCodecs 1.12.1',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'AutoKroma AfterCodecs v1.12.1. 2026 compatible.',
        links: [
            { url: 'https://pixeldrain.com/u/8UqNKBs9', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/e7wMU5', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/fyndesgemimx8di/AfterCodecs_v1.12.1_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Influx 1.6.1'),
        name: 'Influx 1.6.1',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'AutoKroma Influx v1.6.1. 2026 compatible.',
        links: [
            { url: 'https://pixeldrain.com/u/C3me7Qv8', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/LfXF4X', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file/ol6inkihlh9tx60/Influx+v1.6.1+Win+-+satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Pixel Sorter Studio Bundle'),
        name: 'Pixel Sorter Studio Bundle',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Pixel Sorter, PixelGalactic, MotionMosh, Glasswork, BallPoint & more.',
        notes: 'Includes: Pixel Sorter 3.1.0 & 2.2, PixelGalactic, MotionMosh, MadPainter, HydroChrome, Glasswork, BallPoint.',
        links: [
            { url: 'https://pixeldrain.com/u/DWoNBJoW', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/ofvsmt', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/qlefud4imoo616i/Pixel_Sorter_Studio_Bundle_%28WIN%29.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Crossphere Bundle'),
        name: 'Crossphere Plugins Bundle',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Crossphere Bundle: Bokeh, Fractal Noise 3D, PixelBlend Accelerator, Power Cylinder, Power Sphere & more.',
        links: [
            { url: 'https://pixeldrain.com/u/oM56wZ1i', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/OYon9D', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/iwzblselvjlw6tl/Crossphere_Plugins_Bundle_WIN_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Mettle Bundle 2024.2'),
        name: 'Mettle Plugins Bundle 2024.2',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Mettle Bundle: Flux v1.16, FreeForm Pro 2024, Mantra v2.25, ShapeShifter 2024.',
        links: [
            { url: 'https://pixeldrain.com/u/B97G1tRM', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/Xr9YO3', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/i0eb42d9m4x3ern/Mettle_Plugins_bundle_WIN_2024.2_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Satori Bundle'),
        name: 'Satori Bundle',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Satori Bundle: Pixel Melt, Block Swap, Curve Tracer, Geometric Filter, Pixelocybe & more.',
        links: [
            { url: 'https://pixeldrain.com/u/ZRFHRjyq', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/G7Mf71', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/ylxmrfpemi7u7jd/Satori_Bundle_Win_250912.1_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Irrealix Bundle'),
        name: 'Irrealix Bundle 260215.1',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Irrealix Bundle: LoopFlow, Nebulosity, Gaussian Splatting, DustTransition, Potok & more.',
        links: [
            { url: 'https://pixeldrain.com/u/uLtLvf8W', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/WuJaVv', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/tilvmlpyjacgswz/irrealix_Bundle_260215_Win.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('FilmConvert Bundle'),
        name: 'FilmConvert Bundle',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'FilmConvert Bundle: Nitrate, Cinematch, Hazy, Halation.',
        links: [
            { url: 'https://pixeldrain.com/u/dnx5RhTa', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/sYhpnx', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/7lu12yuqp29fwp8/FilmConvert_Bundle_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('BAO Bundle 2025.5'),
        name: 'BAO Plugins Bundle 2025.5',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'BAO Bundle: Boa, Bones, Distortion Selector, Mask Avenger, Layer Sculptor & more.',
        links: [
            { url: 'https://pixeldrain.com/u/PzLVG7Jh', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/LeulaA', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/r2fnhaq7rqgyl3h/BAO_plugins_bundle_2025.5_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('BSKL Suite'),
        name: 'BSKL Suite',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Baskl Suite: AI Relight, AI Color Match Pro, AI Depth of Field, Diffusae & more.',
        links: [
            { url: 'https://pixeldrain.com/u/qedfjXdW', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/vfjeqW', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/6fyaix6ns1x4ddj/BSKL_Suite_Win_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Vimager Bundle'),
        name: 'Vimager Bundle 1.6.60209',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Vimager Bundle: SpeedX, ScaleUp, StyleX, ContrastUp, FacePro & more.',
        links: [
            { url: 'https://pixeldrain.com/u/KznVF5BY', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/WMF4Yr', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/xqwgl8q31lm0ufo/Vimager_Bundle_1.6.60209_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Frischluft Bundle'),
        name: 'Frischluft FL Bundle',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Frischluft Bundle: FL Glow, Flair, Lenscare, Depth of Field, Volumetrics & more.',
        links: [
            { url: 'https://pixeldrain.com/u/EhcW9jKT', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/am8iSg', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/v1o4ptwvei7ycbf/Frischluft_Win_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Glitchify'),
        name: 'Glitchify',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'ElementSupply Glitchify - Glitch effects for AE.',
        links: [
            { url: 'https://pixeldrain.com/u/nVizBLQY', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/obWdfa', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file/5u46xxrkexxsaou/Glitchify+Win+Mac+-+satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Depth Scanner 2 2.4.42'),
        name: 'Depth Scanner v2 2.4.42',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Blace Depth Scanner 2 v2.4.42.',
        links: [
            { url: 'https://pixeldrain.com/u/yLyEwcPi', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/jOLkX7', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/g05c6d99dvu7mav/Depth_Scanner_2_v2.4.42_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('I Ate Mushrooms 6.24'),
        name: 'I Ate Mushrooms 6.24',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Blace I Ate Mushrooms v6.24 - Trippy visual effects.',
        links: [
            { url: 'https://pixeldrain.com/u/kSSPhfXg', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/p05mkW', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/0deji51wc017vhd/I_Ate_Mushrooms_v6.24_Win_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('LaForge Suite 1.4.8.1'),
        name: 'LaForge Suite 1.4.8.1',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'ProductionCrate LaForge Suite. Over 25+ plugins for AE.',
        links: [
            { url: 'https://pixeldrain.com/u/J1MyK2ud', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/zJOhDN', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/scyxqrkfr1vzone/ProductionCrate_LaForge_Suite_Win_1.4.8.1_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('AutoFill 2.0.2'),
        name: 'AutoFill 2.0.2',
        category: 'adobe-plugins',
        platform: 'both',
        password: PASSWORD,
        desc: 'Plugin Everything AutoFill v2.0.2. Win + Mac.',
        links: [
            { url: 'https://pixeldrain.com/u/FswW57j1', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/80lw6o', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file/rcnieqiyp7juq1y/AutoFill+v2.0.2+Win+Mac+-+satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('AndrewYang Bundle'),
        name: 'AndrewYang Bundle 260215',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'AndrewYang Bundle: YY_Ramp, YY_HexTex, YY_MagicKey, YY_ShockRing, YY_Voronoi.',
        links: [
            { url: 'https://pixeldrain.com/u/3SJgo6H6', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/QcXerR', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/7bl77crv2kwoqik/AndrewYang_Bundle_260215_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Rowbyte Bundle 2025.8'),
        name: 'Rowbyte Bundle 2025.8',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Rowbyte Bundle: Stipple, Plexus, Fast Bokeh, Buena Depth Cue, Aura, TVDistortion.',
        links: [
            { url: 'https://pixeldrain.com/u/GNBT2UMF', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/QVMhLA', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/z3uc7o7hpjgtnrk/Rowbyte_Plugins_Bundle_2025.8_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('JPEG Glitch 1.0.4'),
        name: 'JPEG Glitch 1.0.4',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Zaebects JPEG Glitch v1.0.4.',
        links: [
            { url: 'https://pixeldrain.com/u/mT3wNQ2R', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/gp5JYc', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/7o5qfbyw97gm389/JPEG_Glitch_v1.0.4_Win_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Modulation 2.1'),
        name: 'Modulation 2.1',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Zaebects Modulation v2.1.',
        links: [
            { url: 'https://pixeldrain.com/u/jexwhKbg', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/IcIvSZ', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/2ia8mjolstw6i6t/Modulation_v2.1_Win_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Cartoon Moblur 1.6.3'),
        name: 'Cartoon Moblur 1.6.3',
        category: 'adobe-plugins',
        platform: 'both',
        password: PASSWORD,
        desc: 'Plugin Everything Cartoon Moblur v1.6.3. Win + Mac.',
        links: [
            { url: 'https://pixeldrain.com/u/GinXeAC8', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/SnWJA5', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file/ck25t6dfdtdr9f7/Cartoon+Moblur+v1.6.3+Win+Mac+-+satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Polytrace'),
        name: 'Polytrace',
        category: 'adobe-plugins',
        platform: 'both',
        password: PASSWORD,
        desc: 'ElementSupply Polytrace. Win + Mac.',
        links: [
            { url: 'https://pixeldrain.com/u/8Tjdvqq1', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/OacmCo', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file/an6toquvdnbq5as/Polytrace+Win+Mac+-+satvrn.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Color Llama 1.1.0'),
        name: 'Color Llama 1.1.0',
        category: 'adobe-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Color Llama v1.1.0 for After Effects.',
        links: [
            { url: 'https://pixeldrain.com/u/sddYRYTW', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/6E51Nl', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/ua00r497v3p5e59/Color_Llama_1.1.0_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },

    // ═══════════════════════════════════════════
    // ADOBE PLUGINS - MAC
    // ═══════════════════════════════════════════
    {
        id: makeId('Continuum 2026 Mac'),
        name: 'BorisFX Continuum 2026.0.1 (Mac)',
        category: 'adobe-plugins',
        platform: 'mac',
        password: PASSWORD,
        desc: 'BorisFX Continuum 2026 Adobe for Mac.',
        links: [
            { url: 'https://pixeldrain.com/u/1qBvYdYt', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/59MCBk', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/l7cjr50eq2194gz/Continuum_%28BCC%29_2026.0.1_Adobe_Mac_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Sapphire 2026 Mac'),
        name: 'BorisFX Sapphire 2026.0 (Mac)',
        category: 'adobe-plugins',
        platform: 'mac',
        password: PASSWORD,
        desc: 'BorisFX Sapphire 2026.0 for Adobe Mac.',
        links: [
            { url: 'https://pixeldrain.com/u/TuibauSf', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/XHGlHP', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/bx7ukqg8ixfsf3y/Sapphire_2026.0_Adobe_Mac_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Red Giant 2026 Mac'),
        name: 'Red Giant 2026.3.0 (Mac)',
        category: 'adobe-plugins',
        platform: 'mac',
        password: PASSWORD,
        desc: 'Maxon Red Giant Bundle 2026.3 for Mac.',
        links: [
            { url: 'https://pixeldrain.com/u/3ZzRBPnV', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/LBYaDf', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/8gvvdeqqml0rgqo/Red_Giant_Bundle_2026.3.0_Mac_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('REVisionFX Bundle 24.03 Mac'),
        name: 'RE:VisionFX Bundle 24.03 (Mac)',
        category: 'adobe-plugins',
        platform: 'mac',
        password: PASSWORD,
        desc: 'RE:VisionFX Effects Bundle v24.03 for Mac.',
        links: [
            { url: 'https://pixeldrain.com/u/TVoF4WXu', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/DVTBhw', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/u0ywcbd2a9mfji1/REVision_Effections_2403_MacOS_-_DISCORD.GG_%E2%88%95SATVRN.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Element 3D Mac'),
        name: 'Element 3D 2.2.3 (Mac)',
        category: 'adobe-plugins',
        platform: 'mac',
        password: PASSWORD,
        desc: 'Video Copilot Element 3D v2.2.3 for Mac.',
        links: [
            { url: 'https://pixeldrain.com/u/eWNqffQJ', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/SwHJuh', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/lp8t31tsi8iwucm/Element_3D_2.2.3_%282190%29.zip/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Pro Shaders 1 Mac'),
        name: 'Pro Shaders 1 (Mac)',
        category: 'adobe-plugins',
        platform: 'mac',
        password: PASSWORD,
        desc: 'Video Copilot Pro Shaders 1 for Mac.',
        links: [
            { url: 'https://pixeldrain.com/u/xz1weY4M', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/tpPvYF', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file/m8pwp3u0wps9y09/Pro+Shaders+1+Win+Mac+-+satvrn.zip/file', label: 'MediaFire' }
        ]
    },

    // ═══════════════════════════════════════════
    // OFX PLUGINS
    // ═══════════════════════════════════════════
    {
        id: makeId('Continuum 2026 OFX'),
        name: 'BorisFX Continuum 2026 OFX',
        category: 'ofx-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'BorisFX Continuum 2026 OFX v19.0.0 for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/xwtbStbt', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/3IaiOT', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/32npiq3z89zmvh4/BorisFX_Continuum_2026_OFX_v19.0.0_win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Sapphire 2026 OFX'),
        name: 'BorisFX Sapphire 2026 OFX',
        category: 'ofx-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'BorisFX Sapphire 2026 OFX for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/kBUf6txt', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/oUPHHu', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/01vm0agltgnwe0y/Sapphire_OFX_2026_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Twixtor 8.1.0 OFX'),
        name: 'Twixtor 8.1.0 OFX',
        category: 'ofx-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'RE:VisionFX Twixtor v8.1.0 OFX for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/MoFKhWXE', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/Uku6ac', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/ydz6rvid4su4rj6/Twixtor_v8.1.0_OFX_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('RSMB 6.6.0 OFX'),
        name: 'RSMB 6.6.0 OFX',
        category: 'ofx-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'RE:VisionFX RSMB v6.6.0 OFX - Motion Blur for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/sU7wq6tH', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/eWhvmj', label: 'GoFile' }
        ]
    },
    {
        id: makeId('REVisionFX Bundle 25.08 OFX'),
        name: 'RE:VisionFX Bundle 25.08 OFX',
        category: 'ofx-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'RE:VisionFX Effects Bundle v25.08 OFX for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/4zMtGpDG', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/Z7SJki', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/hkms9jglcj8o9r4/RE-VisionFX.Effections.OFX.v25.08_win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Dehancer Pro 7.3.1 OFX'),
        name: 'Dehancer Pro 7.3.1 OFX',
        category: 'ofx-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'Dehancer Pro OFX v7.3.1 for DaVinci Resolve.',
        links: [
            { url: 'https://pixeldrain.com/u/rJt8564w', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/VgijJJ', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/ni6o0s1m3eb562i/Dehancer_Pro_OFX_7.3.1_Win_-_satvrn.7z/file', label: 'MediaFire' }
        ]
    },
    {
        id: makeId('Bullet Time 1.1 OFX'),
        name: 'Bullet Time 1.1 OFX',
        category: 'ofx-plugins',
        platform: 'win',
        password: PASSWORD,
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
        category: 'ofx-plugins',
        platform: 'win',
        password: PASSWORD,
        desc: 'FilmConvert Nitrate Pro 2.20 OFX for VEGAS Pro only.',
        notes: 'Discontinued version, only version supporting VEGAS Pro.',
        links: [
            { url: 'https://pixeldrain.com/u/FzbhQ29c', label: 'Pixeldrain' },
            { url: 'https://gofile.io/d/ROPafq', label: 'GoFile' },
            { url: 'https://www.mediafire.com/file_premium/mieqgz1qzwrkxy8/FilmConvert.OFX.v2.20.CE_Win_VEGAS_-_satvrn.zip/file', label: 'MediaFire' }
        ]
    }
];

// Make available globally
window.resourcesData = resourcesData;
window.PASSWORD = PASSWORD;

// force redeploy 20260627180134
