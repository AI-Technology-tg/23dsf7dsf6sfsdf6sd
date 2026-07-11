// Jikan REST API интеграция для получения постеров, описаний и другой информации об аниме и манге
// Jikan - неофициальный REST API для MyAnimeList
// Документация: https://docs.api.jikan.moe/

const JIKAN_API_BASE = 'https://api.jikan.moe/v4';
// Оптимизированный лимит: 1 запрос в 1.5 сек (Jikan v4 позволяет 3 req/sec)
const JIKAN_MIN_DELAY_MS = 1500;
const JIKAN_429_BACKOFF_MS = 30000; // при 429 ждём 30 сек

// Кэш для запросов (в памяти)
const jikanCache = new Map();
const JIKAN_CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 дней

// localStorage кэш для постеров (быстрый доступ при перезагрузке)
const POSTER_CACHE_KEY = 'jikan_poster_cache';
const POSTER_CACHE_VERSION = 2;

// Глобальная очередь: только один запрос в момент времени
const jikanRequestQueue = [];
let jikanLastRequestTime = 0;
let jikanWorkerRunning = false;
let jikanBlockedUntil = 0; // после 429 не слать запросы до этого времени

/**
 * Получить кэш постеров из localStorage
 * @returns {Object} Кэш постеров
 */
function getPosterCache() {
    try {
        const data = localStorage.getItem(POSTER_CACHE_KEY);
        if (!data) return { version: POSTER_CACHE_VERSION, posters: {} };
        const cache = JSON.parse(data);
        if (cache.version !== POSTER_CACHE_VERSION) {
            localStorage.removeItem(POSTER_CACHE_KEY);
            return { version: POSTER_CACHE_VERSION, posters: {} };
        }
        return cache;
    } catch (e) {
        return { version: POSTER_CACHE_VERSION, posters: {} };
    }
}

/**
 * Сохранить постер в localStorage кэш
 * @param {string} title - Название
 * @param {string} posterUrl - URL постера
 */
