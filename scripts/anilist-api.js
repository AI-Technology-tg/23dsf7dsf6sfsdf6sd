// Jikan API интеграция для получения постеров
// Используется Jikan REST API для загрузки постеров и обложек

// Placeholder изображение (используется если постер не найден)
const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect width="300" height="400" fill="%23444"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="20" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';

/**
 * Получить постер аниме через Jikan API
 * @param {string|Array<string>} title - Название аниме или массив названий
 * @param {Object} options - Опции (игнорируются)
 * @returns {Promise<string>} URL постера или placeholder
 */
async function getAnimePoster(title, options = {}) {
    try {
        // Приоритет 1: Используем Jikan API если доступен
        if (typeof window !== 'undefined' && window.jikanGetAnimePoster) {
            try {
                const poster = await window.jikanGetAnimePoster(title, options);
                if (poster && poster !== PLACEHOLDER_IMAGE) {
                    return poster;
                }
            } catch (jikanError) {
                // Jikan не сработал, пробуем другие источники
            }
        }
        
        // Приоритет 2: Пробуем другие API (если есть)
        // Здесь можно добавить другие источники постеров
        
    } catch (error) {
        // Игнорируем ошибки
    }
    
    return PLACEHOLDER_IMAGE;
}

/**
 * Получить постер манги через Jikan API
 * @param {string|Array<string>} title - Название манги или массив названий
 * @param {Object} options - Опции (игнорируются)
 * @returns {Promise<string>} URL обложки или placeholder
 */
async function getMangaPoster(title, options = {}) {
    try {
        // Приоритет 1: Используем Jikan API если доступен
        if (typeof window !== 'undefined' && window.jikanGetMangaPoster) {
            try {
                const poster = await window.jikanGetMangaPoster(title, options);
                if (poster && poster !== PLACEHOLDER_IMAGE) {
                    return poster;
                }
            } catch (jikanError) {
                // Jikan не сработал, пробуем другие источники
            }
        }
        
        // Приоритет 2: Пробуем другие API (если есть)
        // Здесь можно добавить другие источники обложек
        
    } catch (error) {
        // Игнорируем ошибки
    }
    
    return PLACEHOLDER_IMAGE;
}

/**
 * Получить данные из альтернативного источника. Не используется — постеры через Jikan.
 * @returns {Promise<null>}
 */
async function getContentDataFromAlternativeSource() {
    return null;
}

/**
 * Получить описание для аниме/манги через Jikan API
 * @param {string} title - Название
 * @param {string} type - Тип: 'anime' или 'manga'
 * @param {Object} options - Опции (игнорируются)
 * @returns {Promise<string|null>} Описание или null
 */
async function getContentDescription(title, type = 'anime', options = {}) {
    try {
        // Приоритет 1: Используем Jikan API если доступен
        if (typeof window !== 'undefined' && window.jikanGetContentDescription) {
            try {
                const description = await window.jikanGetContentDescription(title, type, options);
                if (description) {
                    return description;
                }
            } catch (jikanError) {
                // Jikan не сработал, пробуем другие источники
            }
        }
        
        // Приоритет 2: Пробуем другие API (если есть)
        // Здесь можно добавить другие источники описаний
        
    } catch (error) {
        // Игнорируем ошибки
    }
    
    return null;
}

/**
 * Предзагрузить постеры. Не используется — постеры загружаются через Jikan по требованию.
 * @returns {Promise<Object>} Пустой объект
 */
async function preloadAnimePosters() {
    return {};
}

/**
 * Очистить кэш постеров (заглушка)
 */
function clearPosterCache() {
    // Кэш не используется - функция оставлена для совместимости
}

/**
 * Очистить кэш описаний (заглушка)
 */
function clearDescriptionCache() {
    // Кэш не используется - функция оставлена для совместимости
}

// Экспортируем функции для использования в других скриптах
if (typeof window !== 'undefined') {
    window.getAnimePoster = getAnimePoster;
    window.getMangaPoster = getMangaPoster;
    window.getContentDescription = getContentDescription;
    window.getContentDataFromAlternativeSource = getContentDataFromAlternativeSource;
    window.preloadAnimePosters = preloadAnimePosters;
    window.clearPosterCache = clearPosterCache;
    window.clearDescriptionCache = clearDescriptionCache;
}
