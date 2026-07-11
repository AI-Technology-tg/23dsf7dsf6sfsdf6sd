/**
 * Все анонсы аниме из Jikan (seasons/upcoming + top/upcoming).
 * Общий источник для главной, каталога и календаря (вкладка «Анонсы»).
 */
(function (global) {
    'use strict';

    const JIKAN_BASE = 'https://api.jikan.moe/v4';
    const CACHE_KEY = 'reminko_jikan_announced_v2';
    const CACHE_LS_KEY = 'reminko_jikan_announced_ls_v1';
    const CACHE_TTL = 25 * 60 * 1000;
    const CACHE_LS_TTL = 7 * 24 * 60 * 60 * 1000;
    const SEASONS_MAX_PAGES = 27;
    const TOP_MAX_PAGES = 28;

    let _fetchPromise = null;
    let _listCache = null;

    function dedupeMal(list) {
        const m = new Map();
        for (const x of list || []) {
            if (x && x.mal_id && !m.has(x.mal_id)) m.set(x.mal_id, x);
        }
        return [...m.values()];
    }

    function filterJikanAnnouncedForHome(list) {
        if (!Array.isArray(list)) return [];
        const kidsGenres = new Set(['kids', 'детское', 'детский']);
        return list.filter((a) => {
            if (!a || !a.mal_id) return false;
            if (a.type === 'Music') return false;
            if (
                a.type &&
                a.type !== 'TV' &&
                a.type !== 'Movie' &&
                a.type !== 'OVA' &&
                a.type !== 'ONA'
            ) {
                return false;
            }
            if (Array.isArray(a.genres)) {
                const hasKids = a.genres.some((g) => {
                    const n = String(g?.name || g || '')
                        .trim()
                        .toLowerCase();
                    return kidsGenres.has(n);
                });
                if (hasKids) return false;
            }
            const st = String(a.status || '').trim();
            if (st === 'Currently Airing' || st === 'Finished Airing') return false;
            return st === 'Not yet aired';
        });
    }

    function filterAnnouncedJikanByMedia(list, mediaType) {
        const isFilm = mediaType === 'film';
        return filterJikanAnnouncedForHome(list).filter((a) => {
            const isMovie = a.type === 'Movie';
            if (isFilm) return isMovie;
            return !isMovie;
        });
    }

    function readSessionCache(allowStale) {
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const o = JSON.parse(raw);
            if (!o?.list?.length) return null;
            if (!allowStale && Date.now() - (o.ts || 0) > CACHE_TTL) {
                return null;
            }
            return o.list;
        } catch (_) {
            return null;
        }
    }

    function readStaleSessionCache() {
        return readSessionCache(true) || null;
    }

    function readLocalStorageCache(allowStale) {
        try {
            const raw = localStorage.getItem(CACHE_LS_KEY);
            if (!raw) return null;
            const o = JSON.parse(raw);
            if (!o?.list?.length) return null;
            if (!allowStale && Date.now() - (o.ts || 0) > CACHE_LS_TTL) return null;
            return o.list;
        } catch (_) {
            return null;
        }
    }

    function readAnyAnnouncedCache(allowStale) {
        return (
            readSessionCache(allowStale) ||
            readLocalStorageCache(allowStale) ||
            (_listCache?.length ? _listCache : null)
        );
    }

    function writeSessionCache(list) {
        const payload = JSON.stringify({ ts: Date.now(), list });
        try {
            sessionStorage.setItem(CACHE_KEY, payload);
        } catch (_) {
            /* ignore */
        }
        try {
            localStorage.setItem(CACHE_LS_KEY, payload);
        } catch (_) {
            /* ignore */
        }
    }

    async function jikanAnnouncedFetch(url) {
        if (
            typeof global.reminkoJikanIsCircuitOpen === 'function' &&
            global.reminkoJikanIsCircuitOpen()
        ) {
            const err = new Error('Jikan temporarily unavailable');
            err.status = 503;
            err.reminkoSilent = true;
            throw err;
        }
        try {
            if (typeof global.reminkoJikanFetch === 'function') {
                return await global.reminkoJikanFetch(url);
            }
        } catch (e) {
            if (isJikanTransientError(e)) {
                e.reminkoSilent = true;
            }
            throw e;
        }
        const res = await fetch(url);
        if (!res.ok) {
            const err = new Error(`Jikan ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return res.json();
    }

    function isJikanTransientError(err) {
        const st = err && err.status;
        if (st === 429 || st === 502 || st === 503 || st === 504) return true;
        const msg = String(err && err.message ? err.message : err).toLowerCase();
        return (
            msg.includes('503') ||
            msg.includes('502') ||
            msg.includes('504') ||
            msg.includes('rate limit') ||
            msg.includes('temporarily unavailable') ||
            msg.includes('failed to fetch')
        );
    }

    async function jikanAnnouncedFetchPaged(pathWithQuery, maxPages, onChunk) {
        const all = [];
        for (let page = 1; page <= maxPages; page++) {
            const sep = pathWithQuery.includes('?') ? '&' : '?';
            const url = `${JIKAN_BASE}${pathWithQuery}${sep}page=${page}`;
            try {
                const data = await jikanAnnouncedFetch(url);
                const chunk = data.data || [];
                all.push(...chunk);
                if (typeof onChunk === 'function') {
                    onChunk(dedupeMal(all), page);
                }
                if (!data.pagination?.has_next_page || chunk.length === 0) break;
            } catch (e) {
                if (all.length) break;
                if (isJikanTransientError(e)) break;
                throw e;
            }
            if (page < maxPages) await new Promise((r) => setTimeout(r, 1100));
        }
        return dedupeMal(all);
    }

    function getJikanAnnouncedCachedSync() {
        if (_listCache?.length) return _listCache;
        return readAnyAnnouncedCache(true) || [];
    }

    function normalizeFetchOpts(forceOrOpts, maybeOpts) {
        if (typeof forceOrOpts === 'object' && forceOrOpts !== null && !Array.isArray(forceOrOpts)) {
            return {
                force: !!forceOrOpts.force,
                onProgress: typeof forceOrOpts.onProgress === 'function' ? forceOrOpts.onProgress : null,
            };
        }
        const onProgress =
            maybeOpts && typeof maybeOpts.onProgress === 'function' ? maybeOpts.onProgress : null;
        return { force: !!forceOrOpts, onProgress };
    }

    function emitAnnouncedProgress(rawList, onProgress) {
        if (!onProgress) return;
        const list = sortAnnouncedList(filterJikanAnnouncedForHome(dedupeMal(rawList)));
        try {
            onProgress(list);
        } catch (_) {
            /* ignore */
        }
    }

    function sortAnnouncedList(list) {
        return [...list].sort((a, b) => {
            const ta = a.aired?.from ? Date.parse(a.aired.from) : Infinity;
            const tb = b.aired?.from ? Date.parse(b.aired.from) : Infinity;
            if (ta !== tb) return ta - tb;
            return (b.members || b.scored_by || 0) - (a.members || a.scored_by || 0);
        });
    }

    function announcedFallbackOrEmpty() {
        const stale = readAnyAnnouncedCache(true);
        return stale?.length ? stale : [];
    }

    async function fetchJikanAnnouncedList(forceOrOpts, maybeOpts) {
        const { force, onProgress } = normalizeFetchOpts(forceOrOpts, maybeOpts);

        if (!force && _listCache?.length) {
            if (onProgress) onProgress(_listCache);
            return _listCache;
        }
        if (!force) {
            const cached = readAnyAnnouncedCache(false);
            if (cached?.length) {
                _listCache = cached;
                if (onProgress) onProgress(cached);
                return cached;
            }
        }
        if (
            !force &&
            typeof global.reminkoJikanIsCircuitOpen === 'function' &&
            global.reminkoJikanIsCircuitOpen()
        ) {
            const stale = announcedFallbackOrEmpty();
            _listCache = stale;
            if (onProgress) onProgress(stale);
            return stale;
        }
        if (_fetchPromise && !force) {
            if (onProgress) {
                const list = await _fetchPromise;
                onProgress(list);
                return list;
            }
            return _fetchPromise;
        }

        _fetchPromise = (async () => {
            const merged = [];
            let seasons = [];
            let top = [];
            try {
                seasons = await jikanAnnouncedFetchPaged(
                    '/seasons/upcoming?limit=25&order_by=members&sort=desc',
                    SEASONS_MAX_PAGES,
                    (chunk) => {
                        merged.length = 0;
                        merged.push(...chunk);
                        emitAnnouncedProgress(merged, onProgress);
                    }
                );
            } catch (e) {
                if (!isJikanTransientError(e)) throw e;
            }

            merged.length = 0;
            merged.push(...seasons);
            if (seasons.length) emitAnnouncedProgress(merged, onProgress);

            if (seasons.length) {
                await new Promise((r) => setTimeout(r, 1200));
            }
            try {
                top = await jikanAnnouncedFetchPaged(
                    '/top/anime?filter=upcoming&limit=25',
                    TOP_MAX_PAGES,
                    (chunk) => {
                        emitAnnouncedProgress([...seasons, ...chunk], onProgress);
                    }
                );
            } catch (e) {
                if (!seasons.length && !isJikanTransientError(e)) throw e;
            }

            const combined = dedupeMal([...seasons, ...top]);
            if (!combined.length) {
                const stale = announcedFallbackOrEmpty();
                _listCache = stale;
                if (onProgress) onProgress(stale);
                _fetchPromise = null;
                return stale;
            }

            const list = sortAnnouncedList(filterJikanAnnouncedForHome(combined));
            _listCache = list;
            writeSessionCache(list);
            if (onProgress) onProgress(list);
            _fetchPromise = null;
            return list;
        })();

        try {
            return await _fetchPromise;
        } catch (e) {
            _fetchPromise = null;
            const stale = announcedFallbackOrEmpty();
            _listCache = stale;
            if (onProgress) onProgress(stale);
            if (stale.length || isJikanTransientError(e)) return stale;
            throw e;
        }
    }

    function jikanPosterFromAnime(anime) {
        if (!anime) return '';
        const jpg = anime.images?.jpg || anime.images?.webp;
        if (!jpg) return '';
        return jpg.large_image_url || jpg.image_url || jpg.small_image_url || '';
    }

    function russianTitleFromCatalogMal(malId) {
        const mal = parseInt(malId, 10);
        if (!Number.isFinite(mal) || mal <= 0) return '';
        if (typeof global.KodikCatalogStore?.getAll === 'function') {
            const hit = global.KodikCatalogStore.getAll().find(
                (a) => a && parseInt(a.mal_id, 10) === mal
            );
            if (hit?.title && String(hit.title).trim()) return String(hit.title).trim();
        }
        if (typeof global.getAnimeById === 'function') {
            for (const id of [mal, 20_000_000 + mal, 20_500_000 + mal, 10_000_000 + mal]) {
                const a = global.getAnimeById(id);
                if (a?.title && String(a.title).trim()) return String(a.title).trim();
            }
        }
        return '';
    }

    function jikanAnnouncedToCalendarRow(anime) {
        if (!anime?.mal_id) return null;
        const fromCatalog = russianTitleFromCatalogMal(anime.mal_id);
        const title =
            fromCatalog ||
            (anime.title_russian && String(anime.title_russian).trim()) ||
            (anime.title && /[а-яё]/i.test(anime.title) ? String(anime.title).trim() : '') ||
            (anime.title_english && String(anime.title_english).trim()) ||
            (anime.title && String(anime.title).trim()) ||
            (anime.title_japanese && String(anime.title_japanese).trim()) ||
            `MAL #${anime.mal_id}`;
        const from = anime.aired?.from ? String(anime.aired.from) : '';
        return {
            mal_id: anime.mal_id,
            title_ru: title,
            next_at: from,
            next_episode: 1,
            _jikan: anime,
            _jikanAnnounced: true,
        };
    }

    function jikanAnnouncedToCalendarRows(list) {
        const rows = [];
        for (const a of list || []) {
            const row = jikanAnnouncedToCalendarRow(a);
            if (row) rows.push(row);
        }
        const byTime = (x, y) => {
            const tx = Date.parse(x.next_at) || Infinity;
            const ty = Date.parse(y.next_at) || Infinity;
            return tx - ty;
        };
        rows.sort(byTime);
        return rows;
    }

    function jikanVirtualAnimeId(malId) {
        const mal = parseInt(malId, 10);
        if (!Number.isFinite(mal) || mal <= 0) return null;
        return 10_000_000 + mal;
    }

    function navigateToJikanAnnouncedAnime(anime, baseHref) {
        if (!anime?.mal_id) return;
        const mal = anime.mal_id;
        const virtualId = jikanVirtualAnimeId(mal);
        const base =
            baseHref ||
            (global.location.pathname.includes('/catalog/') ||
            global.location.pathname.includes('/anime/') ||
            global.location.pathname.includes('/manga/')
                ? '../anime/view.html'
                : 'anime/view.html');
        try {
            global.sessionStorage.setItem('jikanAnimeData', JSON.stringify(anime));
            global.sessionStorage.setItem('previousUrl', global.location.href);
            if (virtualId != null) {
                global.sessionStorage.setItem('viewAnimeId', String(virtualId));
            }
        } catch (_) {
            /* ignore */
        }
        global.location.href = `${base}?id=${encodeURIComponent(String(virtualId))}&mal_id=${encodeURIComponent(String(mal))}`;
    }

    function attachJikanPosterFallback(img, malId, anime) {
        if (!img) return;
        const mal = parseInt(malId, 10);
        if (!Number.isFinite(mal) || mal <= 0) return;

        const primary = jikanPosterFromAnime(anime);
        if (primary) img.src = primary;

        img.referrerPolicy = 'no-referrer';
        img.decoding = 'async';

        img.onerror = async function onPosterErr() {
            if (this.dataset.posterStep === '2') {
                const cdn = `https://shikimori.one/system/animes/${mal}/original.jpg`;
                if (this.src !== cdn) {
                    this.dataset.posterStep = '3';
                    this.src = cdn;
                    return;
                }
                this.style.display = 'none';
                return;
            }
            if (this.dataset.posterStep === '1') return;
            this.dataset.posterStep = '1';
            try {
                let url = '';
                if (typeof global.jikanFetchPosterByMalId === 'function') {
                    url = await global.jikanFetchPosterByMalId(mal);
                }
                if (!url && typeof global.jikanFetchAnimeFullByMalId === 'function') {
                    const full = await global.jikanFetchAnimeFullByMalId(mal);
                    url = jikanPosterFromAnime(full);
                }
                if (url) {
                    this.dataset.posterStep = '2';
                    this.src = url;
                    return;
                }
            } catch (_) {
                /* ignore */
            }
            this.dataset.posterStep = '2';
            this.src = `https://shikimori.one/system/animes/${mal}/original.jpg`;
        };

        if (img.complete && img.naturalWidth === 0 && primary) {
            img.onerror();
        }
    }

    global.fetchJikanAnnouncedList = fetchJikanAnnouncedList;
    global.getJikanAnnouncedCachedSync = getJikanAnnouncedCachedSync;
    global.filterJikanAnnouncedForHome = filterJikanAnnouncedForHome;
    global.filterAnnouncedJikanByMedia = filterAnnouncedJikanByMedia;
    global.jikanAnnouncedToCalendarRow = jikanAnnouncedToCalendarRow;
    global.jikanAnnouncedToCalendarRows = jikanAnnouncedToCalendarRows;
    global.jikanPosterFromAnime = jikanPosterFromAnime;
    global.attachJikanPosterFallback = attachJikanPosterFallback;
    global.navigateToJikanAnnouncedAnime = navigateToJikanAnnouncedAnime;
    global.jikanVirtualAnimeId = jikanVirtualAnimeId;
})(typeof window !== 'undefined' ? window : globalThis);
