/**
 * Загрузка изолированного ≈4K каталога из Supabase (catalog_4k_anime).
 * id на сайте = 22_000_000 + mal_id
 */
(function (global) {
    'use strict';

    const ID_BASE = 22000000;

    let _rows = [];
    let _loaded = false;
    let _loading = null;

    function malToId(malId) {
        return ID_BASE + (parseInt(malId, 10) || 0);
    }

    function idToMal(id) {
        const n = parseInt(id, 10);
        if (Number.isNaN(n) || n < ID_BASE || n >= ID_BASE + 10000000) return null;
        return n - ID_BASE;
    }

    function isAnime4kId(id) {
        const n = parseInt(id, 10);
        return !Number.isNaN(n) && n >= ID_BASE && n < ID_BASE + 10000000;
    }

    async function load(force) {
        if (_loaded && !force) return _rows;
        if (_loading && !force) return _loading;

        _loading = (async () => {
            if (typeof supabaseClient === 'undefined' || !supabaseClient) {
                _rows = [];
                _loaded = true;
                return _rows;
            }
            try {
                const { data, error } = await supabaseClient
                    .from('catalog_4k_anime')
                    .select('mal_id,jikan,title_ru,description_ru,video_url,poster_url,published,created_at')
                    .eq('published', true);
                if (error) throw error;
                _rows = (data || []).filter((r) => r && r.mal_id != null);
            } catch (e) {
                console.warn('[Anime4kCatalogStore] load:', e);
                _rows = [];
            }
            _loaded = true;
            try {
                global.dispatchEvent(new CustomEvent('reminko-anime4k-catalog-loaded', { detail: { count: _rows.length } }));
            } catch (_) {
                /* ignore */
            }
            return _rows;
        })();

        return _loading;
    }

    function getRows() {
        return _rows.slice();
    }

    function getRowByMal(malId) {
        const mid = parseInt(malId, 10);
        return _rows.find((r) => Number(r.mal_id) === mid) || null;
    }

    function getRowById(id) {
        const mal = idToMal(id);
        return mal != null ? getRowByMal(mal) : null;
    }

    global.Anime4kCatalogStore = {
        ID_BASE,
        malToId,
        idToMal,
        isAnime4kId,
        load,
        getRows,
        getRowByMal,
        getRowById,
        refresh: () => load(true)
    };
})(typeof window !== 'undefined' ? window : globalThis);
