/**
 * Shikimori.one API — русские названия, описания, серии (episodes_aired).
 * Очередь 1 + пауза между запросами + последовательная проверка кандидатов (без параллельного шторма).
 */
(function () {
    const SHIKI_BASE = 'https://shikimori.one/api';
    const CACHE_PREFIX = 'reminko_shiki_mal_';
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
    /** Одновременно только одна «задача» fetchShikimoriByMalId */
    const MAX_QUEUE = 1;
    const MIN_GAP_MS = 550;
    let active = 0;
    const waiters = [];
    let lastRequestAt = 0;

    function shikiHeaders() {
        return { Accept: 'application/json' };
    }

    async function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    async function shikiFetch(path, attempt = 0) {
        const now = Date.now();
        const gapWait = Math.max(0, MIN_GAP_MS - (now - lastRequestAt));
        if (gapWait) await sleep(gapWait);
        lastRequestAt = Date.now();

        const res = await fetch(`${SHIKI_BASE}${path}`, { headers: shikiHeaders() });

        if (res.status === 429 && attempt < 6) {
            const ra = parseInt(res.headers.get('Retry-After') || '', 10);
            const base = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2500;
            await sleep(base + attempt * 800);
            lastRequestAt = 0;
            return shikiFetch(path, attempt + 1);
        }

        if (!res.ok) return null;
        return res.json();
    }

    function stripHtml(html) {
        if (!html) return '';
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return (tmp.textContent || tmp.innerText || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function runQueue() {
        while (active < MAX_QUEUE && waiters.length) {
            const job = waiters.shift();
            active++;
            Promise.resolve(job.fn())
                .then(job.resolve, job.reject)
                .finally(() => {
                    active--;
                    runQueue();
                });
        }
    }

    function enqueueShikiTask(fn) {
        return new Promise((resolve, reject) => {
            waiters.push({ fn, resolve, reject });
            runQueue();
        });
    }

    function readCache(malId) {
        try {
            const raw = sessionStorage.getItem(CACHE_PREFIX + malId);
            if (!raw) return null;
            const o = JSON.parse(raw);
            if (Date.now() - o.ts > CACHE_TTL_MS) {
                sessionStorage.removeItem(CACHE_PREFIX + malId);
                return null;
            }
            return o.data;
        } catch {
            return null;
        }
    }

    function writeCache(malId, data) {
        try {
            sessionStorage.setItem(CACHE_PREFIX + malId, JSON.stringify({ ts: Date.now(), data }));
        } catch {
            /* ignore */
        }
    }

    /**
     * Полный объект Shikimori по mal_id: один поиск, затем по одному GET /animes/:id (без Promise.all).
     */
    async function fetchShikimoriByMalId(malId, searchTitle) {
        if (!malId) return null;
        const cached = readCache(malId);
        if (cached) return cached;

        const direct = await shikiFetch(`/animes/${malId}`);
        if (direct && direct.myanimelist_id === malId) {
            writeCache(malId, direct);
            return direct;
        }

        const q = encodeURIComponent((searchTitle || '').trim() || String(malId));
        const list = await shikiFetch(`/animes?search=${q}&limit=10`);
        if (!Array.isArray(list) || list.length === 0) {
            writeCache(malId, null);
            return null;
        }

        const maxCheck = Math.min(list.length, 6);
        for (let i = 0; i < maxCheck; i++) {
            const item = list[i];
            if (!item || !item.id) continue;
            const d = await shikiFetch(`/animes/${item.id}`);
            if (d && d.myanimelist_id === malId) {
                writeCache(malId, d);
                return d;
            }
        }

        writeCache(malId, null);
        return null;
    }

    function enqueueFetchShikimoriByMalId(malId, searchTitle) {
        return enqueueShikiTask(() => fetchShikimoriByMalId(malId, searchTitle));
    }

    /** Синхронно из кэша (sessionStorage) — для поиска по русскому названию без лишних запросов */
    function readCachedByMalId(malId) {
        if (!malId) return null;
        return readCache(malId);
    }

    /**
     * Поиск аниме по строке (в т.ч. русское название на Shikimori).
     * @param {string} query
     * @param {number} [limit]
     * @returns {Promise<Array>}
     */
    function searchAnimesByQuery(query, limit = 15) {
        const lim = Math.min(25, Math.max(1, parseInt(limit, 10) || 15));
        return enqueueShikiTask(async () => {
            const q = encodeURIComponent((query || '').trim());
            if (!q) return [];
            const list = await shikiFetch(`/animes?search=${q}&limit=${lim}`);
            return Array.isArray(list) ? list : [];
        });
    }

    function formatAiredTotal(jikanAnime, shiki) {
        const totalJ = jikanAnime.episodes;
        let aired = null;
        let total = totalJ != null && totalJ > 0 ? totalJ : null;

        if (shiki) {
            if (shiki.episodes_aired > 0) aired = shiki.episodes_aired;
            if (shiki.episodes > 0) total = shiki.episodes;
        }

        const q = '?';
        if (aired != null && total != null) return `${aired} / ${total} эп.`;
        if (aired != null) return `${aired} / ${total != null ? total : q} эп.`;
        if (total != null) return `${q} / ${total} эп.`;
        return '';
    }

    window.shikimoriApi = {
        fetchShikimoriByMalId,
        enqueueFetchShikimoriByMalId,
        readCachedByMalId,
        searchAnimesByQuery,
        stripHtml,
        formatAiredTotal
    };
})();
