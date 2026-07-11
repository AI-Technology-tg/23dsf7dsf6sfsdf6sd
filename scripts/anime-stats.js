// Система статистики аниме (рейтинги, просмотры, избранное)

// Инициализация статистики для аниме
function initAnimeStats(anime) {
    const statsKey = `anime_stats_${anime.id}`;
    let stats = JSON.parse(localStorage.getItem(statsKey) || 'null');
    
    if (!stats) {
        // Создаем начальную статистику
        stats = {
            rating: anime.rating || 0,
            ratingCount: Math.floor(Math.random() * 5000) + 100, // 100-5100
            views: Math.floor(Math.random() * 50000) + 1000, // 1000-51000
            favoritesCount: Math.floor(Math.random() * 500) + 10 // 10-510
        };
        localStorage.setItem(statsKey, JSON.stringify(stats));
    }
    
    return { ...anime, ...stats };
}

// Получить статистику аниме
function getAnimeStats(animeId) {
    const statsKey = `anime_stats_${animeId}`;
    return JSON.parse(localStorage.getItem(statsKey) || 'null');
}

// Обновить статистику аниме
function updateAnimeStats(animeId, stats) {
    const statsKey = `anime_stats_${animeId}`;
    localStorage.setItem(statsKey, JSON.stringify(stats));
}

// Добавить просмотр
function addView(animeId) {
    const stats = getAnimeStats(animeId);
    if (stats) {
        stats.views = (stats.views || 0) + 1;
        updateAnimeStats(animeId, stats);
    }
}

// Добавить оценку
function addRating(animeId, rating) {
    const stats = getAnimeStats(animeId);
    if (stats) {
        const oldRating = stats.rating || 0;
        const oldCount = stats.ratingCount || 0;
        
        // Пересчитываем средний рейтинг
        const newRating = ((oldRating * oldCount) + rating) / (oldCount + 1);
        
        stats.rating = Math.round(newRating * 10) / 10; // Округляем до 1 знака
        stats.ratingCount = oldCount + 1;
        updateAnimeStats(animeId, stats);
    }
}

// Добавить в избранное (только для авторизованных)
function addToFavorites(animeId) {
    // Проверяем авторизацию (синхронно)
    const isAuth = typeof isAuthenticatedSync === 'function' ? isAuthenticatedSync() : (localStorage.getItem('isAuth') === 'true');
    if (!isAuth) {
        return { success: false, message: 'Необходимо войти в аккаунт' };
    }
    
    // Получаем пользователя (синхронно)
    const user = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!user || !user.id) {
        return { success: false, message: 'Ошибка авторизации' };
    }
    
    let userData = getUserData(user.id);
    if (!userData) {
        userData = { favorites: [] };
    }
    
    if (!userData.favorites) {
        userData.favorites = [];
    }
    
    if (userData.favorites.includes(animeId)) {
        return { success: false, message: 'Уже в избранном' };
    }
    
    userData.favorites.push(animeId);
    updateUserData(user.id, { favorites: userData.favorites });
    
    // Обновляем счетчик избранного
    const stats = getAnimeStats(animeId);
    if (stats) {
        stats.favoritesCount = (stats.favoritesCount || 0) + 1;
        updateAnimeStats(animeId, stats);
    }
    
    return { success: true, message: 'Добавлено в избранное' };
}

// Удалить из избранного
function removeFromFavorites(animeId) {
    const isAuth = typeof isAuthenticatedSync === 'function' ? isAuthenticatedSync() : (localStorage.getItem('isAuth') === 'true');
    if (!isAuth) {
        return { success: false, message: 'Необходимо войти в аккаунт' };
    }
    
    const user = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!user || !user.id) {
        return { success: false, message: 'Ошибка авторизации' };
    }
    
    let userData = getUserData(user.id);
    if (!userData || !userData.favorites) {
        return { success: false, message: 'Не в избранном' };
    }
    
    const index = userData.favorites.indexOf(animeId);
    if (index === -1) {
        return { success: false, message: 'Не в избранном' };
    }
    
    userData.favorites.splice(index, 1);
    updateUserData(user.id, { favorites: userData.favorites });
    
    // Обновляем счетчик избранного
    const stats = getAnimeStats(animeId);
    if (stats && stats.favoritesCount > 0) {
        stats.favoritesCount = stats.favoritesCount - 1;
        updateAnimeStats(animeId, stats);
    }
    
    return { success: true, message: 'Удалено из избранного' };
}

// Проверить, в избранном ли аниме
function isInFavorites(animeId) {
    const isAuth = typeof isAuthenticatedSync === 'function' ? isAuthenticatedSync() : (localStorage.getItem('isAuth') === 'true');
    if (!isAuth) {
        return false;
    }
    
    const user = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!user || !user.id) return false;
    
    const userData = getUserData(user.id);
    
    return userData && userData.favorites && userData.favorites.includes(animeId);
}

// Получить аниме с актуальной статистикой
function getAnimeWithStats(animeId) {
    const anime = getAnimeById(animeId);
    if (!anime) return null;
    
    return initAnimeStats(anime);
}

// Получить все аниме с статистикой
function getAllAnimeWithStats() {
    return getAllAnime().map(anime => initAnimeStats(anime));
}

// Экспорт функций в глобальную область для использования в HTML
window.addToFavorites = addToFavorites;
window.removeFromFavorites = removeFromFavorites;
window.isInFavorites = isInFavorites;
window.getAnimeStats = getAnimeStats;
window.initAnimeStats = initAnimeStats;
window.addView = addView;
