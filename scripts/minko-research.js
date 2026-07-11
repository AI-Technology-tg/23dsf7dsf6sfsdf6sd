/**
 * Сбор проверенного контекста для Minko AI: Jikan (MAL), каталог Re-Minko.
 */
(function (global) {
    'use strict';

    const ANIME_TOPIC =
        /аниме|манга|тайтл|сери|эпизод|сезон|новост|премьер|выход|студи|жанр|персонаж|сюжет|mal|myanimelist|рекоменд|похож|онгоинг|анонс|пересказ|что\s+произошло|смотреть|каталог/i;

    function extractEpisodeHint(msg) {
        const m = String(msg || '').match(/(?:^|\s)(\d{1,3})\s*(?:-?\s*)?(?:серия|серии|серию|эпизод|эп\.?|episode)/i);
        if (m) return parseInt(m[1], 10);
        const m2 = String(msg || '').match(/(?:в|на)\s+(\d{1,3})\s*(?:-?\s*)?(?:серии|серию|эпизоде)/i);
        if (m2) return parseInt(m2[1], 10);
        return null;
    }

    function extractTitleCandidates(msg) {
        const text = String(msg || '').trim();
        const out = [];
        const reQuote = /[«"']([^»"']{2,90})[»"']/g;
        let m;
        while ((m = reQuote.exec(text)) !== null) {
            out.push(m[1].trim());
        }
        const pro = text.match(
            /(?:про|об|о)\s+(?:аниме\s+|тайтл\s+|мангу\s+|манге\s+)?([a-zA-Zа-яА-ЯёЁ0-9\s:\-—!?]{3,80})/i
        );
        if (pro && pro[1]) {
            out.push(
                pro[1]
                    .replace(/\?.*$/, '')
                    .replace(/\s+(сери|эпизод|сезон).*$/i, '')
                    .trim()
            );
        }
        const en = text.match(/\b([A-Z][a-zA-Z0-9':\-\s]{2,60})\b/g);
        if (en) en.forEach((e) => out.push(e.trim()));
        const cleaned = text
            .replace(/^(расскажи|объясни|опиши|что|как|какая|какой|скажи|подскажи)\s+/gi, '')
            .replace(/\?.*$/, '')
            .trim();
        if (cleaned.length >= 4 && cleaned.length <= 90) out.push(cleaned);
        const uniq = [];
        const seen = new Set();
        for (const s of out) {
            const t = s.replace(/\s+/g, ' ').trim();
            const k = t.toLowerCase();
            if (t.length < 3 || seen.has(k)) continue;
            if (/^(что|как|кто|где|когда|почему|сколько)$/i.test(t)) continue;
            seen.add(k);
            uniq.push(t);
        }
        return uniq.slice(0, 3);
    }

    function stripHtml(s) {
        return String(s || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function formatJikanAnime(a, episodeHint) {
        if (!a) return '';
        const lines = [];
        const ru = a.title_russian || '';
        const en = a.title_english || a.title || '';
        lines.push(`«${ru || en}»${ru && en && ru !== en ? ` / ${en}` : ''}`);
        lines.push(
            `MAL ${a.mal_id} · ${a.type || '?'} · ${a.status || '?'} · эпизодов: ${a.episodes ?? '?'} · оценка: ${a.score ?? '?'}`
        );
        const year = a.year || (a.aired?.from ? String(a.aired.from).slice(0, 4) : '');
        if (year) lines.push(`Год: ${year}`);
        if (a.studios?.length) lines.push(`Студии: ${a.studios.map((s) => s.name).join(', ')}`);
        if (a.genres?.length) lines.push(`Жанры: ${a.genres.map((g) => g.name).join(', ')}`);
        const syn = stripHtml(a.synopsis);
        if (syn) lines.push(`Описание MAL: ${syn.slice(0, 1400)}`);
        if (episodeHint) lines.push(`Запрошен эпизод: ${episodeHint}`);
        return lines.join('\n');
    }

    function formatEpisodeRow(ep, num) {
        if (!ep) return '';
        const title = ep.title || ep.title_japanese || '';
        const syn = stripHtml(ep.synopsis);
        let line = `Эпизод ${num}: ${title}`;
        if (syn) line += ` — ${syn.slice(0, 600)}`;
        return line;
    }

    async function fetchEpisodeSynopsis(malId, episodeNum) {
        if (!malId || !episodeNum || episodeNum < 1) return '';
        const page = Math.ceil(episodeNum / 100);
        try {
            const res = await fetch(
                `https://api.jikan.moe/v4/anime/${malId}/episodes?page=${page}&limit=100`
            );
            if (!res.ok) return '';
            const json = await res.json();
            const list = json && json.data;
            if (!Array.isArray(list)) return '';
            const idx = ((episodeNum - 1) % 100) + 1;
            const ep = list.find((e) => e.mal_id === episodeNum || e.episode === episodeNum) || list[idx - 1];
            return formatEpisodeRow(ep, episodeNum);
        } catch {
            return '';
        }
    }

    function findCatalogMatches(msg, animeList, mangaList) {
        const parts = [];
        const titles = extractTitleCandidates(msg);
        const q = (titles[0] || msg).toLowerCase().slice(0, 80);
        if (!q || q.length < 3) return parts;

        function scan(list, label) {
            if (!Array.isArray(list)) return;
            const hits = [];
            for (const item of list) {
                const t = (item.title || '').toLowerCase();
                const alt = (item.titleAlt || '').toLowerCase();
                if (t.includes(q) || q.includes(t) || (alt && (alt.includes(q) || q.includes(alt)))) {
                    hits.push(item);
                }
                if (hits.length >= 3) break;
            }
            if (hits.length === 0) return;
            parts.push(
                `${label} Re-Minko: ` +
                    hits
                        .map((h) => {
                            const g = (h.genres || []).slice(0, 4).join(', ');
                            return `${h.title} (${h.year || '?'}, ${h.status || '?'}, ★${h.rating ?? '—'}${g ? ', ' + g : ''})`;
                        })
                        .join('; ')
            );
        }
        scan(animeList, 'Аниме');
        scan(mangaList, 'Манга');
        return parts;
    }

    async function minkoBuildResearchContext(userMessage) {
        const msg = String(userMessage || '').trim();
        if (msg.length < 3) return '';
        const wantsResearch =
            ANIME_TOPIC.test(msg) ||
            msg.length >= 12 ||
            /новост|что\s+нового|расскаж|объясн|опиш|пересказ|рекоменд|похож/i.test(msg);
        if (!wantsResearch) return '';

        const parts = [];
        const episodeHint = extractEpisodeHint(msg);
        let titles = extractTitleCandidates(msg);
        if (!titles.length && ANIME_TOPIC.test(msg)) {
            titles = [msg.replace(/\?.*$/, '').slice(0, 80)];
        }

        for (const title of titles.slice(0, 2)) {
            try {
                let anime = null;
                if (typeof global.jikanSearchAnime === 'function') {
                    anime = await global.jikanSearchAnime(title);
                }
                if (anime && anime.mal_id && typeof global.jikanFetchAnimeFullByMalId === 'function') {
                    const full = await global.jikanFetchAnimeFullByMalId(anime.mal_id);
                    if (full) anime = full;
                }
                if (anime) {
                    parts.push('--- Jikan / MyAnimeList ---\n' + formatJikanAnime(anime, episodeHint));
                    if (episodeHint && anime.mal_id) {
                        const epLine = await fetchEpisodeSynopsis(anime.mal_id, episodeHint);
                        if (epLine) parts.push(epLine);
                    }
                }
            } catch (e) {
                console.warn('[Minko research] Jikan:', e);
            }
        }

        if (/новинк|премьер|сезон|онгоинг|что\s+смотрет|анонс|выходит/i.test(msg)) {
            try {
                const [nowRes, upRes] = await Promise.all([
                    fetch('https://api.jikan.moe/v4/seasons/now?limit=10'),
                    fetch('https://api.jikan.moe/v4/seasons/upcoming?limit=8')
                ]);
                if (nowRes.ok) {
                    const now = await nowRes.json();
                    const list = (now.data || [])
                        .slice(0, 10)
                        .map((a) => `${a.title}${a.score ? ` ★${a.score}` : ''}`)
                        .join('; ');
                    if (list) parts.push('Сейчас в сезоне (Jikan): ' + list);
                }
                if (upRes.ok) {
                    const up = await upRes.json();
                    const list = (up.data || [])
                        .slice(0, 8)
                        .map((a) => a.title)
                        .join('; ');
                    if (list) parts.push('Скоро выходит (Jikan): ' + list);
                }
            } catch (_) {
                /* ignore */
            }
        }

        try {
            if (typeof global.getAllAnime === 'function' || typeof global.getAllManga === 'function') {
                const animeList = typeof global.getAllAnime === 'function' ? global.getAllAnime() : [];
                const mangaList = typeof global.getAllManga === 'function' ? global.getAllManga() : [];
                parts.push(...findCatalogMatches(msg, animeList, mangaList));
            }
        } catch (_) {
            /* ignore */
        }

        return parts.filter(Boolean).join('\n\n').slice(0, 7500);
    }

    global.minkoBuildResearchContext = minkoBuildResearchContext;
})(typeof window !== 'undefined' ? window : globalThis);
