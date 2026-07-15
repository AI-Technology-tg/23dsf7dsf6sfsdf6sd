/**
 * Alloha TV — iframe-плеер через Netlify-прокси (ALLOHA_API_TOKEN в env).
 */
(function () {
    const CACHE_PREFIX = 'reminko_alloha_mal_';
    const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
    const cache = new Map();

    function allohaCfg() {
        return (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.alloha) || {};
    }

    function isLocalDevHost() {
        if (typeof window === 'undefined' || !window.location) return true;
        const h = window.location.hostname || '';
        return h === 'localhost' || h === '127.0.0.1' || window.location.protocol === 'file:';
    }

    function clientApiToken() {
        const t = allohaCfg().apiToken;
        return t && typeof t === 'string' && t.trim() ? t.trim() : '';
    }

    function proxyUrl() {
        const rel = allohaCfg().apiProxyUrl || '/.netlify/functions/alloha-proxy';
        if (/^https?:\/\//i.test(rel)) return rel;
        if (typeof window !== 'undefined' && window.location && window.location.origin) {
            return window.location.origin.replace(/\/$/, '') + (rel.startsWith('/') ? rel : '/' + rel);
        }
        return rel;
    }

    function useAllohaProxy() {
        if (clientApiToken()) return false;
        if (allohaCfg().useAllohaProxy === false) return false;
        return !isLocalDevHost();
    }

    function hasToken() {
        if (clientApiToken()) return true;
        return useAllohaProxy();
    }

    function usesProxy() {
        return useAllohaProxy();
    }

    function malFromAnime(anime) {
        if (!anime) return null;
        if (anime.mal_id != null) {
            const m = parseInt(anime.mal_id, 10);
            if (Number.isFinite(m) && m > 0) return m;
        }
        const raw = anime._jikanRaw;
        if (raw && raw.mal_id != null) {
            const m = parseInt(raw.mal_id, 10);
            if (Number.isFinite(m) && m > 0) return m;
        }
        const id = parseInt(anime.id, 10);
        if (Number.isFinite(id) && id >= 20000000) return id - 20000000;
        if (Number.isFinite(id) && id >= 10000000 && id < 20000000) return id - 10000000;
        return null;
    }

    function seasonFromAnime(anime) {
        if (!anime) return 1;
        const hint =
            typeof window.KodikCatalogResolve !== 'undefined' &&
            anime._kodik &&
            anime._kodik.season != null
                ? parseInt(anime._kodik.season, 10)
                : null;
        if (Number.isFinite(hint) && hint > 0) return hint;
        return 1;
    }

    async function requestLookup(params) {
        if (useAllohaProxy()) {
            const url = new URL(proxyUrl());
            Object.keys(params || {}).forEach((key) => {
                const v = params[key];
                if (v !== undefined && v !== null && String(v) !== '') {
                    url.searchParams.set(key, String(v));
                }
            });
            const res = await fetch(url.toString(), { method: 'GET', credentials: 'omit' });
            const text = await res.text();
            try {
                return text ? JSON.parse(text) : null;
            } catch (_) {
                return null;
            }
        }

        const token = clientApiToken();
        if (!token) return null;
        const url = new URL('https://api.alloha.tv/');
        url.searchParams.set('token', token);
        Object.keys(params || {}).forEach((key) => {
            const v = params[key];
            if (v !== undefined && v !== null && String(v) !== '') {
                url.searchParams.set(key, String(v));
            }
        });
        const res = await fetch(url.toString(), { method: 'GET', credentials: 'omit' });
        if (!res.ok) return null;
        try {
            return await res.json();
        } catch (_) {
            return null;
        }
    }

    function extractIframeBase(payload) {
        if (!payload || typeof payload !== 'object') return '';
        const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
        const iframe = data.iframe || data.iframe_url || data.player || '';
        return typeof iframe === 'string' ? iframe.trim() : '';
    }

    async function tryKinopoiskFromKodik(mal) {
        if (!window.KodikApi || typeof window.KodikApi.search !== 'function') return null;
        try {
            const data = await window.KodikApi.search({ shikimori_id: mal, limit: 5 });
            const results = (data && data.results) || [];
            for (const r of results) {
                const kp =
                    r.kinopoisk_id ||
                    r.kp_id ||
                    r.id_kp ||
                    (r.material_data && (r.material_data.kinopoisk_id || r.material_data.kp_id));
                const n = parseInt(kp, 10);
                if (Number.isFinite(n) && n > 0) return n;
            }
        } catch (_) {
            /* ignore */
        }
        return null;
    }

    async function fetchIframeBase(anime) {
        const mal = malFromAnime(anime);
        if (!mal) return '';

        const memKey = String(mal);
        if (cache.has(memKey)) return cache.get(memKey);

        let cached = '';
        try {
            const raw = sessionStorage.getItem(CACHE_PREFIX + mal);
            if (raw) {
                const o = JSON.parse(raw);
                if (Date.now() - o.ts < CACHE_TTL_MS && o.iframe) cached = o.iframe;
            }
        } catch (_) {
            /* ignore */
        }
        if (cached) {
            cache.set(memKey, cached);
            return cached;
        }

        const attempts = [{ shikimori: mal }, { mal }];
        const kp = await tryKinopoiskFromKodik(mal);
        if (kp) attempts.push({ kp });

        let iframeBase = '';
        for (const params of attempts) {
            const json = await requestLookup(params);
            iframeBase = extractIframeBase(json);
            if (iframeBase) break;
        }

        cache.set(memKey, iframeBase || '');
        try {
            sessionStorage.setItem(
                CACHE_PREFIX + mal,
                JSON.stringify({ ts: Date.now(), iframe: iframeBase || '' })
            );
        } catch (_) {
            /* ignore */
        }
        return iframeBase;
    }

    function buildIframeUrl(baseIframe, episode, season, startSeconds) {
        if (!baseIframe) return '';
        let u;
        try {
            u = new URL(baseIframe);
        } catch (_) {
            return baseIframe;
        }
        const ep = Math.max(1, parseInt(episode, 10) || 1);
        const sn = Math.max(1, parseInt(season, 10) || 1);
        u.searchParams.set('episode', String(ep));
        u.searchParams.set('season', String(sn));
        const t = Math.max(0, parseFloat(startSeconds) || 0);
        if (t > 0) u.searchParams.set('start', String(Math.floor(t)));
        return u.toString();
    }

    async function resolveEmbedUrl(anime, episode, opts) {
        if (!hasToken()) return '';
        const base = await fetchIframeBase(anime);
        if (!base) return '';
        const season = opts && opts.season != null ? opts.season : seasonFromAnime(anime);
        return buildIframeUrl(base, episode, season, opts && opts.startSeconds);
    }

    window.AllohaApi = {
        hasToken,
        usesProxy,
        malFromAnime,
        resolveEmbedUrl,
        buildIframeUrl,
        fetchIframeBase
    };
})();
