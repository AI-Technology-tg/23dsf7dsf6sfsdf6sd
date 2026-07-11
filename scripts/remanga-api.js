// ReManga API — русская манга: тайтл, главы, страницы
// https://remanga.org

const ReManga = (() => {
    const API = 'https://api.remanga.org/api';
    const SITE = 'https://remanga.org';

    const cache = {
        title: new Map(),
        chapters: new Map(),
        pages: new Map(),
    };

    const RATE_LIMIT_MS = 350;
    const REMANGA_PROXY_STORAGE_KEY = 'reminko_remanga_proxy_url';
    let lastRequest = 0;

    function cleanProxyUrl(value) {
        const url = String(value || '').trim();
        if (!url) return '';
        if (!/^https?:\/\//i.test(url)) return '';
        return url.replace(/\/$/, '');
    }

    function storedProxyBase() {
        try {
            return cleanProxyUrl(localStorage.getItem(REMANGA_PROXY_STORAGE_KEY));
        } catch (_) {
            return '';
        }
    }

    function remangaProxyBase() {
        const cfg =
            typeof window !== 'undefined' &&
            window.APP_CONFIG &&
            typeof window.APP_CONFIG.remanga?.apiProxyUrl === 'string' &&
            window.APP_CONFIG.remanga.apiProxyUrl.trim();
        if (cfg) return cleanProxyUrl(cfg);
        const stored = storedProxyBase();
        if (stored) return stored;
        try {
            const h = window.location?.hostname || '';
            const proto = window.location?.protocol || '';
            const isLocal = h === 'localhost' || h === '127.0.0.1';
            if (!isLocal && h && (proto === 'https:' || proto === 'http:')) {
                return `${window.location.origin.replace(/\/$/, '')}/.netlify/functions/remanga-proxy`;
            }
        } catch (_) {
            /* ignore */
        }
        return '';
    }

    function proxyUrl(url) {
        const base = remangaProxyBase();
        if (!base) return url;
        return `${base}?url=${encodeURIComponent(url)}`;
    }

    function publicCorsProxyUrl(url) {
        return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }

    function setProxyUrl(url) {
        const cleaned = cleanProxyUrl(url);
        try {
            if (cleaned) localStorage.setItem(REMANGA_PROXY_STORAGE_KEY, cleaned);
            else localStorage.removeItem(REMANGA_PROXY_STORAGE_KEY);
        } catch (_) {
            /* ignore */
        }
        return cleaned;
    }

    function getProxyUrl() {
        return remangaProxyBase();
    }

    async function rateLimitedFetch(url) {
        const now = Date.now();
        const wait = RATE_LIMIT_MS - (now - lastRequest);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        lastRequest = Date.now();

        const headers = {
            Accept: 'application/json, */*',
            Referer: SITE + '/',
        };

        const proxied = remangaProxyBase() ? proxyUrl(url) : url;
        let resp = await fetch(proxied, { credentials: 'omit', headers });
        if (!resp.ok && proxied !== url) {
            const publicProxy = publicCorsProxyUrl(url);
            resp = await fetch(publicProxy, { credentials: 'omit', headers });
        }
        if (!resp.ok && resp.url !== url) {
            resp = await fetch(url, { credentials: 'omit', headers });
        }
        if (!resp.ok) throw new Error(`ReManga API ${resp.status}`);
        return resp.json();
    }

    function coverUrl(cover) {
        if (!cover) return null;
        if (typeof cover === 'string') {
            if (/^https?:\/\//i.test(cover)) return cover;
            return SITE + (cover.startsWith('/') ? cover : '/' + cover);
        }
        const rel = cover.high || cover.mid || cover.low;
        if (!rel) return null;
        if (/^https?:\/\//i.test(rel)) return rel;
        return SITE + (rel.startsWith('/') ? rel : '/' + rel);
    }

    function normalizeCover(item) {
        if (!item) return null;
        if (typeof item.cover === 'string' && item.cover) return item.cover;
        if (item.coverUrl) return item.coverUrl;
        if (item.poster) return item.poster;
        return null;
    }

    function stripHtml(html) {
        if (!html || typeof html !== 'string') return '';
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .trim();
    }

    async function getTitleByDir(dir) {
        if (!dir) return null;
        if (cache.title.has(dir)) return cache.title.get(dir);

        try {
            const data = await rateLimitedFetch(`${API}/v2/titles/${encodeURIComponent(dir)}/`);
            const branch = data.branches?.[0];
            const result = {
                remangaId: data.id,
                dir: data.dir,
                branchId: branch?.id || null,
                title: data.main_name || '',
                titleAlt: data.secondary_name || '',
                description: stripHtml(data.description),
                coverUrl: coverUrl(data.cover),
                status: data.status?.name || '',
                type: data.type?.name || 'Манга',
                year: data.issue_year || null,
                rating: parseFloat(data.avg_rating) || 0,
                totalChapters: branch?.count_chapters ?? data.count_chapters ?? 0,
                genres: (data.genres || []).map((g) => g.name),
                author: (data.creators || [])
                    .map((c) => c.name || c.person?.name)
                    .filter(Boolean)
                    .join(', '),
            };
            cache.title.set(dir, result);
            return result;
        } catch (e) {
            console.warn('[ReManga] getTitleByDir:', e.message);
            cache.title.set(dir, null);
            return null;
        }
    }

    async function getChapters(branchId, maxPages) {
        if (!branchId) return [];
        const cacheKey = String(branchId);
        if (cache.chapters.has(cacheKey)) return cache.chapters.get(cacheKey);

        const all = [];
        const limit = 100;
        let page = 1;
        const max = maxPages || 50;

        try {
            while (page <= max) {
                const params = new URLSearchParams({
                    branch_id: String(branchId),
                    ordering: 'index',
                    page: String(page),
                    count: String(limit),
                });
                const data = await rateLimitedFetch(`${API}/titles/chapters/?${params}`);
                const chunk = data.content || [];
                if (!chunk.length) break;

                chunk.forEach((ch) => {
                    all.push({
                        id: ch.id,
                        chapter: ch.chapter != null ? String(ch.chapter) : String(ch.index || ''),
                        title: ch.name || '',
                        index: ch.index,
                        isPaid: !!ch.is_paid,
                    });
                });

                if (chunk.length < limit) break;
                page++;
            }
        } catch (e) {
            console.warn('[ReManga] getChapters:', e.message);
        }

        all.sort((a, b) => (a.index || 0) - (b.index || 0));
        cache.chapters.set(cacheKey, all);
        return all;
    }

    async function getChapterPages(chapterId) {
        if (!chapterId) return [];
        const key = String(chapterId);
        if (cache.pages.has(key)) return cache.pages.get(key);

        try {
            const data = await rateLimitedFetch(`${API}/titles/chapters/${chapterId}/`);
            const pages = data.content?.pages || [];
            const urls = [];
            for (const group of pages) {
                if (!Array.isArray(group)) continue;
                for (const p of group) {
                    if (p && p.link) urls.push(p.link);
                }
            }
            cache.pages.set(key, urls);
            return urls;
        } catch (e) {
            console.warn('[ReManga] getChapterPages:', e.message);
            cache.pages.set(key, []);
            return [];
        }
    }

    async function searchTitles(query, count) {
        if (!query || !query.trim()) return [];
        const params = new URLSearchParams({
            query: query.trim(),
            count: String(count || 10),
        });
        try {
            const data = await rateLimitedFetch(`${API}/search/?${params}`);
            return (data.content || []).map((row) => ({
                remangaId: row.id,
                dir: row.dir,
                title: row.main_name || row.rus_name,
                titleAlt: row.secondary_name || row.en_name,
                coverUrl: coverUrl(row.cover || row.img),
                totalChapters: row.count_chapters || 0,
            }));
        } catch (e) {
            console.warn('[ReManga] search:', e.message);
            return [];
        }
    }

    return {
        getTitleByDir,
        getChapters,
        getChapterPages,
        searchTitles,
        coverUrl,
        normalizeCover,
        setProxyUrl,
        getProxyUrl,
        SITE,
    };
})();

window.ReManga = ReManga;
window.reminkoSetRemangaProxyUrl = (url) => ReManga.setProxyUrl(url);
window.reminkoGetRemangaProxyUrl = () => ReManga.getProxyUrl();
