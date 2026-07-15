/* ≈4K каталог — страница списка */
let anime4kResults = [];

function initAnime4kCatalogAfterNavigation() {
    if (!document.getElementById('catalog4kResults')) return;
    void bootAnime4kCatalog();
}

async function bootAnime4kCatalog() {
    if (typeof showLoading === 'function') showLoading();
    try {
        if (typeof window.Anime4kCatalogStore?.load === 'function') {
            await window.Anime4kCatalogStore.load();
        }
        anime4kResults = typeof getAllAnime4k === 'function' ? getAllAnime4k() : [];
        applyAnime4kSearchFromUrl();
        renderAnime4kCatalog(anime4kResults);
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
}

function applyAnime4kSearchFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('search') || '';
    const input = document.getElementById('catalog4kSearch');
    if (input && q) input.value = q;
    if (q && typeof searchAnime4k === 'function') {
        anime4kResults = searchAnime4k(q);
    }
}

function renderAnime4kCatalog(list) {
    const grid = document.getElementById('catalog4kResults');
    const empty = document.getElementById('catalog4kEmpty');
    if (!grid) return;

    if (!list.length) {
        grid.innerHTML = '';
        if (empty) empty.hidden = false;
        return;
    }
    if (empty) empty.hidden = true;

    grid.innerHTML = '';
    for (const anime of list) {
        const card =
            typeof createAnimeCard === 'function'
                ? createAnimeCard(anime, () => openAnime4kPage(anime.id))
                : null;
        if (card) {
            card.classList.add('anime-card--4k');
            grid.appendChild(card);
        }
    }
}

function wireAnime4kCatalogSearch() {
    const input = document.getElementById('catalog4kSearch');
    if (!input) return;
    let debounce = null;
    input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            const q = input.value.trim();
            anime4kResults = q.length >= 2 && typeof searchAnime4k === 'function' ? searchAnime4k(q) : getAllAnime4k();
            renderAnime4kCatalog(anime4kResults);
        }, 200);
    });
}

window.addEventListener('reminko:navigation-applied', initAnime4kCatalogAfterNavigation);
window.addEventListener('reminko-anime4k-catalog-loaded', initAnime4kCatalogAfterNavigation);

document.addEventListener('DOMContentLoaded', () => {
    wireAnime4kCatalogSearch();
    initAnime4kCatalogAfterNavigation();
});
