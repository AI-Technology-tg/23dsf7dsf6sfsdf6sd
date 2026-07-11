// Jikan REST API интеграция для получения дополнительных метаданных (постеры, описания)
// Используется Jikan API вместо AniList
// Локальные данные не заменяются

// Ключи для localStorage кэша
const ANIME_CACHE_KEY = 'animeDetailsCache';
const MANGA_CACHE_KEY = 'mangaDetailsCache';
const API_DETAILS_CACHE_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

// Память кэш (Map) для быстрого доступа
const animeCache = new Map();
const mangaCache = new Map();

/**
 * Очистить HTML теги из описания
 * @param {string} html - HTML текст
 * @returns {string} Текст без HTML тегов
 */
function stripHtmlTags(html) {
    if (!html) return null;
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || null;
}

/**
 * Нормализовать название для кэша
 * @param {string} title - Название
 * @returns {string} Нормализованное название
 */
function normalizeTitle(title) {
    if (!title || typeof title !== 'string') return '';
    return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Получить кэш из localStorage
 * @param {string} cacheKey - Ключ кэша
 * @returns {Object} Кэш
 */
function getCache(cacheKey) {
    try {
        const cacheStr = localStorage.getItem(cacheKey);
        if (!cacheStr) return {};
        const cache = JSON.parse(cacheStr);
        // Удаляем устаревшие записи
        const now = Date.now();
        Object.keys(cache).forEach(key => {
            if (cache[key].timestamp && (now - cache[key].timestamp) > API_DETAILS_CACHE_MS) {
                delete cache[key];
            }
        });
        return cache;
    } catch (error) {
        return {};
    }
}

/**
 * Сохранить в кэш localStorage
 * @param {string} cacheKey - Ключ кэша
 * @param {string} title - Название
 * @param {Object} data - Данные для кэширования
 */
function setCache(cacheKey, title, data) {
    try {
        const normalizedTitle = normalizeTitle(title);
        const cache = getCache(cacheKey);
        cache[normalizedTitle] = {
            ...data,
            timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cache));
    } catch (error) {
        // Игнорируем ошибки кэша
    }
}

/**
 * Получить данные аниме из AniList API
 * @param {string|Array<string>} title - Название аниме или массив названий
 * @returns {Promise<Object>} Данные аниме
 */
async function getAnimeDetails(title) {
    // Поддерживаем массив названий
    if (Array.isArray(title)) {
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
            author: null
        };
    }
    
    const normalizedTitle = normalizeTitle(title);
    
    // Проверяем память кэш
    if (animeCache.has(normalizedTitle)) {
        return animeCache.get(normalizedTitle);
    }
    
    // Проверяем localStorage кэш
    const cache = getCache(ANIME_CACHE_KEY);
    if (cache[normalizedTitle]) {
        const cached = cache[normalizedTitle];
        delete cached.timestamp; // Убираем timestamp из результата
        animeCache.set(normalizedTitle, cached);
        return cached;
    }
    
    // Запрос к AniList API
    const query = `
        query ($search: String) {
            Media(search: $search, type: ANIME) {
                description
                genres
                status
                episodes
                startDate { year }
                coverImage { extraLarge }
                studios(isMain: true) {
                    nodes { name }
                }
            }
        }
    `;
    
    try {
        // Приоритет 1: Используем Jikan API если доступен
        if (typeof window !== 'undefined' && window.jikanGetAnimeDetails) {
            try {
                const jikanResult = await window.jikanGetAnimeDetails(title);
                if (jikanResult && jikanResult.poster) {
                    setCache(ANIME_CACHE_KEY, title, jikanResult);
                    animeCache.set(normalizedTitle, jikanResult);
                    return jikanResult;
                }
            } catch (jikanError) {
                // Jikan не сработал, пробуем другие источники
            }
        }
        
        // Приоритет 2: Пробуем другие API (если есть)
        // Здесь можно добавить другие источники данных
        
        // Fallback на результат по умолчанию
        const result = getDefaultAnimeResult();
        setCache(ANIME_CACHE_KEY, title, result);
        return result;
    } catch (error) {
        // Не логируем ошибки
        return getDefaultAnimeResult();
    }
}

/**
 * Получить данные манги из AniList API
 * @param {string|Array<string>} title - Название манги или массив названий
 * @returns {Promise<Object>} Данные манги
 */
async function getMangaDetails(title) {
    // Поддерживаем массив названий
    if (Array.isArray(title)) {
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
            status: null
        };
    }
    
    const normalizedTitle = normalizeTitle(title);
    
    // Проверяем память кэш
    if (mangaCache.has(normalizedTitle)) {
        return mangaCache.get(normalizedTitle);
    }
    
    // Проверяем localStorage кэш
    const cache = getCache(MANGA_CACHE_KEY);
    if (cache[normalizedTitle]) {
        const cached = cache[normalizedTitle];
        delete cached.timestamp; // Убираем timestamp из результата
        mangaCache.set(normalizedTitle, cached);
        return cached;
    }
    
    // Запрос к AniList API
    const query = `
        query ($search: String) {
            Media(search: $search, type: MANGA) {
                description
                genres
                status
                chapters
                coverImage { extraLarge }
                staff {
                    edges {
                        role
                        node { name { full } }
                    }
                }
            }
        }
    `;
    
    try {
        // Приоритет 1: Используем Jikan API если доступен
        if (typeof window !== 'undefined' && window.jikanGetMangaDetails) {
            try {
                const jikanResult = await window.jikanGetMangaDetails(title);
                if (jikanResult && jikanResult.cover) {
                    setCache(MANGA_CACHE_KEY, title, jikanResult);
                    mangaCache.set(normalizedTitle, jikanResult);
                    return jikanResult;
                }
            } catch (jikanError) {
                // Jikan не сработал, пробуем другие источники
            }
        }
        
        // Приоритет 2: Пробуем другие API (если есть)
        // Здесь можно добавить другие источники данных
        
        // Fallback на результат по умолчанию
        const result = getDefaultMangaResult();
        setCache(MANGA_CACHE_KEY, title, result);
        return result;
    } catch (error) {
        // Не логируем ошибки
        return getDefaultMangaResult();
    }
}

/**
 * Получить результат по умолчанию для аниме
 * @returns {Object} Результат по умолчанию
 */
function getDefaultAnimeResult() {
    return {
        poster: null,
        description: null,
        genres: null,
        status: null,
        year: null,
        episodes: null,
        author: null
    };
}

/**
 * Получить результат по умолчанию для манги
 * @returns {Object} Результат по умолчанию
 */
function getDefaultMangaResult() {
    return {
        cover: null,
        description: null,
        genres: null,
        chapters: null,
        author: null,
        status: null
    };
}

/**
 * Очистить кэш аниме
 */
function clearAnimeCache() {
    try {
        animeCache.clear();
        localStorage.removeItem(ANIME_CACHE_KEY);
    } catch (error) {
        // Игнорируем ошибки
    }
}

/**
 * Очистить кэш манги
 */
function clearMangaCache() {
    try {
        mangaCache.clear();
        localStorage.removeItem(MANGA_CACHE_KEY);
    } catch (error) {
        // Игнорируем ошибки
    }
}

// Экспортируем функции глобально
if (typeof window !== 'undefined') {
    window.getAnimeDetails = getAnimeDetails;
    window.getMangaDetails = getMangaDetails;
    window.clearAnimeCache = clearAnimeCache;
    window.clearMangaCache = clearMangaCache;
}
