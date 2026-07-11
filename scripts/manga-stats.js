// Система статистики манги (рейтинги, просмотры, избранное)

function addMangaToFavorites(mangaId) {
    if (!isAuthenticatedSync()) {
        return { success: false, message: 'Необходимо войти в аккаунт' };
    }
    
    const user = getCurrentUserSync();
    if (!user) return { success: false, message: 'Пользователь не найден' };
    
    const userData = getUserData(user.id);
    if (!userData) return { success: false, message: 'Данные не найдены' };
    
    if (!userData.mangaFavorites) {
        userData.mangaFavorites = [];
    }
    
    if (userData.mangaFavorites.includes(mangaId)) {
        return { success: false, message: 'Уже в избранном' };
    }
    
    userData.mangaFavorites.push(mangaId);
    updateUserData(user.id, { mangaFavorites: userData.mangaFavorites });
    
    return { success: true, message: 'Добавлено в избранное' };
}

function removeMangaFromFavorites(mangaId) {
    if (!isAuthenticatedSync()) {
        return { success: false, message: 'Необходимо войти в аккаунт' };
    }
    
    const user = getCurrentUserSync();
    if (!user) return { success: false, message: 'Пользователь не найден' };
    
    const userData = getUserData(user.id);
    if (!userData || !userData.mangaFavorites) {
        return { success: false, message: 'Не в избранном' };
    }
    
    const index = userData.mangaFavorites.indexOf(mangaId);
    if (index === -1) {
        return { success: false, message: 'Не в избранном' };
    }
    
    userData.mangaFavorites.splice(index, 1);
    updateUserData(user.id, { mangaFavorites: userData.mangaFavorites });
    
    return { success: true, message: 'Удалено из избранного' };
}

function isMangaInFavorites(mangaId) {
    if (!isAuthenticatedSync()) return false;
    
    const user = getCurrentUserSync();
    if (!user) return false;
    
    const userData = getUserData(user.id);
    return userData && userData.mangaFavorites && userData.mangaFavorites.includes(mangaId);
}

window.addMangaToFavorites = addMangaToFavorites;
window.removeMangaFromFavorites = removeMangaFromFavorites;
window.isMangaInFavorites = isMangaInFavorites;
