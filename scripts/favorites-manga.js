// Страница избранных манг

document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await isAuthenticated();
    if (!isAuth) {
        window.location.href = 'index.html';
        return;
    }
    
    loadFavoritesManga();
});

function loadFavoritesManga() {
    const user = getCurrentUserSync();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    const userData = getUserData(user.id);
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    
    const mangaFavorites = userData.mangaFavorites || [];
    renderFavoritesManga(mangaFavorites);
}

function renderFavoritesManga(mangaFavorites) {
    const container = document.getElementById('favoritesContainer');
    if (!container) return;
    
    if (mangaFavorites.length === 0) {
        container.innerHTML = `
            <div class="page-placeholder">
                <h1>У вас пока нет избранных манг</h1>
                <p>Добавьте мангу в избранное, чтобы она отображалась здесь.</p>
                <a href="catalog/manga.html" class="btn btn-primary" style="margin-top: 1rem;">Перейти в каталог манги</a>
            </div>
        `;
        return;
    }
    
    const favoritesManga = mangaFavorites.map(id => {
        const manga = typeof getMangaById === 'function' ? getMangaById(id) : null;
        return manga;
    }).filter(m => m !== null);
    
    container.innerHTML = `
        <div class="anime-grid">
            ${favoritesManga.map(manga => {
                const gradient = generateGradient(manga.id);
                return `
                    <div class="anime-card" onclick="openMangaPage(${manga.id})">
                        <div class="anime-poster" style="background: ${gradient};">
                            <div class="anime-year">${manga.year}</div>
                            ${manga.status ? `<div class="anime-status">${manga.status}</div>` : ''}
                        </div>
                        <div class="anime-info">
                            <h3 class="anime-title">${manga.title}</h3>
                            <div class="anime-meta">
                                <div class="anime-rating">⭐ ${manga.rating || 0}</div>
                                ${manga.totalChapters ? `<div class="anime-episodes">Глав: ${manga.totalChapters}</div>` : ''}
                            </div>
                            ${manga.author ? `<div class="anime-studio">Автор: ${manga.author}</div>` : ''}
                            ${manga.genres ? `<div class="anime-genres">${manga.genres.slice(0, 2).join(', ')}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}
