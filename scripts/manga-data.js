// База данных манги (локальный fallback + каталог ReManga)
const mangaDatabase = {
    all: []
};

function getRemangaCatalogList() {
    if (
        typeof window !== 'undefined' &&
        window.RemangaCatalogStore &&
        typeof window.RemangaCatalogStore.getAll === 'function'
    ) {
        return window.RemangaCatalogStore.getAll();
    }
    return [];
}

// Получить мангу по ID (числовое сравнение — id может быть number или string)
function getMangaById(id) {
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) return undefined;
    if (window.RemangaCatalogStore && typeof window.RemangaCatalogStore.getById === 'function') {
        const fromRemanga = window.RemangaCatalogStore.getById(num);
        if (fromRemanga) return fromRemanga;
    }
    return mangaDatabase.all.find((m) => parseInt(m.id, 10) === num);
}

// Получить все манги
function getAllManga() {
    const remanga = getRemangaCatalogList();
    if (remanga.length) return remanga;
    return mangaDatabase.all;
}

async function ensureRemangaCatalogLoaded() {
    if (
        typeof window !== 'undefined' &&
        window.RemangaCatalogStore &&
        typeof window.RemangaCatalogStore.load === 'function'
    ) {
        try {
            await window.RemangaCatalogStore.load();
        } catch (e) {
            console.warn('[MangaData] ReManga catalog:', e);
        }
    }
}

async function getAllMangaAsync() {
    await ensureRemangaCatalogLoaded();
    return getAllManga();
}

// Поиск манги
function searchManga(query) {
    const lowerQuery = query.toLowerCase().trim();
    const list = getAllManga();
    return list.filter(
        (manga) =>
            (typeof textMatchesSearchQuery === 'function' &&
                (textMatchesSearchQuery(manga.title, lowerQuery) ||
                    textMatchesSearchQuery(manga.titleAlt, lowerQuery) ||
                    textMatchesSearchQuery(manga.author, lowerQuery) ||
                    (manga.genres &&
                        manga.genres.some((g) => textMatchesSearchQuery(g, lowerQuery))))) ||
            manga.title.toLowerCase().includes(lowerQuery) ||
            (manga.titleAlt && manga.titleAlt.toLowerCase().includes(lowerQuery)) ||
            (manga.genres && manga.genres.some((g) => g.toLowerCase().includes(lowerQuery))) ||
            (manga.author && manga.author.toLowerCase().includes(lowerQuery))
    );
}

// Фильтрация манги
function filterManga(filters) {
    let results = getAllManga();
    
    if (filters.genre && filters.genre.length > 0) {
        if (filters.genre.length >= 2) {
            results = results.filter(manga =>
                filters.genre.every(selectedGenre => 
                    manga.genres.some(mangaGenre => 
                        mangaGenre.toLowerCase().trim() === selectedGenre.toLowerCase().trim()
                    )
                    )
                );
        } else {
            const selectedGenre = filters.genre[0].toLowerCase().trim();
            results = results.filter(manga => 
                manga.genres.some(genre => genre.toLowerCase().trim() === selectedGenre)
            );
        }
    }
    
    if (filters.type && filters.type.length > 0) {
        results = results.filter(manga => filters.type.includes(manga.type));
    }
    
    if (filters.status && filters.status.length > 0) {
        results = results.filter(manga => filters.status.includes(manga.status));
    }
    
    if (filters.yearFrom) {
        results = results.filter(manga => manga.year >= filters.yearFrom);
    }
    
    if (filters.yearTo) {
        results = results.filter(manga => manga.year <= filters.yearTo);
    }
    
    if (filters.ratingMin) {
        results = results.filter(manga => manga.rating >= filters.ratingMin);
    }
    
    if (filters.search) {
        const searchResults = searchManga(filters.search);
        results = results.filter(manga => searchResults.includes(manga));
    }
    
    if (filters.removeDuplicates !== false) {
        results = removeMangaDuplicates(results);
    }
    
    return results;
}

function removeMangaDuplicates(mangaList) {
    const seen = new Map();
    mangaList.forEach(manga => {
        const key = manga.title.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[:\-–—]/g, '')
            .trim();
        if (!seen.has(key) || seen.get(key).rating < manga.rating) {
            seen.set(key, manga);
        }
    });
    return Array.from(seen.values());
}

function sortManga(mangaList, sortBy) {
    const sorted = [...mangaList];
    switch(sortBy) {
        case 'rating-desc': return sorted.sort((a, b) => b.rating - a.rating);
        case 'rating-asc': return sorted.sort((a, b) => a.rating - b.rating);
        case 'year-desc': return sorted.sort((a, b) => b.year - a.year);
        case 'year-asc': return sorted.sort((a, b) => a.year - b.year);
        case 'title-asc': return sorted.sort((a, b) => a.title.localeCompare(b.title));
        case 'title-desc': return sorted.sort((a, b) => b.title.localeCompare(a.title));
        default: return sorted;
    }
}

function getAllMangaGenres() {
    const genres = new Set();
    getAllManga().forEach((manga) => {
        (manga.genres || []).forEach((genre) => genres.add(genre));
    });
    return Array.from(genres).sort();
}

window.ensureRemangaCatalogLoaded = ensureRemangaCatalogLoaded;
window.getAllMangaAsync = getAllMangaAsync;