function savePosterToCache(title, posterUrl) {
    if (!title || !posterUrl) return;
    try {
        const cache = getPosterCache();
        const key = title.toLowerCase().trim();
        cache.posters[key] = {
            url: posterUrl,
            ts: Date.now()
        };
        // Ограничиваем размер кэша (макс 500 постеров)
        const keys = Object.keys(cache.posters);
        if (keys.length > 500) {
            const sorted = keys.sort((a, b) => cache.posters[a].ts - cache.posters[b].ts);
            sorted.slice(0, 100).forEach(k => delete cache.posters[k]);
        }
        localStorage.setItem(POSTER_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        // Игнорируем ошибки кэша
    }
}

/**
 * Получить постер из localStorage кэша
 * @param {string} title - Название
 * @returns {string|null} URL постера или null
 */
function getPosterFromCache(title) {
    if (!title) return null;
    try {
        const cache = getPosterCache();
        const key = title.toLowerCase().trim();
        const entry = cache.posters[key];
        if (entry && entry.url) {
            // Проверяем срок годности (30 дней)
            if (Date.now() - entry.ts < JIKAN_CACHE_DURATION) {
                return entry.url;
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Нормализовать название для поиска
 * @param {string} title - Название
 * @returns {string} Нормализованное название
 */
function normalizeTitle(title) {
    if (!title || typeof title !== 'string') return '';
    return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Выполнить один HTTP-запрос к Jikan (без очереди)
 * @param {string} endpoint - Endpoint API
 * @returns {Promise<Object|null>} Ответ API или null при 429 после повторной попытки
 */
async function jikanFetchOne(endpoint) {
    const url = `${JIKAN_API_BASE}${endpoint}`;
    if (typeof window.reminkoJikanFetch === 'function') {
        try {
            return await window.reminkoJikanFetch(url);
        } catch (e) {
            const st = e && e.status;
            if (st === 429) {
                jikanBlockedUntil = Date.now() + JIKAN_429_BACKOFF_MS;
            }
            if (st === 429 || st === 503 || st === 502 || st === 504) return null;
            throw e;
        }
    }
    const response = await fetch(url);
    if (response.ok) {
        return await response.json();
    }
    if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter ? Math.min(60000, parseInt(retryAfter, 10) * 1000) : JIKAN_429_BACKOFF_MS;
        jikanBlockedUntil = Date.now() + waitMs;
        await new Promise(r => setTimeout(r, waitMs));
        const retry = await fetch(url);
        if (retry.ok) {
            return await retry.json();
        }
        return null;
    }
    if (response.status === 503 || response.status === 502 || response.status === 504) {
        return null;
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}

/**
 * Обработчик очереди: по одному запросу с паузой
 */
async function jikanProcessQueue() {
    if (jikanWorkerRunning || jikanRequestQueue.length === 0) return;
    jikanWorkerRunning = true;
    while (jikanRequestQueue.length > 0) {
        const now = Date.now();
        if (now < jikanBlockedUntil) {
            await new Promise(r => setTimeout(r, jikanBlockedUntil - now));
        }
        const delay = JIKAN_MIN_DELAY_MS - (Date.now() - jikanLastRequestTime);
        if (delay > 0) {
            await new Promise(r => setTimeout(r, delay));
        }
        const item = jikanRequestQueue.shift();
        if (!item) continue;
        jikanLastRequestTime = Date.now();
        try {
            const data = await jikanFetchOne(item.endpoint);
            if (data !== null) {
                jikanCache.set(item.cacheKey, { data, timestamp: Date.now() });
            }
            item.resolve(data);
        } catch (err) {
            item.reject(err);
        }
    }
    jikanWorkerRunning = false;
}

/**
 * Выполнить запрос к Jikan API (через очередь, один за раз)
 * @param {string} endpoint - Endpoint API
 * @returns {Promise<Object|null>} Ответ API
 */
function jikanRequest(endpoint) {
    const cacheKey = endpoint;
    const now = Date.now();
    if (jikanCache.has(cacheKey)) {
        const cached = jikanCache.get(cacheKey);
        if (now - cached.timestamp < JIKAN_CACHE_DURATION) {
            return Promise.resolve(cached.data);
        }
        jikanCache.delete(cacheKey);
    }
    return new Promise((resolve, reject) => {
        jikanRequestQueue.push({ endpoint, cacheKey, resolve, reject });
        jikanProcessQueue();
    });
}

/**
 * Упростить название для повторного поиска (убрать сезоны, фильмы, подзаголовки)
 * @param {string} title - Название
 * @returns {string|null} Упрощённое название или null если нечего отрезать
 */
function simplifySearchTitle(title) {
    if (!title || typeof title !== 'string') return null;
    let s = title.trim();
    // Убрать подзаголовки после ":" или " - " (например "One Piece: New Era" -> "One Piece")
    const colon = s.indexOf(':');
    if (colon > 1) {
        s = s.substring(0, colon).trim();
        if (s.length >= 2) return s;
    }
    const dash = s.indexOf(' - ');
    if (dash > 1) {
        s = s.substring(0, dash).trim();
        if (s.length >= 2) return s;
    }
    // Убрать суффиксы в скобках: " (Redraw)", " (Webcomic)"
    const openParen = s.indexOf(' (');
    if (openParen > 1) {
        s = s.substring(0, openParen).trim();
        if (s.length >= 2) return s;
    }
    // Убрать " Movie", " Season 2", " Part 2"
    const movie = s.replace(/\s+Movie\s*$/i, '').trim();
    if (movie.length >= 2 && movie !== s) return movie;
    const season = s.replace(/\s+Season\s+\d+.*$/i, '').trim();
    if (season.length >= 2 && season !== s) return season;
    const part = s.replace(/\s+Part\s+\d+.*$/i, '').trim();
    if (part.length >= 2 && part !== s) return part;
    return null;
}

/**
 * Поиск аниме по названию
 * @param {string} title - Название аниме
 * @returns {Promise<Object|null>} Данные аниме или null
 */
async function jikanSearchAnime(title) {
    if (!title || typeof title !== 'string') return null;
    
    try {
        const endpoint = `/anime?q=${encodeURIComponent(title)}&limit=1`;
        const response = await jikanRequest(endpoint);
        if (response && response.data && response.data.length > 0) {
            return response.data[0];
        }
        const simplified = simplifySearchTitle(title);
        if (simplified && simplified !== title) {
            const fallbackEndpoint = `/anime?q=${encodeURIComponent(simplified)}&limit=1`;
            const fallback = await jikanRequest(fallbackEndpoint);
            if (fallback && fallback.data && fallback.data.length > 0) {
                return fallback.data[0];
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Несколько результатов поиска аниме по названию (для выбора пользователем)
 * @param {string} title
 * @param {number} [limit=12]
 * @returns {Promise<Array>}
 */
async function jikanSearchAnimeMany(title, limit = 12) {
    if (!title || typeof title !== 'string') return [];
    const lim = Math.min(25, Math.max(1, parseInt(limit, 10) || 12));
    const q = title.trim();
    if (!q) return [];

    async function runQuery(searchStr) {
        const endpoint = `/anime?q=${encodeURIComponent(searchStr)}&limit=${lim}`;
        const response = await jikanRequest(endpoint);
        const data = response && response.data;
        return Array.isArray(data) ? data : [];
    }

    try {
        let list = await runQuery(q);
        if (list.length === 0) {
            const simplified = simplifySearchTitle(q);
            if (simplified && simplified !== q) {
                list = await runQuery(simplified);
            }
        }
        return list;
    } catch (error) {
        return [];
    }
}

/**
 * Полная карточка аниме по MAL id (для надёжного сохранения в каталог)
 * @param {number|string} malId
 * @returns {Promise<Object|null>} Объект anime из Jikan или null
 */
async function jikanFetchAnimeFullByMalId(malId) {
    const id =
        typeof window.reminkoNormalizeMalId === 'function'
            ? window.reminkoNormalizeMalId(malId)
            : parseInt(malId, 10);
    if (!id || Number.isNaN(id)) return null;
    try {
        const r = await jikanRequest(`/anime/${id}/full`);
        return r && r.data ? r.data : null;
    } catch (error) {
        return null;
    }
}

/**
 * Постер аниме по MAL id (лёгкий запрос /anime/{id}, через общую очередь Jikan).
 * @param {number|string} malId
 * @returns {Promise<string|null>}
 */
async function jikanFetchPosterByMalId(malId) {
    const id =
        typeof window.reminkoNormalizeMalId === 'function'
            ? window.reminkoNormalizeMalId(malId)
            : parseInt(malId, 10);
    if (!id || Number.isNaN(id)) return null;
    try {
        const r = await jikanRequest(`/anime/${id}`);
        const data = r && r.data ? r.data : null;
        if (!data) return null;
        return (
            data.images?.jpg?.small_image_url ||
            data.images?.jpg?.image_url ||
            data.images?.jpg?.large_image_url ||
            null
        );
    } catch (error) {
        return null;
    }
}

/**
 * Поиск манги по названию
 * @param {string} title - Название манги
 * @returns {Promise<Object|null>} Данные манги или null
 */
async function jikanSearchManga(title) {
    if (!title || typeof title !== 'string') return null;
    
    try {
        const endpoint = `/manga?q=${encodeURIComponent(title)}&limit=1`;
        const response = await jikanRequest(endpoint);
        if (response && response.data && response.data.length > 0) {
            return response.data[0];
        }
        const simplified = simplifySearchTitle(title);
        if (simplified && simplified !== title) {
            const fallbackEndpoint = `/manga?q=${encodeURIComponent(simplified)}&limit=1`;
            const fallback = await jikanRequest(fallbackEndpoint);
            if (fallback && fallback.data && fallback.data.length > 0) {
                return fallback.data[0];
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Получить данные аниме (постер, описание и т.д.)
 * @param {string|Array<string>} title - Название аниме или массив названий
 * @returns {Promise<Object>} Данные аниме
 */
async function getAnimeDetails(title) {
    // Поддерживаем массив названий
    if (Array.isArray(title)) {
        // Сначала проверяем кэш для всех названий
        for (const t of title) {
            if (!t) continue;
            const cached = getPosterFromCache(t);
            if (cached) {
                return { poster: cached, description: null, genres: null, status: null, year: null, episodes: null, author: null, score: null, rating: null };
            }
        }
        // Если нет в кэше - запрашиваем
        for (const t of title) {
            if (!t) continue;
            const result = await getAnimeDetails(t);
            if (result && result.poster) {
                return result;
            }
        }
        return await getAnimeDetails(title[0] || '');
    }
    
    if (!title || typeof title !== 'string') {
        return {
            poster: null,
            description: null,
            genres: null,
            status: null,
            year: null,
            episodes: null,
            author: null,
            score: null,
            rating: null
        };
    }
    
    // Проверяем localStorage кэш
    const cachedPoster = getPosterFromCache(title);
    if (cachedPoster) {
        return {
            poster: cachedPoster,
            description: null,
            genres: null,
            status: null,
            year: null,
            episodes: null,
            author: null,
            score: null,
            rating: null
        };
    }
    
    try {
        const anime = await jikanSearchAnime(title);
        
        if (!anime) {
            return {
                poster: null,
                description: null,
                genres: null,
                status: null,
                year: null,
                episodes: null,
                author: null,
                score: null,
                rating: null
            };
        }
        
        // Преобразуем данные Jikan в наш формат
        const posterUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || null;
        
        // Сохраняем постер в кэш
        if (posterUrl) {
            savePosterToCache(title, posterUrl);
        }
        
        const result = {
            poster: posterUrl,
            description: anime.synopsis || null,
            genres: anime.genres?.map(g => g.name) || [],
            status: anime.status || null,
            year: anime.year || (anime.aired?.from ? new Date(anime.aired.from).getFullYear() : null),
            episodes: anime.episodes || null,
            author: null, // Для аниме это студии
            studios: anime.studios?.map(s => s.name) || [],
            score: anime.score || null,
            rating: anime.rating || null,
            type: anime.type || null,
            source: anime.source || null,
            duration: anime.duration || null,
            malId: anime.mal_id || null
        };
        
        return result;
    } catch (error) {
        return {
            poster: null,
            description: null,
            genres: null,
            status: null,
            year: null,
            episodes: null,
            author: null,
            score: null,
            rating: null
        };
    }
}

/**
 * Получить данные манги (обложка, описание и т.д.)
 * @param {string|Array<string>} title - Название манги или массив названий
 * @returns {Promise<Object>} Данные манги
 */
async function getMangaDetails(title) {
    // Поддерживаем массив названий
    if (Array.isArray(title)) {
        // Сначала проверяем кэш
        for (const t of title) {
            if (!t) continue;
            const cached = getPosterFromCache('manga_' + t);
            if (cached) {
                return { cover: cached, description: null, genres: null, chapters: null, author: null, status: null, score: null, rating: null };
            }
        }
        for (const t of title) {
            if (!t) continue;
            const result = await getMangaDetails(t);
            if (result && result.cover) {
                return result;
            }
        }
        return await getMangaDetails(title[0] || '');
    }
    
    if (!title || typeof title !== 'string') {
        return {
            cover: null,
            description: null,
            genres: null,
            chapters: null,
            author: null,
            status: null,
            score: null,
            rating: null
        };
    }
    
    // Проверяем localStorage кэш
    const cachedCover = getPosterFromCache('manga_' + title);
    if (cachedCover) {
        return {
            cover: cachedCover,
            description: null,
            genres: null,
            chapters: null,
            author: null,
            status: null,
            score: null,
            rating: null
        };
    }
    
    try {
        const manga = await jikanSearchManga(title);
        
        if (!manga) {
            return {
                cover: null,
                description: null,
                genres: null,
                chapters: null,
                author: null,
                status: null,
                score: null,
                rating: null
            };
        }
        
        const coverUrl = manga.images?.jpg?.large_image_url || manga.images?.jpg?.image_url || null;
        
        // Сохраняем в кэш
        if (coverUrl) {
            savePosterToCache('manga_' + title, coverUrl);
        }
        
        // Преобразуем данные Jikan в наш формат
        const result = {
            cover: coverUrl,
            description: manga.synopsis || null,
            genres: manga.genres?.map(g => g.name) || [],
            chapters: manga.chapters || null,
            author: manga.authors?.map(a => a.name).join(', ') || null,
            status: manga.status || null,
            score: manga.score || null,
            rating: manga.rating || null,
            type: manga.type || null,
            volumes: manga.volumes || null,
            malId: manga.mal_id || null
        };
        
        return result;
    } catch (error) {
        return {
            cover: null,
            description: null,
            genres: null,
            chapters: null,
            author: null,
            status: null,
            score: null,
            rating: null
        };
    }
}

/**
 * Получить постер аниме
 * @param {string|Array<string>} title - Название аниме или массив названий
 * @param {Object} options - Опции (игнорируются)
 * @returns {Promise<string|null>} URL постера или null
 */
async function getAnimePoster(title, options = {}) {
    const details = await getAnimeDetails(title);
    return details?.poster || null;
}

/**
 * Получить обложку манги
 * @param {string|Array<string>} title - Название манги или массив названий
 * @param {Object} options - Опции (игнорируются)
 * @returns {Promise<string|null>} URL обложки или null
 */
async function getMangaPoster(title, options = {}) {
    const details = await getMangaDetails(title);
    return details?.cover || null;
}

/**
 * Получить описание для аниме/манги
 * @param {string} title - Название
 * @param {string} type - Тип: 'anime' или 'manga'
 * @param {Object} options - Опции (игнорируются)
 * @returns {Promise<string|null>} Описание или null
 */
async function getContentDescription(title, type = 'anime', options = {}) {
    if (type === 'anime') {
        const details = await getAnimeDetails(title);
        return details?.description || null;
    } else {
        const details = await getMangaDetails(title);
        return details?.description || null;
    }
}

/**
 * Предзагрузить постеры для списка аниме
 * @param {Array} animeList - Массив объектов аниме с полем title
 * @returns {Promise<Object>} Объект с постерами {title: url}
 */
async function preloadAnimePosters(animeList) {
    const posters = {};
    
    if (!animeList || !Array.isArray(animeList)) {
        return posters;
    }
    
    // Загружаем постеры с задержкой между запросами
    for (const anime of animeList) {
        if (anime && anime.title) {
            try {
                const poster = await getAnimePoster(anime.title);
                if (poster) {
                    posters[anime.title] = poster;
                }
                // Увеличенная задержка между запросами для избежания 429
                await new Promise(resolve => setTimeout(resolve, 600));
            } catch (error) {
                // Игнорируем ошибки для отдельных постеров
                // Но делаем задержку даже при ошибке
                await new Promise(resolve => setTimeout(resolve, 600));
            }
        }
    }
    
    return posters;
}

/**
 * Очистить кэш Jikan
 */
function clearJikanCache() {
    jikanCache.clear();
}

// Экспортируем функции глобально с префиксом jikan для избежания конфликтов
if (typeof window !== 'undefined') {
    window.jikanGetAnimeDetails = getAnimeDetails;
    window.jikanGetMangaDetails = getMangaDetails;
    window.jikanGetAnimePoster = getAnimePoster;
    window.jikanGetMangaPoster = getMangaPoster;
    window.jikanGetContentDescription = getContentDescription;
    window.jikanPreloadAnimePosters = preloadAnimePosters;
    window.jikanSearchAnime = jikanSearchAnime;
    window.jikanSearchAnimeMany = jikanSearchAnimeMany;
    window.jikanFetchAnimeFullByMalId = jikanFetchAnimeFullByMalId;
    window.jikanFetchPosterByMalId = jikanFetchPosterByMalId;
    window.jikanGetPosterFromCache = getPosterFromCache;
    window.jikanSearchManga = jikanSearchManga;
    window.clearJikanCache = clearJikanCache;
    
    // Также экспортируем без префикса для обратной совместимости (но с проверкой)
    // Эти функции будут использоваться как основной источник, если доступны
    if (!window.getAnimeDetails) {
        window.getAnimeDetails = getAnimeDetails;
    }
    if (!window.getMangaDetails) {
        window.getMangaDetails = getMangaDetails;
    }
    if (!window.getAnimePoster) {
        window.getAnimePoster = getAnimePoster;
    }
    if (!window.getMangaPoster) {
        window.getMangaPoster = getMangaPoster;
    }
    if (!window.getContentDescription) {
        window.getContentDescription = getContentDescription;
    }
    if (!window.preloadAnimePosters) {
        window.preloadAnimePosters = preloadAnimePosters;
    }
}

/** Мета текущего сезона Jikan (без автопереводчика) */
function getJikanSeasonMeta(d) {
    const now = d instanceof Date ? d : new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    let season;
    let labelRu;
    if (m === 1 || m === 2 || m === 3) {
        season = 'winter';
        labelRu = 'Зима';
    } else if (m >= 4 && m <= 6) {
        season = 'spring';
        labelRu = 'Весна';
    } else if (m >= 7 && m <= 9) {
        season = 'summer';
        labelRu = 'Лето';
    } else {
        season = 'fall';
        labelRu = 'Осень';
    }
    return { year: y, season, labelRu, seasonKey: `${y}-${season}` };
}

function filterJikanUpcomingOnly(list) {
    if (!Array.isArray(list)) return [];
    const now = Date.now();
    const MIN_KEEP = 6;
    const baseOk = (a) => {
        if (!a || !a.mal_id) return false;
        if (a.airing === true) return false;
        const st = String(a.status || '').trim();
        return st !== 'Finished Airing' && st !== 'Currently Airing';
    };
    const strict = list.filter((a) => {
        if (!baseOk(a)) return false;
        const st = String(a.status || '').trim();
        if (st !== 'Not yet aired') return false;
        if (a.aired && a.aired.from) {
            const t = new Date(a.aired.from).getTime();
            if (!Number.isNaN(t) && t <= now) return false;
        }
        return true;
    });
    if (strict.length >= MIN_KEEP) return strict;
    const loose = list.filter((a) => {
        if (!baseOk(a)) return false;
        const st = String(a.status || '').trim();
        if (st === 'Not yet aired') {
            if (a.aired && a.aired.from) {
                const t = new Date(a.aired.from).getTime();
                if (!Number.isNaN(t) && t <= now) return false;
            }
            return true;
        }
        if (a.aired && a.aired.from) {
            const t = new Date(a.aired.from).getTime();
            if (!Number.isNaN(t) && t > now) return true;
        }
        return !st || st === 'Not yet aired';
    });
    const merged = [];
    const seen = new Set();
    for (const x of strict.concat(loose)) {
        if (!x || !x.mal_id) continue;
        if (seen.has(x.mal_id)) continue;
        seen.add(x.mal_id);
        merged.push(x);
    }
    return merged.length >= MIN_KEEP ? merged : list.filter(baseOk);
}

if (typeof window !== 'undefined') {
    window.getJikanSeasonMeta = getJikanSeasonMeta;
    window.filterJikanUpcomingOnly = filterJikanUpcomingOnly;
}
