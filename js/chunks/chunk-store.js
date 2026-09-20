/**
 * Zyrex Chunk Architecture — Data & Script Chunk Manager
 * Manages chunked data stores, memory/localStorage chunk caching,
 * progressive chunk rendering, and on-demand dynamic script loading.
 */
(function(window) {
    'use strict';

    var CHUNK_PREFIX = 'zyrex_chk_';
    var DEFAULT_CHUNK_SIZE = 36;
    var loadedScripts = new Set();
    var loadingScripts = new Map();

    var ChunkStore = {
        chunkSize: DEFAULT_CHUNK_SIZE,
        memoryCache: new Map(),

        /**
         * Dynamically load a JavaScript chunk on demand
         * @param {string} src - Path to chunk file (e.g. '/js/chunks/wizard.chunk.js')
         * @param {string} [id] - Optional script ID
         * @returns {Promise<void>}
         */
        loadScriptChunk: function(src, id) {
            if (loadedScripts.has(src)) {
                return Promise.resolve();
            }
            if (loadingScripts.has(src)) {
                return loadingScripts.get(src);
            }
            var promise = new Promise(function(resolve, reject) {
                var existing = id ? document.getElementById(id) : document.querySelector('script[src="' + src + '"]');
                if (existing && loadedScripts.has(src)) {
                    resolve();
                    return;
                }
                if (existing) {
                    existing.addEventListener('load', function() {
                        loadedScripts.add(src);
                        loadingScripts.delete(src);
                        resolve();
                    });
                    existing.addEventListener('error', function(err) {
                        loadingScripts.delete(src);
                        reject(err);
                    });
                    return;
                }
                var script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = src;
                script.async = true;
                if (id) script.id = id;
                script.onload = function() {
                    loadedScripts.add(src);
                    loadingScripts.delete(src);
                    resolve();
                };
                script.onerror = function(err) {
                    loadingScripts.delete(src);
                    console.error('[ChunkStore] Failed to load chunk:', src, err);
                    reject(err);
                };
                (document.head || document.documentElement).appendChild(script);
            });
            loadingScripts.set(src, promise);
            return promise;
        },

        /**
         * Split an array into fixed-size chunks
         * @param {Array} items
         * @param {number} [size]
         * @returns {Array<Array>}
         */
        paginateArray: function(items, size) {
            if (!Array.isArray(items)) return [];
            var s = size || this.chunkSize;
            var chunks = [];
            for (var i = 0; i < items.length; i += s) {
                chunks.push(items.slice(i, i + s));
            }
            return chunks;
        },

        /**
         * Get a chunk from cache (Memory -> localStorage)
         * @param {string} storeKey
         * @param {number} chunkIndex (1-indexed)
         * @returns {Array|null}
         */
        getChunk: function(storeKey, chunkIndex) {
            var memKey = storeKey + '_c' + chunkIndex;
            if (this.memoryCache.has(memKey)) {
                return this.memoryCache.get(memKey);
            }
            try {
                var raw = localStorage.getItem(CHUNK_PREFIX + memKey);
                if (raw) {
                    var parsed = JSON.parse(raw);
                    if (parsed && (!parsed.exp || parsed.exp > Date.now())) {
                        this.memoryCache.set(memKey, parsed.data);
                        return parsed.data;
                    }
                }
            } catch(e) {}
            return null;
        },

        /**
         * Save a chunk to cache (Memory + localStorage)
         * @param {string} storeKey
         * @param {number} chunkIndex (1-indexed)
         * @param {any} data
         * @param {number} [ttlMs] - Time to live in ms (default: 10 mins)
         */
        setChunk: function(storeKey, chunkIndex, data, ttlMs) {
            var memKey = storeKey + '_c' + chunkIndex;
            this.memoryCache.set(memKey, data);
            try {
                var payload = {
                    exp: Date.now() + (ttlMs || 10 * 60 * 1000),
                    data: data
                };
                localStorage.setItem(CHUNK_PREFIX + memKey, JSON.stringify(payload));
            } catch(e) {}
        },

        /**
         * Store an entire catalog as indexed chunks for fast instant paging
         * @param {string} storeKey
         * @param {Array} items
         * @param {number} [chunkSize]
         * @param {number} [ttlMs]
         */
        storeCatalogChunks: function(storeKey, items, chunkSize, ttlMs) {
            if (!Array.isArray(items)) return;
            var size = chunkSize || this.chunkSize;
            var chunks = this.paginateArray(items, size);
            var ttl = ttlMs || 15 * 60 * 1000;

            // Save meta
            var meta = {
                total: items.length,
                totalChunks: chunks.length,
                chunkSize: size,
                exp: Date.now() + ttl
            };
            try {
                localStorage.setItem(CHUNK_PREFIX + storeKey + '_meta', JSON.stringify(meta));
            } catch(e) {}

            for (var idx = 0; idx < chunks.length; idx++) {
                this.setChunk(storeKey, idx + 1, chunks[idx], ttl);
            }
        },

        /**
         * Read meta info of chunked store
         */
        getCatalogMeta: function(storeKey) {
            try {
                var raw = localStorage.getItem(CHUNK_PREFIX + storeKey + '_meta');
                if (!raw) return null;
                var meta = JSON.parse(raw);
                if (meta && (!meta.exp || meta.exp > Date.now())) return meta;
            } catch(e) {}
            return null;
        },

        /**
         * Non-blocking progressive DOM hydration using requestAnimationFrame / requestIdleCallback
         * Renders an array of HTML items in small chunks to prevent UI stutter / frame drops
         * @param {HTMLElement} container
         * @param {Array} items
         * @param {Function} renderItemFn - returns HTML string or DOM node
         * @param {Object} [options] - { subChunkSize: 12, onComplete: fn }
         */
        renderProgressive: function(container, items, renderItemFn, options) {
            if (!container) return;
            var opts = options || {};
            var subChunkSize = opts.subChunkSize || 12;
            var onComplete = opts.onComplete || function() {};

            container.innerHTML = '';
            if (!items || !items.length) {
                onComplete();
                return;
            }

            var index = 0;
            function processNextSubChunk() {
                var end = Math.min(index + subChunkSize, items.length);
                var frag = document.createDocumentFragment();
                var tempDiv = document.createElement('div');

                for (; index < end; index++) {
                    var res = renderItemFn(items[index], index);
                    if (typeof res === 'string') {
                        tempDiv.innerHTML = res;
                        while (tempDiv.firstChild) {
                            frag.appendChild(tempDiv.firstChild);
                        }
                    } else if (res instanceof Node) {
                        frag.appendChild(res);
                    }
                }
                container.appendChild(frag);

                if (index < items.length) {
                    if (window.requestIdleCallback) {
                        window.requestIdleCallback(processNextSubChunk, { timeout: 80 });
                    } else {
                        requestAnimationFrame(processNextSubChunk);
                    }
                } else {
                    onComplete();
                }
            }

            // Start first sub-chunk immediately on current frame for zero latency
            processNextSubChunk();
        },

        /**
         * Idle prefetcher for chunks or URLs
         */
        prefetch: function(url) {
            if (!url) return;
            var link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            link.as = url.endsWith('.js') ? 'script' : 'fetch';
            document.head.appendChild(link);
        },

        /**
         * Clear cached chunks for a storeKey from memory and localStorage
         * @param {string} [storeKey] - If omitted, clears all zyrex_chk_ keys
         */
        clearStore: function(storeKey) {
            if (storeKey) {
                // Clear memory cache
                for (var key of this.memoryCache.keys()) {
                    if (key.indexOf(storeKey) === 0) {
                        this.memoryCache.delete(key);
                    }
                }
                // Clear localStorage chunks
                try {
                    localStorage.removeItem(CHUNK_PREFIX + storeKey + '_meta');
                    var keysToRemove = [];
                    for (var i = 0; i < localStorage.length; i++) {
                        var k = localStorage.key(i);
                        if (k && k.indexOf(CHUNK_PREFIX + storeKey) === 0) {
                            keysToRemove.push(k);
                        }
                    }
                    keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
                } catch(e) {}
            } else {
                this.memoryCache.clear();
                try {
                    var allKeys = [];
                    for (var j = 0; j < localStorage.length; j++) {
                        var lk = localStorage.key(j);
                        if (lk && lk.indexOf(CHUNK_PREFIX) === 0) {
                            allKeys.push(lk);
                        }
                    }
                    allKeys.forEach(function(k) { localStorage.removeItem(k); });
                } catch(e) {}
            }
        }
    };

    window.ZyrexChunkStore = ChunkStore;
})(window);

