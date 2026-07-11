// Страница просмотра манги — ReManga (русский перевод)

function applyMangaViewSeo(manga, extra) {
    if (typeof reminkoUpdatePageSeo !== 'function' || !manga) return;
    const title = extra?.title || manga.title || 'Манга';
    const id = extra?.id != null ? extra.id : manga.id;
    const desc =
        extra?.description ||
        manga.description ||
        `Читать «${title}» онлайн на Re-Minko — каталог манги с русским переводом.`;
    const cover = extra?.cover || manga.cover || manga.poster || null;
    reminkoUpdatePageSeo({
        title: `${title} — читать мангу онлайн | Re-Minko`,
        description: String(desc).replace(/\s+/g, ' ').trim().slice(0, 300),
        path: `/manga/view.html?id=${encodeURIComponent(String(id))}`,
        image: cover || undefined,
        ogType: 'book',
        jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'Book',
            name: title,
            url: `https://re-minko-anime.com/manga/view.html?id=${id}`,
            ...(cover ? { image: cover } : {}),
            ...(extra?.author || manga.author ? { author: { '@type': 'Person', name: extra?.author || manga.author } } : {})
        }
    });
}

let viewRemangaDir = null;
let viewBranchId = null;
let viewChaptersList = [];

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');

    let mangaId = null;
    if (idFromUrl != null && idFromUrl !== '' && String(idFromUrl).trim() !== '') {
        const parsed = parseInt(idFromUrl, 10);
        if (!Number.isNaN(parsed)) {
            mangaId = String(parsed);
            sessionStorage.setItem('viewMangaId', mangaId);
        }
    }
    if (!mangaId) {
        mangaId = sessionStorage.getItem('viewMangaId');
    }

    if (typeof ensureRemangaCatalogLoaded === 'function') {
        await ensureRemangaCatalogLoaded();
    }

    if (!mangaId) {
        showMangaNotFound('Не удалось загрузить информацию о манге.');
        return;
    }

    const manga = typeof getMangaById === 'function' ? getMangaById(mangaId) : null;
    if (!manga) {
        showMangaNotFound(`Манга с ID ${mangaId} не найдена в каталоге.`);
        return;
    }

    viewRemangaDir = manga._remanga?.dir || null;
    viewBranchId = manga._remanga?.branchId || null;

    try {
        await renderMangaDetail(manga);
    } catch (error) {
        console.error('[MangaView] Render error:', error);
    }

    if (typeof hideLoading === 'function') hideLoading();
});

function showMangaNotFound(msg) {
    document.getElementById('mangaContent').innerHTML = `
        <div class="page-placeholder">
            <h1>Манга не найдена</h1>
            <p>${msg}</p>
            <a href="../catalog/manga.html" class="btn btn-primary">Вернуться в каталог</a>
        </div>
    `;
    if (typeof hideLoading === 'function') hideLoading();
}

