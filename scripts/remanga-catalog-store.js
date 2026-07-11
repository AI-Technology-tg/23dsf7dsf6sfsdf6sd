/**
 * Загрузка каталога русской манги из data/remanga-manga-catalog.json
 * (сборка: node scripts/build/remanga-build-catalog.js)
 */
(function (global) {
    'use strict';

    let _items = [];
    let _byId = new Map();
    let _loaded = false;
    let _loading = null;
    let _meta = null;

    function catalogUrl() {
        const cfg = global.APP_CONFIG && global.APP_CONFIG.remanga;
        const rel = (cfg && cfg.catalogPath) || 'data/remanga-manga-catalog.json';
        if (/^https?:\/\//i.test(rel)) return rel;
        const base =
            (global.APP_CONFIG && global.APP_CONFIG.siteOrigin) ||
            (global.location && global.location.origin) ||
            '';
        const path = rel.replace(/^\//, '');
        if (base && !base.includes('localhost') && !String(global.location?.protocol).startsWith('file')) {
            return base.replace(/\/$/, '') + '/' + path;
        }
        const depth =
            global.location && global.location.pathname
                ? (global.location.pathname.match(/\//g) || []).length - 1
                : 0;
        const prefix = depth > 0 ? '../'.repeat(depth) : '';
        return prefix + path;
    }

    function indexItems(list) {
        _items = Array.isArray(list) ? list : [];
        _byId = new Map();
        for (const m of _items) {
            if (m && m.id != null) _byId.set(parseInt(m.id, 10), m);
        }
    }

    function loadRemangaCatalog(force) {
        if (_loaded && !force) return Promise.resolve(_items);
        if (_loading && !force) return _loading;

        _loading = fetch(catalogUrl(), { credentials: 'omit', cache: 'default' })
            .then((res) => {
                if (!res.ok) throw new Error('ReManga catalog HTTP ' + res.status);
                return res.json();
            })
            .then((data) => {
                _meta = data && data.meta ? data.meta : null;
                indexItems((data && data.items) || data || []);
                _loaded = true;
                try {
                    global.dispatchEvent(
                        new CustomEvent('reminko-remanga-catalog-loaded', {
                            detail: { count: _items.length },
                        })
                    );
                } catch (_) {
                    /* ignore */
                }
                return _items;
            })
            .catch((err) => {
                console.warn('[RemangaCatalog]', err);
                indexItems([]);
                _loaded = true;
                return _items;
            })
            .finally(() => {
                _loading = null;
            });

        return _loading;
    }

    function getRemangaCatalogManga() {
        return _items.slice();
    }

    function getRemangaMangaById(id) {
        return _byId.get(parseInt(id, 10)) || null;
    }

    function getMeta() {
        return _meta;
    }

    global.RemangaCatalogStore = {
        load: loadRemangaCatalog,
        getAll: getRemangaCatalogManga,
        getById: getRemangaMangaById,
        getMeta,
        isLoaded: () => _loaded,
    };
})(typeof window !== 'undefined' ? window : globalThis);
