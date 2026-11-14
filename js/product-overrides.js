// Applies the server-side plugin overrides to the static catalogue bundles.
//
// The catalogue ships inside js/plugins-data.js (and the preset/leak bundles), so the
// admin panel cannot edit those files. It writes a patch per product id instead and this
// script folds that patch into the bundles *before* any page renders them, which is why it
// must load after the data file and before the page's own script.
//
// The lookup is a single synchronous request on purpose: a page that renders on
// DOMContentLoaded cannot wait for an async fetch without flickering stale values, and an
// override that "sometimes" applies is exactly what made the old editor untrustworthy. The
// result is cached per tab for a minute, so only the first page view pays for it.
(function () {
    "use strict";

    var API = "/api/products/overrides";
    var CACHE_KEY = "zyrex_product_overrides_v1";
    var CACHE_TTL = 30 * 1000;
    var BUNDLES = ["pluginsData", "resourcesData", "presetsData", "audioData", "softwareData", "scenepacksData"];
    var items = {};
    var version = 0;

    function readCache() {
        try {
            var raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || !parsed.at || Date.now() - parsed.at > CACHE_TTL) return null;
            return parsed;
        } catch (e) {
            return null;
        }
    }

    function writeCache() {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), version: version, items: items }));
        } catch (e) { /* storage full or blocked: the sync fetch will run next time */ }
    }

    function loadSync() {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", API + "?ts=" + Date.now(), false);
            xhr.setRequestHeader("Accept", "application/json");
            xhr.send(null);
            if (xhr.status >= 200 && xhr.status < 300) {
                var data = JSON.parse(xhr.responseText);
                if (data && data.items) {
                    items = data.items;
                    version = Number(data.version) || 0;
                    writeCache();
                    return true;
                }
            }
        } catch (e) { /* offline or blocked: fall back to whatever is cached */ }
        return false;
    }

    function entry(id) {
        return items[String(id)] || null;
    }

    function patchOf(id) {
        var found = entry(id);
        return found && found.patch ? found.patch : null;
    }

    function isGone(id) {
        var found = entry(id);
        return Boolean(found && (found.deleted === true || found.hidden === true));
    }

    // Mirrors applyProductOverride() in workers/api.js so both sides agree on aliases.
    function patched(product) {
        if (!product || !product.id) return product;
        var patch = patchOf(product.id);
        if (!patch) return product;
        var merged = product;
        for (var key in patch) {
            if (Object.prototype.hasOwnProperty.call(patch, key)) merged[key] = patch[key];
        }
        if (patch.title !== undefined && patch.name === undefined) merged.name = patch.title;
        if (patch.name !== undefined && patch.title === undefined) merged.title = patch.name;
        if (patch.password !== undefined && patch.zip_password === undefined) merged.zip_password = patch.password;
        if (patch.zip_password !== undefined && patch.password === undefined) merged.password = patch.zip_password;
        if (patch.description !== undefined && patch.desc === undefined) merged.desc = patch.description;
        if (patch.desc !== undefined && patch.description === undefined) merged.description = patch.desc;
        merged.overridden = true;
        return merged;
    }

    // In place, so every later consumer of window.pluginsData sees the same objects.
    function patchBundle(list) {
        if (!Array.isArray(list)) return list;
        for (var i = list.length - 1; i >= 0; i -= 1) {
            var product = list[i];
            if (isGone(product && product.id)) {
                list.splice(i, 1);
                continue;
            }
            patched(product);
        }
        return list;
    }

    function applyBundles() {
        for (var i = 0; i < BUNDLES.length; i += 1) patchBundle(window[BUNDLES[i]]);
        // Admin-created plugin/software records live as overrides because the source bundle
        // is static. Add them to the public catalogue bundle so every existing page renders them.
        if (Array.isArray(window.pluginsData)) {
            var present = {};
            window.pluginsData.forEach(function (product) { if (product && product.id) present[String(product.id)] = true; });
            Object.keys(items).forEach(function (id) {
                var found = items[id];
                if (!present[id] && found && !isGone(id) && found.patch && (found.patch.type === "plugin" || found.patch.type === "software")) {
                    var created = patched(Object.assign({ id: id }, found.patch));
                    window.pluginsData.push(created);
                    present[id] = true;
                }
            });
        }
    }

    // For lists built after load (search results, API merges).
    function applyList(list) {
        if (!Array.isArray(list)) return list;
        var output = [];
        for (var i = 0; i < list.length; i += 1) {
            if (isGone(list[i] && list[i].id)) continue;
            output.push(patched(list[i]));
        }
        return output;
    }

    var cached = readCache();
    if (cached) {
        items = cached.items || {};
        version = Number(cached.version) || 0;
    } else {
        loadSync();
    }
    applyBundles();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyBundles);
    }

    window.ZyrexProductOverrides = {
        apply: patched,
        applyList: applyList,
        applyBundles: applyBundles,
        isGone: isGone,
        patch: patchOf,
        items: function () { return items; },
        version: function () { return version; },
        reload: function () {
            try { sessionStorage.removeItem(CACHE_KEY); } catch (e) { }
            items = {};
            version = 0;
            loadSync();
            applyBundles();
        }
    };
})();
