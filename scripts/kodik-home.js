/**
 * Главная: анонсы — Jikan; выходит и популярное — Kodik. Переключатель Сериалы|Фильмы.
 */
(function (global) {
    'use strict';

    const KODIK_HOME_LIMIT = 56;
    const KODIK_POPULAR_LIMIT = 50;
    const POPULAR_YEAR_FROM = 2022;
    const POPULAR_YEAR_TO = 2026;
    const POPULAR_MIN_RATING = 7.7;
    let _catalog = [];
    let _calendarItems = [];
    let _calendarMalIds = new Set();
    let _inited = false;
    let _initPromise = null;

    const KODIK_SECTIONS = [
        {
            id: 'airing',
            sectionEl: 'kodikHomeAiring',
            gridId: 'kodikAiringGrid',
            pick: pickAiring,
            moreHref: (media) =>
                `catalog/anime.html?status=Онгоинг&type=${media === 'film' ? 'Фильм' : 'Сериал'}`,
        },
        {
            id: 'popular',
            sectionEl: 'kodikHomePopular',
            gridId: 'kodikPopularGrid',
            pick: pickPopular,
            moreHref: (media) =>
                `catalog/anime.html?yearFrom=${POPULAR_YEAR_FROM}&yearTo=${POPULAR_YEAR_TO}&type=${media === 'film' ? 'Фильм' : 'Сериал'}&sort=rating-desc`,
        },
    ];

    function catalogUrl(rel) {
        const cfg = global.APP_CONFIG && global.APP_CONFIG.kodik;
        const path = rel || 'data/kodik-calendar.json';
        if (/^https?:\/\//i.test(path)) return path;
        const base =
            (global.APP_CONFIG && global.APP_CONFIG.siteOrigin) ||
            (global.location && global.location.origin) ||
            '';
        if (base && !base.includes('localhost') && !String(global.location?.protocol).startsWith('file')) {
            return base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
        }
        return path.replace(/^\//, '');
    }

    async function loadCalendarMalIds() {
        try {
            const res = await fetch(catalogUrl('data/kodik-calendar.json'), {
                credentials: 'omit',
                cache: 'default',
            });
            if (!res.ok) return;
            const data = await res.json();
            const items = (data && data.items) || data || [];
            _calendarItems = items;
            const set = new Set();
            for (const row of items) {
                const mal = parseInt(row.mal_id, 10);
                if (!Number.isNaN(mal) && mal > 0) set.add(mal);
            }
            _calendarMalIds = set;
        } catch (_) {
            _calendarItems = [];
            _calendarMalIds = new Set();
        }
    }

    function kodikReleasedEpisodes(anime) {
        if (!anime) return 0;
        if (anime._kodik && anime._kodik.lastEpisode != null) {
            const n = parseInt(anime._kodik.lastEpisode, 10);
            if (Number.isFinite(n)) return Math.max(0, n);
        }
        if (anime.episodes === '0' || anime.episodes === 0) return 0;
        const epStr = anime.episodes != null ? String(anime.episodes).trim() : '';
        if (epStr) {
            const range = epStr.match(/(\d+)\s*-\s*(\d+)/);
            if (range) {
                const hi = parseInt(range[2], 10);
                const lo = parseInt(range[1], 10);
                if (Number.isFinite(hi) && hi > 0) return hi;
                if (Number.isFinite(lo) && lo > 0) return lo;
            }
            const single = parseInt(epStr, 10);
            if (Number.isFinite(single) && single > 0) return single;
        }
        const total = parseInt(anime.totalEpisodes, 10);
        if (anime.status === 'Онгоинг' && Number.isFinite(total) && total > 0) return Math.max(1, total);
        if (anime.status === 'Онгоинг') return 1;
        return 0;
    }

    function calendarRowForMal(malId) {
        const mal = parseInt(malId, 10);
        if (Number.isNaN(mal)) return null;
        return _calendarItems.find((r) => parseInt(r.mal_id, 10) === mal) || null;
    }

    /**
     * Анонс: сериал без ни одной вышедшей серии (или явный статус «Анонс»).
     * Фильм: только статус «Анонс» (в Kodik у фильмов нет счётчика серий).
     */
    function isKodikHomeAnnounced(anime) {
        if (!anime) return false;
        if (anime.isCalendarAnnounced) return true;
        if (anime.status === 'Анонс') return true;
        if (anime.type === 'Фильм') return anime.status === 'Анонс';
        const released = kodikReleasedEpisodes(anime);
        return released === 0;
    }

    /** Выходит: онгоинг и уже есть ≥1 серия; не анонс. */
    function isKodikHomeAiring(anime) {
        if (!anime || isKodikHomeAnnounced(anime)) return false;
        if (anime.status !== 'Онгоинг') return false;
        if (anime.type === 'Фильм') return true;
        return kodikReleasedEpisodes(anime) >= 1;
    }

    function malPosterUrl(malId) {
        const mal = parseInt(malId, 10);
        if (Number.isNaN(mal) || mal <= 0) return '';
        return `https://shikimori.one/system/animes/${mal}/original.jpg`;
    }

    function filterAdult(list) {
        const adultOk =
            typeof global.isAdultContentEnabled === 'function' && global.isAdultContentEnabled();
        if (adultOk || typeof global.animeHasRestrictedGenre !== 'function') return list;
        return list.filter((a) => !global.animeHasRestrictedGenre(a));
    }

    function normalizeMediaType(mediaType) {
        return mediaType === 'film' ? 'film' : 'serial';
    }

    function matchMedia(anime, mediaType) {
        const m = normalizeMediaType(mediaType);
        if (m === 'film') return anime && anime.type === 'Фильм';
        return anime && anime.type === 'Сериал';
    }

    function pickAiring(all, mediaType) {
        const list = all.filter((a) => matchMedia(a, mediaType) && isKodikHomeAiring(a));
        list.sort((a, b) => {
            const ac = a._calendar || (a.mal_id != null ? calendarRowForMal(a.mal_id) : null);
            const bc = b._calendar || (b.mal_id != null ? calendarRowForMal(b.mal_id) : null);
            const ap = ac && ac.active !== false && a.mal_id != null && _calendarMalIds.has(a.mal_id) ? 2 : 0;
            const bp = bc && bc.active !== false && b.mal_id != null && _calendarMalIds.has(b.mal_id) ? 2 : 0;
            if (bp !== ap) return bp - ap;
            const ar = a.rating || 0;
            const br = b.rating || 0;
            if (br !== ar) return br - ar;
            return (b._kodikScore || 0) - (a._kodikScore || 0);
        });
        return list.slice(0, KODIK_HOME_LIMIT);
    }

    function pickAnnounced(all, mediaType) {
        const list = all.filter((a) => matchMedia(a, mediaType) && isKodikHomeAnnounced(a));
        list.sort((a, b) => {
            const ac = a._calendar || (a.mal_id != null ? calendarRowForMal(a.mal_id) : null);
            const bc = b._calendar || (b.mal_id != null ? calendarRowForMal(b.mal_id) : null);
            const at = ac && (ac.next_at || ac.nextAt) ? Date.parse(ac.next_at || ac.nextAt) || Infinity : Infinity;
            const bt = bc && (bc.next_at || bc.nextAt) ? Date.parse(bc.next_at || bc.nextAt) || Infinity : Infinity;
            if (at !== bt) return at - bt;
            return (b.rating || 0) - (a.rating || 0);
        });
        return list.slice(0, KODIK_HOME_LIMIT);
    }

    function popularYear(anime) {
        const y = parseInt(anime && anime.year, 10);
        return Number.isFinite(y) ? y : 0;
    }

    function isPopularRecentHit(anime) {
        if (!anime || isKodikHomeAnnounced(anime)) return false;
        const year = popularYear(anime);
        if (year < POPULAR_YEAR_FROM || year > POPULAR_YEAR_TO) return false;
        if ((anime.rating || 0) < POPULAR_MIN_RATING) return false;
        return anime.status === 'Завершён' || anime.status === 'Онгоинг';
    }

    function pickPopular(all, mediaType) {
        const list = all.filter((a) => matchMedia(a, mediaType) && isPopularRecentHit(a));
        list.sort((a, b) => {
            const rd = (b.rating || 0) - (a.rating || 0);
            if (rd !== 0) return rd;
            return popularYear(b) - popularYear(a);
        });
        return list.slice(0, KODIK_POPULAR_LIMIT);
    }

    function statusLabel(anime) {
        if (!anime) return '';
        if (isKodikHomeAnnounced(anime)) return 'Анонс';
        if (anime.status === 'Онгоинг') return 'Выходит';
        if (anime.status === 'Завершён') return 'Завершён';
        return anime.status || '';
    }

    function epLine(anime) {
        if (!anime || anime.type === 'Фильм') return '';
        if (isKodikHomeAnnounced(anime)) {
            const cal = anime._calendar || (anime.mal_id != null ? calendarRowForMal(anime.mal_id) : null);
            const nextAt = cal && (cal.next_at || cal.nextAt);
            if (nextAt && cal.active !== false) {
                try {
                    const d = new Date(nextAt);
                    if (!Number.isNaN(d.getTime())) {
                        return `1-я серия: ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
                    }
                } catch (_) {
                    /* ignore */
                }
            }
            return '0 эп.';
        }
        if (anime.episodes) return `${anime.episodes} эп.`;
        if (anime.totalEpisodes) return `${anime.totalEpisodes} эп.`;
        return '';
    }

    function navigateKodikCard(anime) {
        try {
            global.sessionStorage.setItem('previousUrl', global.location.href);
            if (anime.isCalendarAnnounced && anime.mal_id != null) {
                global.location.href = `anime/view.html?mal_id=${encodeURIComponent(String(anime.mal_id))}`;
                return;
            }
            global.sessionStorage.setItem('viewAnimeId', String(anime.id));
        } catch (_) {
            /* ignore */
        }
        global.location.href = `anime/view.html?id=${encodeURIComponent(String(anime.id))}`;
    }

    function createKodikHomeCard(anime) {
        const card = document.createElement('div');
        card.className = 'jikan-card kodik-home-card';
        card.dataset.id = String(anime.id);
        if (anime.mal_id != null) card.dataset.malId = String(anime.mal_id);

        const imgUrl = anime.posterUrl || (anime.mal_id != null ? malPosterUrl(anime.mal_id) : '');
        const score = anime.rating ? Number(anime.rating).toFixed(1) : '—';
        const title = anime.title || anime.titleAlt || '—';
        const status = statusLabel(anime);
        const genres = Array.isArray(anime.genres) ? anime.genres.slice(0, 2).join(', ') : '';
        const ep = epLine(anime);

        card.innerHTML = `
        <div class="jikan-card-poster">
            <img src="${imgUrl}" alt="" decoding="async" loading="lazy" referrerpolicy="no-referrer" data-poster-fallback="1">
            <div class="jikan-card-poster-hover" aria-hidden="true">
                <button type="button" class="jikan-card-go-btn">Перейти</button>
            </div>
            ${score !== '—' ? `<div class="jikan-card-score">${score}</div>` : ''}
            ${status ? `<div class="jikan-card-status">${status}</div>` : ''}
        </div>
        <div class="jikan-card-info">
            <div class="jikan-card-title"></div>
            <div class="jikan-card-meta">
                ${ep ? `<span class="jikan-card-ep">${ep}</span>` : ''}
                ${genres ? `<span>${genres}</span>` : ''}
            </div>
        </div>
    `;

        const titleEl = card.querySelector('.jikan-card-title');
        if (titleEl) {
            titleEl.textContent = title;
            titleEl.setAttribute('title', title);
        }
        const posterImg = card.querySelector('.jikan-card-poster img');
        if (posterImg) posterImg.alt = title;

        const go = () => navigateKodikCard(anime);
        card.addEventListener('click', go);
        const goBtn = card.querySelector('.jikan-card-go-btn');
        if (goBtn) {
            goBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                go();
            });
        }
        return card;
    }

    async function hydrateKodikHomePosters(container) {
        if (!container) return;
        const imgs = container.querySelectorAll('img[data-poster-fallback]');
        for (const img of imgs) {
            if (img.complete && img.naturalWidth > 0) continue;
            const card = img.closest('.kodik-home-card');
            let malId = card?.dataset?.malId;
            if (!malId) continue;
            if (typeof global.reminkoNormalizeMalId === 'function') {
                const norm = global.reminkoNormalizeMalId(malId);
                if (Number.isFinite(norm) && norm > 0) malId = String(norm);
            }

            img.onerror = async function handlePosterError() {
                if (this.dataset.jikanHydrated === '1') {
                    this.style.display = 'none';
                    return;
                }
                this.dataset.jikanHydrated = '1';
                let url = '';
                try {
                    if (typeof global.jikanFetchPosterByMalId === 'function') {
                        url = await global.jikanFetchPosterByMalId(malId);
                    }
                    if (!url && typeof global.jikanFetchAnimeFullByMalId === 'function') {
                        const data = await global.jikanFetchAnimeFullByMalId(malId);
                        url =
                            data?.images?.jpg?.large_image_url || data?.images?.jpg?.image_url || '';
                    }
                    if (url) {
                        this.onerror = () => {
                            this.style.display = 'none';
                        };
                        this.src = url;
                        return;
                    }
                } catch (_) {
                    /* ignore */
                }
                this.style.display = 'none';
            };

            if (!img.src || img.src === global.location.href) {
                img.src = malPosterUrl(malId);
            } else if (img.complete && img.naturalWidth === 0) {
                img.onerror();
            }
        }
    }

    function renderSectionGrid(gridId, items) {
        const container = document.getElementById(gridId);
        if (!container) return;

        if (container._homeHorizontalTeardown) {
            container._homeHorizontalTeardown();
        }

        container.innerHTML = '';
        if (!items.length) {
            container.innerHTML = '<div class="home-loading-placeholder">Пока нет тайтлов в этой категории</div>';
            return;
        }

        for (const anime of items) {
            container.appendChild(createKodikHomeCard(anime));
        }

        void hydrateKodikHomePosters(container);

        global.requestAnimationFrame(() => {
            if (typeof global.enhanceHomeHorizontalScroll === 'function') {
                global.enhanceHomeHorizontalScroll(container);
            }
        });
    }

    function getSectionMedia(section) {
        return section && section.dataset.activeMedia === 'film' ? 'film' : 'serial';
    }

    function setSectionMediaUi(section, media) {
        if (!section) return;
        section.dataset.activeMedia = media;
        section.querySelectorAll('.home-type-toggle-btn').forEach((b) => {
            const btnMedia = b.dataset.media === 'film' ? 'film' : 'serial';
            const active = btnMedia === media;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    function renderSection(cfg, media) {
        const section = document.getElementById(cfg.sectionEl);
        if (!section) return;
        const m = normalizeMediaType(media);
        section.hidden = false;
        section.removeAttribute('aria-hidden');
        setSectionMediaUi(section, m);
        renderSectionGrid(cfg.gridId, cfg.pick(_catalog, m));
        const more = section.querySelector('.section-more-link');
        if (more && cfg.moreHref) more.href = cfg.moreHref(m);
    }

    async function renderAnnouncedSection(media) {
        const m = normalizeMediaType(media);
        const section = document.getElementById('kodikHomeAnnounced');
        if (section) {
            section.hidden = false;
            section.removeAttribute('aria-hidden');
            setSectionMediaUi(section, m);
            const more = section.querySelector('.section-more-link');
            if (more) {
                more.href = `catalog/anime.html?status=Анонс&type=${m === 'film' ? 'Фильм' : 'Сериал'}`;
            }
        }

        const items = _catalog.length ? pickAnnounced(_catalog, m) : [];
        if (items.length) {
            renderSectionGrid('kodikAnnouncedGrid', items);
            if (typeof global.appendAnnouncedHomeSection === 'function') {
                const exclude = new Set(
                    items
                        .map((anime) => (anime && anime.mal_id != null ? String(anime.mal_id) : ''))
                        .filter(Boolean)
                );
                void global.appendAnnouncedHomeSection(m, exclude);
            }
            return;
        }

        if (typeof global.loadAnnouncedHomeSection === 'function') {
            await global.loadAnnouncedHomeSection(m);
        }
    }

    async function renderAllSections(defaultMedia) {
        const media = normalizeMediaType(defaultMedia);
        for (const cfg of KODIK_SECTIONS) {
            renderSection(cfg, media);
        }
        void renderAnnouncedSection(media);
    }

    function refreshKodikHomeSections(skipAnnounced) {
        if (!document.querySelector('.home-page')) return;
        for (const cfg of KODIK_SECTIONS) {
            const section = document.getElementById(cfg.sectionEl);
            if (!section || !_catalog.length) continue;
            renderSection(cfg, getSectionMedia(section));
        }
        if (!skipAnnounced) {
            const annSection = document.getElementById('kodikHomeAnnounced');
            void renderAnnouncedSection(annSection ? getSectionMedia(annSection) : 'serial');
        }
    }

    /** Делегирование: apply-navigation копирует main через innerHTML — прямые listeners слетают. */
    function bindKodikHomeToggleDelegation() {
        if (global.__reminkoKodikHomeToggleDelegation) return;
        global.__reminkoKodikHomeToggleDelegation = true;

        document.addEventListener('click', (e) => {
            const btn = e.target && e.target.closest && e.target.closest('.home-type-toggle-btn');
            if (!btn) return;
            const section = btn.closest('.home-section--kodik');
            if (!section) return;

            e.preventDefault();
            const media = btn.dataset.media === 'film' ? 'film' : 'serial';

            if (section.id === 'kodikHomeAnnounced') {
                void renderAnnouncedSection(media);
                return;
            }

            const cfg = KODIK_SECTIONS.find((s) => s.sectionEl === section.id);
            if (!cfg || !_catalog.length) return;
            renderSection(cfg, media);
        });
    }

    async function initKodikHomeSections() {
        if (!document.querySelector('.home-page')) return;
        if (_initPromise) return _initPromise;

        _initPromise = (async () => {
            bindKodikHomeToggleDelegation();

            if (typeof global.KodikCatalogStore?.load === 'function') {
                try {
                    await global.KodikCatalogStore.load();
                } catch (_) {
                    /* ignore */
                }
            }
            const raw =
                typeof global.KodikCatalogStore?.getAll === 'function'
                    ? global.KodikCatalogStore.getAll()
                    : typeof global.getAllAnime === 'function'
                      ? global.getAllAnime().filter((a) => a.isKodikCatalog)
                      : [];
            _catalog = filterAdult(raw);
            await loadCalendarMalIds();
            await renderAllSections('serial');
            _inited = true;

            const stats = document.getElementById('heroStats');
            if (stats) stats.hidden = false;
        })();

        return _initPromise;
    }

    global.initKodikHomeSections = initKodikHomeSections;
    global.refreshKodikHomeSections = refreshKodikHomeSections;

    global.addEventListener('reminko-kodik-catalog-loaded', () => {
        if (!_inited) initKodikHomeSections();
        else refreshKodikHomeSections();
    });

    global.addEventListener('reminko:navigation-applied', (e) => {
        if (!_inited) {
            void initKodikHomeSections();
            return;
        }
        if (e?.detail?.preservedMain) {
            refreshKodikHomeSections(true);
            return;
        }
        refreshKodikHomeSections(false);
    });
})(typeof window !== 'undefined' ? window : globalThis);
