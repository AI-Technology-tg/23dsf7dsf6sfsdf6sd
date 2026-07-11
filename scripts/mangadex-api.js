// MangaDex API интеграция для поиска манги, обложек, глав и страниц
// https://api.mangadex.org/docs/

const MangaDex = (() => {
    const BASE = 'https://api.mangadex.org';
    const PROXY_BASE = 'https://corsproxy.io/?' + encodeURIComponent('https://api.mangadex.org');
    const UPLOADS = 'https://uploads.mangadex.org';
    
    const cache = {
        search: new Map(),
        chapters: new Map(),
        pages: new Map()
    };

    const RATE_LIMIT_MS = 600;
    let lastRequest = 0;
    let useProxy = true;

    async function rateLimitedFetch(url) {
        const now = Date.now();
        const wait = RATE_LIMIT_MS - (now - lastRequest);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        lastRequest = Date.now();
        
        try {
            const resp = await fetch(useProxy ? 'https://corsproxy.io/?' + encodeURIComponent(url) : url);
            if (!resp.ok) throw new Error(`MangaDex API error: ${resp.status}`);
            return resp.json();
        } catch (e) {
            if (!useProxy) {
                useProxy = true;
                const resp = await fetch('https://corsproxy.io/?' + encodeURIComponent(url));
                if (!resp.ok) throw new Error(`MangaDex API error (proxy): ${resp.status}`);
                return resp.json();
            }
            throw e;
        }
    }

    // Поиск манги по названию, возвращает { mangadexId, title, coverUrl, description, ... }
    async function searchManga(title) {
        const key = title.toLowerCase().trim();
        if (cache.search.has(key)) return cache.search.get(key);

        const params = new URLSearchParams({
            title: title,
            limit: '5',
            'includes[]': 'cover_art',
            'order[relevance]': 'desc'
        });

        try {
            const data = await rateLimitedFetch(`${BASE}/manga?${params}`);
            if (!data.data || data.data.length === 0) {
                cache.search.set(key, null);
                return null;
            }

            const manga = data.data[0];
            const result = parseMangaResult(manga);
            cache.search.set(key, result);
            return result;
        } catch (e) {
            console.warn('[MangaDex] Search error:', e.message);
            return null;
        }
    }

    function parseMangaResult(manga) {
        const id = manga.id;
        const attrs = manga.attributes;
        
        const title = attrs.title.en || attrs.title.ja || attrs.title['ja-ro'] || Object.values(attrs.title)[0] || '';
        
        let descriptionRu = attrs.description?.ru || '';
        let descriptionEn = attrs.description?.en || '';
        
        let coverFilename = null;
        if (manga.relationships) {
            const coverRel = manga.relationships.find(r => r.type === 'cover_art');
            if (coverRel && coverRel.attributes) {
                coverFilename = coverRel.attributes.fileName;
            }
        }
        
        const coverUrl = coverFilename 
            ? `${UPLOADS}/covers/${id}/${coverFilename}.512.jpg`
            : null;

        return {
            mangadexId: id,
            title,
            description: descriptionRu || descriptionEn,
            coverUrl,
            status: attrs.status,
            year: attrs.year,
            lastChapter: attrs.lastChapter
        };
    }

    // Получить список глав (с пагинацией) для manga ID
    // langs — массив предпочтительных языков ['ru', 'en']
    async function getChapters(mangadexId, langs = ['ru', 'en']) {
        const cacheKey = `${mangadexId}_${langs.join(',')}`;
        if (cache.chapters.has(cacheKey)) return cache.chapters.get(cacheKey);

        const allChapters = [];
        let offset = 0;
        const limit = 100;

        try {
            while (true) {
                const params = new URLSearchParams({
                    limit: limit.toString(),
                    offset: offset.toString(),
                    'order[chapter]': 'asc',
                    'order[volume]': 'asc'
                });
                langs.forEach(l => params.append('translatedLanguage[]', l));

                const data = await rateLimitedFetch(`${BASE}/manga/${mangadexId}/feed?${params}`);
                if (!data.data || data.data.length === 0) break;

                data.data.forEach(ch => {
                    const a = ch.attributes;
                    allChapters.push({
                        id: ch.id,
                        chapter: a.chapter,
                        title: a.title || '',
                        volume: a.volume,
                        language: a.translatedLanguage,
                        pages: a.pages,
                        publishAt: a.publishAt
                    });
                });

                offset += limit;
                if (offset >= (data.total || 0)) break;
            }
        } catch (e) {
            console.warn('[MangaDex] Chapters error:', e.message);
        }

        // Группируем по номеру главы, предпочитая русский язык
        const grouped = new Map();
        allChapters.forEach(ch => {
            const num = ch.chapter || '0';
            const existing = grouped.get(num);
            if (!existing) {
                grouped.set(num, ch);
            } else if (ch.language === 'ru' && existing.language !== 'ru') {
                grouped.set(num, ch);
            }
        });

        const result = Array.from(grouped.values())
            .sort((a, b) => parseFloat(a.chapter || 0) - parseFloat(b.chapter || 0));

        cache.chapters.set(cacheKey, result);
        return result;
    }

    // Получить URL-ы страниц главы
    async function getChapterPages(chapterId) {
        if (cache.pages.has(chapterId)) return cache.pages.get(chapterId);

        try {
            const data = await rateLimitedFetch(`${BASE}/at-home/server/${chapterId}`);
            
            const baseUrl = data.baseUrl;
            const hash = data.chapter.hash;
            const pages = data.chapter.data; // высокое качество
            const dataSaver = data.chapter.dataSaver; // сжатые

            const result = {
                quality: pages.map(f => `${baseUrl}/data/${hash}/${f}`),
                dataSaver: dataSaver.map(f => `${baseUrl}/data-saver/${hash}/${f}`)
            };

            cache.pages.set(chapterId, result);
            return result;
        } catch (e) {
            console.warn('[MangaDex] Pages error:', e.message);
            return { quality: [], dataSaver: [] };
        }
    }

    // Получить обложку по названию (для каталога и карточек)
    async function getCoverByTitle(title) {
        const result = await searchManga(title);
        return result ? result.coverUrl : null;
    }

    return {
        searchManga,
        getChapters,
        getChapterPages,
        getCoverByTitle,
        BASE,
        UPLOADS
    };
})();

window.MangaDex = MangaDex;