async function renderMangaDetail(manga) {
    const gradient =
        typeof generateGradient === 'function' ? generateGradient(manga.id) : 'linear-gradient(135deg, #6c5ce7, #a29bfe)';
    const container = document.getElementById('mangaContent');
    const previousUrl = sessionStorage.getItem('previousUrl') || '../catalog/manga.html';

    const isFavorite = typeof isMangaInFavorites === 'function' ? isMangaInFavorites(manga.id) : false;
    const favoriteBtnText = isFavorite ? '❤️ В избранном' : '🤍 В избранное';

    let coverUrl =
        typeof ReManga !== 'undefined' && ReManga.normalizeCover
            ? ReManga.normalizeCover(manga)
            : manga.cover || manga.poster || null;
    let description = manga.description || '';
    let author = manga.author || '';
    let rating = manga.rating || 0;
    let year = manga.year || '';
    let totalChapters = manga.totalChapters || 0;
    let genres = manga.genres || [];

    if (typeof ReManga !== 'undefined' && viewRemangaDir) {
        try {
            const info = await ReManga.getTitleByDir(viewRemangaDir);
            if (info) {
                if (info.branchId) viewBranchId = info.branchId;
                if (info.coverUrl) coverUrl = info.coverUrl;
                if (info.description) description = info.description;
                if (info.author) author = info.author;
                if (info.rating) rating = info.rating;
                if (info.year) year = info.year;
                if (info.totalChapters) totalChapters = info.totalChapters;
                if (info.genres?.length) genres = info.genres;
            }
        } catch (e) {
            console.warn('[MangaView] ReManga info:', e);
        }
    }

    if (!description) description = 'Описание отсутствует.';

    applyMangaViewSeo(manga, { description, cover: coverUrl, author });

    const coverStyle = coverUrl
        ? `background-image: url('${coverUrl.replace(/'/g, '%27')}'); background-size: cover; background-position: center;`
        : `background: ${gradient};`;

    container.innerHTML = `
        <a href="${previousUrl}" class="back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Назад
        </a>
        
        <div class="anime-detail">
            <div class="anime-detail-header">
                <div class="anime-detail-poster" style="${coverStyle}"></div>
                <div class="anime-detail-info">
                    <h1 class="anime-detail-title">${manga.title}</h1>
                    ${manga.titleAlt ? `<p class="anime-detail-alt">${manga.titleAlt}</p>` : ''}
                    <div class="anime-detail-meta">
                        <div class="anime-detail-rating">⭐ ${rating}</div>
                        <div class="anime-detail-year">${year}</div>
                        <div class="anime-detail-status">${manga.status}</div>
                        <div class="anime-detail-type">${manga.type}</div>
                    </div>
                    <div class="anime-detail-statrow" role="list" aria-label="Кратко о манге">
                        <div class="anime-stat-pill" role="listitem"><span class="anime-stat-pill__k">Рейтинг</span><span class="anime-stat-pill__v">${rating || '—'}</span></div>
                        <div class="anime-stat-pill" role="listitem"><span class="anime-stat-pill__k">Год</span><span class="anime-stat-pill__v">${year || '—'}</span></div>
                        <div class="anime-stat-pill" role="listitem"><span class="anime-stat-pill__k">Глав</span><span class="anime-stat-pill__v" id="mangaChaptersStat">${totalChapters || '—'}</span></div>
                        <div class="anime-stat-pill" role="listitem"><span class="anime-stat-pill__k">Статус</span><span class="anime-stat-pill__v">${manga.status || '—'}</span></div>
                    </div>
                    ${author ? `<div class="anime-detail-studio">Автор: ${author}</div>` : ''}
                    
                    <div class="anime-detail-description">${description}</div>
                    
                    <div class="anime-detail-genres">
                        ${genres
                            .map(
                                (genre) =>
                                    `<span class="genre-tag" onclick="window.location.href='../catalog/manga.html?genre=${encodeURIComponent(genre)}'">${genre}</span>`
                            )
                            .join('')}
                    </div>
                    
                    <div class="anime-detail-actions">
                        <button type="button" class="btn btn-primary" id="readMangaBtn" onclick="startReading(${manga.id})">
                            📖 Читать мангу
                        </button>
                        <button type="button" class="btn btn-secondary favorite-btn" id="favoriteBtn" onclick="handleMangaFavoriteClick(${manga.id})">
                            ${favoriteBtnText}
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="anime-detail-section" id="chaptersSection">
                <h3>Список глав</h3>
                <div class="chapters-loading" id="chaptersLoading">
                    <div class="loading-spinner-small"></div>
                    <span>Загрузка глав с ReManga...</span>
                </div>
                <div class="episode-list" id="chapterList"></div>
            </div>
        </div>
    `;

    loadRemangaChapters(manga);
}

async function resolveViewBranchId() {
    if (viewBranchId) return viewBranchId;
    if (!viewRemangaDir || typeof ReManga === 'undefined') return null;
    try {
        const info = await ReManga.getTitleByDir(viewRemangaDir);
        if (info?.branchId) {
            viewBranchId = info.branchId;
            return viewBranchId;
        }
    } catch (e) {
        console.warn('[MangaView] resolveViewBranchId:', e);
    }
    return null;
}

