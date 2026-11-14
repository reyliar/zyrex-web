(function () {
    'use strict';

    var KNOWN_EFFECT_NAMES = [
        '3D Point Control', 'Angle Control', 'Checkbox Control', 'Color Control',
        'Dropdown Menu Control', 'Layer Control', 'Point Control', 'Slider Control',
        'Looks', 'Deep Glow', 'RSMB', 'RSMB Pro', 'RSMB Pro Vectors', 'Twixtor',
        'Twixtor Pro', 'Colorista V', 'Cosmo II', 'Denoiser III', 'Mojo II',
        'Parametric Curve', 'Renoiser', 'Echospaces', 'Form', 'Geo', 'Horizon',
        'Lux', 'Mir 3', 'Tao', 'Trapcode Particular', 'Sound Keys', 'S_Glow',
        'S_Flicker', 'BCC Glow',
        // Built-in After Effects effects
        'Fast Box Blur', 'Gaussian Blur', 'Lens Blur', 'Smart Blur', 'Camera Blur',
        'Lumetri Color', 'Hue/Saturation', 'Curves', 'Levels', 'Exposure',
        'Brightness & Contrast', 'Vibrance', 'Tritone', 'Gradient Ramp',
        'Glow', 'Shine', 'Optical Flares', 'Element 3D', 'Video Copilot',
        'Motion Blur', 'Directional Blur', 'Radial Blur', 'Sharpen',
        'Noise', 'Add Grain', 'Remove Grain', 'Median',
        'Turbulent Noise', 'Fractal Noise', 'Displacement Map',
        'Warp Stabilizer', 'Time Warp', 'Echo', 'Posterize Time',
        'CC Ball Action', 'CC Particle World', 'CC Rainfall', 'CC Snowfall',
        'CC Toner', 'CC Color Offset', 'CC Cross Blur',
        'Fill', 'Stroke', 'Drop Shadow', 'Inner Shadow', 'Bevel Alpha',
        'Roughen Edges', 'Corner Pin', 'Optics Compensation', 'Mesh Warp',
        'Liquify', 'Bulge', 'Wave Warp',
        'Colorama', 'Tint', 'Color Balance', 'Selective Color Correction',
        'Set Matte', 'Extract', 'Linear Color Key', 'Difference Matte',
        'Fast Color Corrector', 'Color Finesse', 'Magic Bullet Looks'
    ];

    var ZYREX_PREFIX_MARKERS = ['zyrexediting.xyz', 'zyrexediting.xyz \u0387', 'zyrexediting.xyz \u00b7', 'zyrexediting.xyz \u2022'];

    function fourCC(bytes, offset) {
        return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    }

    function readUint32(bytes, offset) {
        return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) +
            (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
    }

    // Download-time forensic marks are zero-width characters appended to credited names.
    // They must never reach the UI, a length check or an effect-name comparison.
    var ZW_MARK_LEAD = '\u2062';
    var ZW_MARK_TAIL = '\u2064';
    var ZW_MARK_CHARS = '\u200b\u200c\u200d\u2060';

    function stripInvisibleMark(value) {
        var text = String(value || '');
        var out = '';
        var i = 0;
        while (i < text.length) {
            if (text.charAt(i) === ZW_MARK_LEAD) {
                var end = text.indexOf(ZW_MARK_TAIL, i + 1);
                if (end > i) { i = end + 1; continue; }
            }
            if (ZW_MARK_CHARS.indexOf(text.charAt(i)) >= 0) { i++; continue; }
            out += text.charAt(i);
            i++;
        }
        return out;
    }

    function cleanText(value) {
        return stripInvisibleMark(String(value || '').replace(/\0/g, '')).replace(/\s+/g, ' ').trim();
    }

    function readTdmn(bytes, payloadStart, size) {
        if (!size || size > 180) return '';
        var end = payloadStart;
        while (end < payloadStart + size && bytes[end] !== 0 && bytes[end] >= 32 && bytes[end] <= 126) end++;
        if (end === payloadStart) return '';
        return cleanText(new TextDecoder('ascii').decode(bytes.subarray(payloadStart, end)));
    }

    function readStructuredText(bytes, payloadStart, size) {
        if (size < 8 || payloadStart + size > bytes.length || fourCC(bytes, payloadStart) !== 'Utf8') return '';
        var textSize = readUint32(bytes, payloadStart + 4);
        if (!textSize || textSize > size - 8) return '';
        return cleanText(new TextDecoder('utf-8', { fatal: false })
            .decode(bytes.subarray(payloadStart + 8, payloadStart + 8 + textSize)));
    }

    function hasZyrexPrefix(value) {
        var lower = value.toLowerCase();
        return ZYREX_PREFIX_MARKERS.some(function(m) { return lower.startsWith(m.toLowerCase()); });
    }

    function removeZyrexPrefix(value) {
        return String(value || '').replace(/^zyrexediting\.xyz\s*(?:-|[\u0387\u00b7\u2022•])\s*/i, '').trim();
    }

    function validDisplayName(value) {
        return value.length >= 2 && value.length <= 80 &&
            /[a-z]/i.test(value) && !/[<>{}[\]\\|]/.test(value) &&
            !/^(?:ADBE|Pseudo\/|PF_|PrMr|AEGP|aete|tdta|tdmn|tdsn|Utf8|TEXT)\b/i.test(value) &&
            !/^(?:Adobe After Effects|Animation Preset|Copyright|Software|AE CS|Effect Built)\b/i.test(value) &&
            !/^[0-9. ]+$/.test(value);
    }

    function isEffectPath(history, offset) {
        var names = history.filter(function (item) {
            return offset - item.offset <= 420;
        }).map(function (item) { return item.name; });
        var paradeIndex = -1;
        for (var i = names.length - 1; i >= 0; i--) {
            if (/^ADBE Effect Parade$/i.test(names[i])) {
                paradeIndex = i;
                break;
            }
        }
        if (paradeIndex < 0) return false;
        var pathNames = names.slice(paradeIndex + 1);
        var lastName = pathNames[pathNames.length - 1] || '';
        if (/^ADBE (?:Effect Built In Params|Effect Mask|Effect Parade|Force CPU GPU|Group End|Transform Group|Text )/i.test(lastName)) return false;
        return !/-[1-9]\d{3,}$/.test(lastName);
    }

    // Add a name to the list; priority = Zyrex-prefixed names go first
    function addName(names, value, isPrefixed) {
        var name = hasZyrexPrefix(value) ? removeZyrexPrefix(value) : cleanText(value);
        if (!name || !validDisplayName(name)) return;
        var key = name.toLowerCase();
        if (names.some(function (item) { return item.name.toLowerCase() === key; })) return;
        names.push({ name: name, prefixed: !!isPrefixed });
    }

    function extractFfxEffectNames(input) {
        var bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
        var names = [];   // [{name, prefixed}]
        var history = [];
        var decoder = new TextDecoder('utf-8', { fatal: false });

        function parseChildren(start, end, parentListType, depth) {
            if (depth > 32) return;
            var offset = start;
            while (offset + 8 <= end && offset + 8 <= bytes.length) {
                var id = fourCC(bytes, offset);
                var size = readUint32(bytes, offset + 4);
                var payloadStart = offset + 8;
                var chunkEnd = payloadStart + size;
                if (!/^[\x20-\x7e]{4}$/.test(id) || size > bytes.length || chunkEnd > end || chunkEnd > bytes.length) {
                    offset++;
                    continue;
                }
                if (id === 'LIST' || id === 'RIFX') {
                    var listType = size >= 4 ? fourCC(bytes, payloadStart) : '';
                    if (/^[\x20-\x7e]{4}$/.test(listType)) {
                        parseChildren(payloadStart + 4, chunkEnd, listType, depth + 1);
                    }
                } else if (id === 'tdmn') {
                    var pathName = readTdmn(bytes, payloadStart, size);
                    if (pathName) {
                        history.push({ offset: offset, name: pathName });
                    }
                } else if (id === 'tdsn' || id === 'fnam') {
                    var text = readStructuredText(bytes, payloadStart, size);
                    if (text) {
                        var isEmbeddedEffectName = id === 'fnam' && parentListType === 'sspc';
                        var isEffectDisplayName = id === 'tdsn' &&
                            ((parentListType === 'besc' && isEffectPath(history, offset)) ||
                             (parentListType === 'tdgp' && isEffectPath(history, offset)));
                        if (isEmbeddedEffectName || isEffectDisplayName) {
                            var isPrefixed = hasZyrexPrefix(text);
                            var cleanedName = isPrefixed ? removeZyrexPrefix(text) : text;
                            if (validDisplayName(cleanedName)) addName(names, cleanedName, isPrefixed);
                        }
                    }
                }
                offset = chunkEnd;
            }
        }

        if (bytes.length >= 20 && fourCC(bytes, 0) === 'RIFX' && fourCC(bytes, 8) === 'FaFX') {
            parseChildren(12, Math.min(bytes.length, 8 + readUint32(bytes, 4)), 'FaFX', 0);
        } else {
            parseChildren(0, bytes.length, '', 0);
        }

        // Also scan raw bytes for known effect names (even if non-standard container)
        var byteText = decoder.decode(bytes);
        KNOWN_EFFECT_NAMES.forEach(function (knownName) {
            var escaped = knownName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Match Zyrex-prefixed version
            var prefixedPattern = new RegExp(
                '(zyrexediting\\.xyz\\s*(?:-|[\\u0387\\u00b7•])\\s*' + escaped + ')(?=$|[^A-Za-z0-9])',
                'ig'
            );
            var match;
            while ((match = prefixedPattern.exec(byteText)) !== null) {
                addName(names, match[1], true);
            }
            // Also match plain known name
            if (!names.some(function(item) { return item.name.toLowerCase() === knownName.toLowerCase(); })) {
                var plainPattern = new RegExp('(?:^|[\\x00\\s])(' + escaped + ')(?=$|[^A-Za-z0-9])', 'ig');
                while ((match = plainPattern.exec(byteText)) !== null) {
                    addName(names, match[1], false);
                    break; // only first occurrence
                }
            }
        });

        // Sort: Zyrex-prefixed first, then alphabetical
        names.sort(function(a, b) {
            if (a.prefixed && !b.prefixed) return -1;
            if (!a.prefixed && b.prefixed) return 1;
            return a.name.localeCompare(b.name);
        });

        return names.slice(0, 30).map(function(item) { return item.name; });
    }

    window.extractFfxEffectNames = extractFfxEffectNames;
    window.stripZyrexInvisibleMark = stripInvisibleMark;
})();
