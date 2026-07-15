/**
 * Данные и поиск изолированного ≈4K каталога (не смешивается с getAllAnime / Kodik).
 */
(function (global) {
    'use strict';

    function normalizeJikan(j, malId) {
        if (!j) return null;
        if (typeof j === 'string') {
            try {
                j = JSON.parse(j);
            } catch {
                return null;
            }
        }
        if (j.data && typeof j.data === 'object' && j.data.mal_id != null) j = j.data;
        const mid = j.mal_id != null ? Number(j.mal_id) : Number(malId);
        if (!mid || Number.isNaN(mid)) return null;
        return { ...j, mal_id: mid };
    }

    function rowToAnime4kCard(row) {
        if (!row || row.mal_id == null) return null;
        const j = normalizeJikan(row.jikan, row.mal_id);
        if (!j) return null;

        const mapType =
            typeof mapJikanTypeToCatalog === 'function' ? mapJikanTypeToCatalog : (t) => t || 'Сериал';
        const mapGenre =
            typeof mapJikanGenreName === 'function' ? mapJikanGenreName : (n) => n;
        const mapStatus =
            typeof mapJikanStatusToCatalog === 'function'
                ? mapJikanStatusToCatalog
                : (s) => s || '';

        const dbTitleRu = row.title_ru && String(row.title_ru).trim() ? String(row.title_ru).trim() : '';
        const titleRu =
            dbTitleRu ||
            (typeof jikanPreferredTitle === 'function' ? jikanPreferredTitle(j, null) : '') ||
            j.title_english ||
            j.title ||
            '—';
        const titleAlt = j.title_english || j.title || j.title_japanese || '';
        const genreNames = [...(j.genres || []), ...(j.themes || [])]
            .map((g) => mapGenre(g.name))
            .filter(Boolean);
        const studioName = (j.studios && j.studios[0] && j.studios[0].name) || '';
        const dbDescRu =
            row.description_ru && String(row.description_ru).trim() ? String(row.description_ru).trim() : '';
        let desc = dbDescRu;
        if (!desc && j.synopsis) desc = String(j.synopsis).replace(/\s+/g, ' ').trim().slice(0, 1200);

        const posterFromRow = row.poster_url && String(row.poster_url).trim() ? String(row.poster_url).trim() : '';
        const posterUrl =
            posterFromRow ||
            j.images?.jpg?.large_image_url ||
            j.images?.jpg?.image_url ||
            null;

        const store = global.Anime4kCatalogStore;
        const id = store ? store.malToId(j.mal_id) : 22000000 + j.mal_id;

        return {
            id,
            mal_id: j.mal_id,
            title: titleRu,
            titleAlt,
            year: j.year || new Date().getFullYear(),
            rating: j.score || 0,
            genres: genreNames,
            type: mapType(j.type),
            status: mapStatus(j.status),
            episodes: j.episodes != null ? String(j.episodes) : '1',
            totalEpisodes: j.episodes || 1,
            studio: studioName,
            description: desc,
            isAnime4k: true,
            videoUrl: row.video_url && String(row.video_url).trim() ? String(row.video_url).trim() : '',
            posterUrl,
            _jikanRaw: j,
            _4kRow: row
        };
    }

    function getAllAnime4k() {
        const store = global.Anime4kCatalogStore;
        if (!store) return [];
        return store.getRows().map(rowToAnime4kCard).filter(Boolean);
    }

    function getAnime4kById(id) {
        const store = global.Anime4kCatalogStore;
        if (!store) return null;
        const row = store.getRowById(id);
        return row ? rowToAnime4kCard(row) : null;
    }

    function anime4kTitleMatchesQuery(anime, lowerQuery) {
        if (!lowerQuery || !anime) return false;
        if (typeof animeTitleMatchesQuery === 'function') return animeTitleMatchesQuery(anime, lowerQuery);
        const variants = [anime.title, anime.titleAlt];
        for (const v of variants) {
            if (v && String(v).toLowerCase().includes(lowerQuery)) return true;
        }
        return false;
    }

    function searchAnime4k(query) {
        const lowerQuery = String(query || '')
            .toLowerCase()
            .trim();
        if (!lowerQuery || lowerQuery.length < 2) return [];
        const hits = getAllAnime4k().filter((a) => anime4kTitleMatchesQuery(a, lowerQuery));
        if (typeof searchAnimeSortKey === 'function') {
            hits.sort((a, b) => {
                const da = searchAnimeSortKey(a, lowerQuery);
                const db = searchAnimeSortKey(b, lowerQuery);
                if (db !== da) return db - da;
                return (b.rating || 0) - (a.rating || 0);
            });
        }
        return hits;
    }

    function openAnime4kPage(animeId) {
        const prefix = typeof reminkoGetHtmlBasePath === 'function' ? reminkoGetHtmlBasePath() : '';
        sessionStorage.setItem('viewAnime4kId', String(animeId));
        sessionStorage.setItem('previousUrl', window.location.href);
        sessionStorage.setItem('scrollPosition', String(window.scrollY));
        window.location.href = `${prefix}anime/view-4k.html?id=${encodeURIComponent(String(animeId))}`;
    }

    /** Готовые кадры сравнения (статика, без плеера). Ключ — mal_id. */
    const ANIME4K_COMPARE_BY_MAL = {
        59062: {
            atLabel: '53:58',
            rawUrl: '../Fons/anime4k-compare/chainsaw-reze/raw-53m58.jpg',
            ultraUrl: '../Fons/anime4k-compare/chainsaw-reze/ultra-53m58.jpg'
        }
    };

    function getAnime4kCompareAssets(malId) {
        const key = Number(malId);
        if (!key || Number.isNaN(key)) return null;
        return ANIME4K_COMPARE_BY_MAL[key] || null;
    }

    global.getAllAnime4k = getAllAnime4k;
    global.getAnime4kById = getAnime4kById;
    global.searchAnime4k = searchAnime4k;
    global.openAnime4kPage = openAnime4kPage;
    global.getAnime4kCompareAssets = getAnime4kCompareAssets;
    global.rowToAnime4kCard = rowToAnime4kCard;
})(typeof window !== 'undefined' ? window : globalThis);