async function loadRemangaChapters(manga) {
    const listEl = document.getElementById('chapterList');
    const loadingEl = document.getElementById('chaptersLoading');

    if (typeof ReManga === 'undefined') {
        if (loadingEl) loadingEl.style.display = 'none';
        if (listEl) {
            listEl.innerHTML =
                '<div class="no-chapters">ReManga API не загружен. Обновите страницу.</div>';
        }
        return;
    }

    const branchId = await resolveViewBranchId();
    if (!branchId) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (listEl) {
            listEl.innerHTML = viewRemangaDir
                ? '<div class="no-chapters">Не удалось получить ветку перевода ReManga. Проверьте интернет и попробуйте снова.</div>'
                : '<div class="no-chapters">Главы недоступны — нет привязки к ReManga в каталоге.</div>';
        }
        return;
    }

    try {
        viewChaptersList = await ReManga.getChapters(branchId);

        if (loadingEl) loadingEl.style.display = 'none';

        const statEl = document.getElementById('mangaChaptersStat');
        if (statEl && viewChaptersList.length) {
            statEl.textContent = String(viewChaptersList.length);
        }

        if (viewChaptersList.length === 0) {
            listEl.innerHTML =
                '<div class="no-chapters">Главы не найдены на ReManga. Попробуйте позже.</div>';
            return;
        }

        try {
            sessionStorage.setItem('readerChaptersList', JSON.stringify(viewChaptersList));
            sessionStorage.setItem('readRemangaBranchId', String(branchId));
        } catch (e) {
            /* ignore */
        }

        const displayChapters = viewChaptersList.slice().reverse();

        listEl.innerHTML = displayChapters
            .map((ch, i) => {
                const chNum = ch.chapter || String(i + 1);
                const chTitle = ch.title ? ` — ${ch.title}` : '';
                const paidBadge = ch.isPaid
                    ? '<span class="ch-lang-badge" title="Платная глава">🔒</span>'
                    : '<span class="ch-lang-badge ru" title="Бесплатно">RU</span>';

                return `
                <div class="episode-card" onclick="openChapter('${ch.id}', '${chNum}', ${manga.id})" title="Глава ${chNum}${chTitle}">
                    <span class="ch-number">Глава ${chNum}</span>
                    ${ch.title ? `<span class="ch-title">${ch.title}</span>` : ''}
                    ${paidBadge}
                </div>
            `;
            })
            .join('');
    } catch (e) {
        console.error('[MangaView] Chapters error:', e);
        if (loadingEl) loadingEl.style.display = 'none';
        listEl.innerHTML =
            '<div class="no-chapters">Ошибка загрузки глав. Проверьте соединение и обновите страницу.</div>';
    }
}

function openChapter(chapterId, chapterNum, mangaId) {
    sessionStorage.setItem('readMangaId', mangaId.toString());
    sessionStorage.setItem('readChapterId', chapterId);
    sessionStorage.setItem('readChapterNumber', chapterNum);
    window.location.href = 'reader.html';
}

function startReading(mangaId, chapterNum) {
    sessionStorage.setItem('readMangaId', mangaId.toString());
    sessionStorage.setItem('readChapterNumber', chapterNum || '1');

    if (viewChaptersList.length > 0) {
        const latest = viewChaptersList[viewChaptersList.length - 1];
        sessionStorage.setItem('readChapterId', latest.id);
        sessionStorage.setItem('readChapterNumber', latest.chapter || '1');
    } else {
        sessionStorage.removeItem('readChapterId');
    }

    window.location.href = 'reader.html';
}

function handleMangaFavoriteClick(mangaId) {
    mangaId = parseInt(mangaId, 10);
    if (typeof isMangaInFavorites === 'function' && isMangaInFavorites(mangaId)) {
        handleRemoveMangaFromFavorites(mangaId);
    } else {
        handleAddMangaToFavorites(mangaId);
    }
}

function handleAddMangaToFavorites(mangaId) {
    mangaId = parseInt(mangaId, 10);
    if (typeof isAuthenticatedSync === 'function' && !isAuthenticatedSync()) {
        if (typeof showWarning === 'function') showWarning('Для добавления в избранное необходимо войти в аккаунт');
        return;
    }
    if (typeof window.addMangaToFavorites !== 'undefined') {
        const result = window.addMangaToFavorites(mangaId);
        if (result && result.success) {
            if (typeof showSuccess === 'function') showSuccess(result.message);
        } else {
            if (typeof showError === 'function') showError(result ? result.message : 'Ошибка');
        }
        updateMangaFavoriteButton(mangaId);
    }
}

function handleRemoveMangaFromFavorites(mangaId) {
    mangaId = parseInt(mangaId, 10);
    if (typeof window.removeMangaFromFavorites !== 'undefined') {
        const result = window.removeMangaFromFavorites(mangaId);
        if (result && result.success) {
            if (typeof showSuccess === 'function') showSuccess(result.message);
        } else {
            if (typeof showError === 'function') showError(result ? result.message : 'Ошибка');
        }
        updateMangaFavoriteButton(mangaId);
    }
}

function updateMangaFavoriteButton(mangaId) {
    mangaId = parseInt(mangaId, 10);
    const btn = document.getElementById('favoriteBtn');
    if (btn && typeof isMangaInFavorites === 'function') {
        if (isMangaInFavorites(mangaId)) {
            btn.textContent = '❤️ В избранном';
            btn.onclick = () => handleRemoveMangaFromFavorites(mangaId);
        } else {
            btn.textContent = '🤍 В избранное';
            btn.onclick = () => handleAddMangaToFavorites(mangaId);
        }
    }
}

window.handleMangaFavoriteClick = handleMangaFavoriteClick;
window.handleAddMangaToFavorites = handleAddMangaToFavorites;
window.handleRemoveMangaFromFavorites = handleRemoveMangaFromFavorites;
window.updateMangaFavoriteButton = updateMangaFavoriteButton;
window.openChapter = openChapter;
window.startReading = startReading;
