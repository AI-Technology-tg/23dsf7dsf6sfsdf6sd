// Утилиты для работы с сетью и обработки ошибок

/**
 * Безопасный fetch с обработкой ошибок
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @param {number} retries - Количество попыток повтора
 * @returns {Promise<Response>}
 */
async function safeFetch(url, options = {}, retries = 3) {
    let lastError = null;
    
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд таймаут
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            lastError = error;
            
            // Если это ошибка сети и есть попытки - повторяем
            if (i < retries - 1 && (
                error.name === 'TypeError' || 
                error.name === 'NetworkError' ||
                error.message.includes('fetch') ||
                error.message.includes('network')
            )) {
                // Ждем перед повтором (экспоненциальная задержка)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                continue;
            }
            
            // Если это abort - не повторяем
            if (error.name === 'AbortError') {
                throw new Error('Запрос превысил время ожидания');
            }
            
            throw error;
        }
    }
    
    throw lastError || new Error('Неизвестная ошибка сети');
}

/**
 * Безопасный fetch с JSON ответом
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @returns {Promise<Object>}
 */
async function safeFetchJSON(url, options = {}) {
    try {
        const response = await safeFetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        return await response.json();
    } catch (error) {
        if (typeof logger !== 'undefined') {
            logger.error('Ошибка при получении JSON:', error);
        }
        throw error;
    }
}

/**
 * Обработка сетевых ошибок с понятными сообщениями
 * @param {Error} error - Ошибка
 * @returns {string} Понятное сообщение об ошибке
 */
function getNetworkErrorMessage(error) {
    if (!error) return 'Неизвестная ошибка';
    
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return 'Запрос превысил время ожидания. Проверьте подключение к интернету.';
    }
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return 'Ошибка сети. Проверьте подключение к интернету.';
    }
    
    if (error.message.includes('Failed to fetch')) {
        return 'Не удалось подключиться к серверу. Проверьте подключение к интернету.';
    }
    
    if (error.message.includes('HTTP error')) {
        const statusMatch = error.message.match(/status: (\d+)/);
        if (statusMatch) {
            const status = parseInt(statusMatch[1]);
            if (status === 404) return 'Ресурс не найден';
            if (status === 403) return 'Доступ запрещен';
            if (status === 401) return 'Требуется авторизация';
            if (status >= 500) return 'Ошибка сервера. Попробуйте позже.';
        }
        return 'Ошибка при запросе к серверу';
    }
    
    return error.message || 'Произошла ошибка при выполнении запроса';
}

// Экспортируем функции
window.safeFetch = safeFetch;
window.safeFetchJSON = safeFetchJSON;
window.getNetworkErrorMessage = getNetworkErrorMessage;
