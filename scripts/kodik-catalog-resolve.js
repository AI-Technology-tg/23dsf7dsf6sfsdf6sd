/**
 * Единая логика Kodik для каталога (anime/view) и комнаты «Смотреть вместе».
 * Один кэш на id аниме — совпадение ссылок с личной страницей просмотра.
 */
(function (global) {
    const cache = new Map();
    const inflight = new Map();

    function normalizeTitleForKodik(title) {
        if (!title) return '';
        return String(title)
            .replace(/[:\-–—]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function kodikSearchTitlesForAnime(anime) {
        const raw = anime && anime._jikanRaw;
        const en = normalizeTitleForKodik(
            anime.titleAlt || (raw && (raw.title_english || raw.title)) || anime.title
        );
        const ru = normalizeTitleForKodik(anime.title);
        const jp = raw ? normalizeTitleForKodik(raw.title_japanese || '') : '';
        const out = [];
        if (en) out.push(en);
        if (ru && ru !== en) out.push(ru);
        if (jp && jp !== en && jp !== ru) out.push(jp);
        return out.length ? out : ['anime'];
    }

    function animePrefersKodikSerial(anime) {
        if (!anime) return false;
        if (anime.type === 'Фильм') return false;
        const jt = anime._jikanRaw && anime._jikanRaw.type;
        if (jt === 'Movie') return false;
        if (anime.type === 'Сериал') return true;
        const te = parseInt(anime.totalEpisodes, 10) || 1;
        return te > 1;
    }

    function kodikLinkToHttps(link) {
        if (!link || typeof link !== 'string') return '';
        const t = link.trim();
        if (t.startsWith('//')) return 'https:' + t;
        if (/^https?:\/\//i.test(t)) return t;
        return 'https://' + t.replace(/^\/+/, '');
    }

    function kodikResultIsSerial(result) {
        if (!result) return false;
        if (result.type === 'anime-serial') return true;
        return /\/serial\//i.test(String(result.link || ''));
    }

    function buildKodikPlayerIframeUrl(httpsHref, isSerial, episode, startSeconds, viewerAutoplay, muteOnAutoplay = true) {
        const ep = Math.max(1, parseInt(episode, 10) || 1);
        if (!isSerial) {
            const uOne = new URL(httpsHref);
            maybeSetStartParam(uOne, startSeconds);
            if (viewerAutoplay) {
                uOne.searchParams.set('autoplay', '1');
                if (muteOnAutoplay) uOne.searchParams.set('mute', '1');
            }
            return uOne.toString();
        }
        const u = new URL(httpsHref);
        u.searchParams.set('episode', String(ep));
        maybeSetStartParam(u, startSeconds);
        if (viewerAutoplay) {
            u.searchParams.set('autoplay', '1');
            if (muteOnAutoplay) u.searchParams.set('mute', '1');
        }
        return u.toString();
    }

    function maybeSetStartParam(u, startSeconds) {
        if (startSeconds == null) return;
        const t = Math.max(0, parseFloat(startSeconds) || 0);
        if (t > 0) u.searchParams.set('t', String(Math.floor(t)));
    }

    function extractSeasonCourseHint(anime) {
        const j = anime && anime._jikanRaw;
        const syn = j && Array.isArray(j.title_synonyms) ? j.title_synonyms.join(' | ') : '';
        const parts = [
            anime && anime.title,
            anime && anime.titleAlt,
            j && j.title,
            j && j.title_english,
            syn
        ].filter(Boolean);
        const blob = parts.join(' | ').toLowerCase();
        const m1 = blob.match(/(?:season|сезон|курс|cour)\s*([1-9]|1[0-2])\b/i);
        if (m1) return parseInt(m1[1], 10);
        const m2 = blob.match(/\b([2-9])\s*(?:-й|\s*сезон|\s*курс)\b/i);
        if (m2) return parseInt(m2[1], 10);
        const m3 = blob.match(/(?:^|[\s:])([2-9])\s*$/i);
        if (m3) return parseInt(m3[1], 10);
        return null;
    }

    function scoreKodikCandidate(r, anime, seasonHint, yearHint) {
        let score = 0;
        const mal =
            anime.mal_id != null
                ? String(anime.mal_id)
                : anime._jikanRaw && anime._jikanRaw.mal_id != null
                  ? String(anime._jikanRaw.mal_id)
                  : '';
        if (mal && r.shikimori_id != null && String(r.shikimori_id) === mal) score += 2000;
        const t = `${r.title || ''} ${r.title_orig || r.other_title || ''}`.toLowerCase();
        if (seasonHint != null) {
            const sn = String(seasonHint);
            if (
                new RegExp(
                    `\\bseason\\s*${sn}\\b|\\b${sn}\\s*season\\b|сезон\\s*${sn}|курс\\s*${sn}|часть\\s*${sn}`,
                    'i'
                ).test(t)
            ) {
                score += 150;
            }
            for (let o = 1; o <= 12; o++) {
                if (o === seasonHint) continue;
                if (
                    new RegExp(`\\bseason\\s*${o}\\b`, 'i').test(t) ||
                    new RegExp(`\\b${o}\\s*season\\b`, 'i').test(t)
                ) {
                    score -= 80;
                }
            }
        }
        if (yearHint != null && r.year != null) {
            const y = parseInt(r.year, 10);
            const hy = parseInt(yearHint, 10);
            if (!Number.isNaN(y) && !Number.isNaN(hy) && Math.abs(y - hy) <= 1) score += 40;
        }
        if (animePrefersKodikSerial(anime) && kodikResultIsSerial(r)) score += 25;
        else if (!animePrefersKodikSerial(anime) && r.type === 'anime') score += 15;
        return score;
    }

    function pickBestKodikSearchResult(results, anime) {
        if (!results || !results.length) return null;
        const mal = anime.mal_id != null ? anime.mal_id : anime._jikanRaw && anime._jikanRaw.mal_id;
        if (mal != null) {
            const m = String(mal);
            const byShiki = results.find(
                (r) => r.shikimori_id != null && String(r.shikimori_id) === m
            );
            if (byShiki) return byShiki;
        }
        const seasonHint = extractSeasonCourseHint(anime);
        const yearHint = (anime._jikanRaw && anime._jikanRaw.year) || anime.year;
        let best = null;
        let bestScore = -Infinity;
        for (const r of results) {
            const sc = scoreKodikCandidate(r, anime, seasonHint, yearHint);
            if (sc > bestScore) {
                bestScore = sc;
                best = r;
            }
        }
        if (best && bestScore >= 0) return best;

        const wantSerial = animePrefersKodikSerial(anime);
        if (wantSerial) {
            const serial = results.find((r) => r.type === 'anime-serial');
            if (serial) return serial;
        } else {
            const movie = results.find(
                (r) => r.type === 'anime' && /\/video\//i.test(String(r.link || ''))
            );
            if (movie) return movie;
        }
        return results[0];
    }

    async function searchKodikForAnimeOnce(anime, title) {
        const preferSerial = animePrefersKodikSerial(anime);
        if (preferSerial) {
            const data = await global.KodikApi.search({ title, types: 'anime-serial', limit: 30 });
            const results = (data && data.results) || [];
            if (results.length) return results;
        }
        const data = await global.KodikApi.search({ title, limit: 30 });
        return (data && data.results) || [];
    }

    async function resolveKodikEmbedBase(anime) {
        if (!anime || anime.id == null) {
            throw new Error('Нет аниме');
        }
        const key = String(anime.id);
        if (cache.has(key)) {
            return cache.get(key);
        }
        if (inflight.has(key)) {
            return inflight.get(key);
        }

        const directLink =
            (anime._kodik && (anime._kodik.link || anime._kodik.player_link)) ||
            anime._kodikLink ||
            '';
        if (directLink) {
            const href = kodikLinkToHttps(directLink);
            const isSerial =
                (anime._kodik && anime._kodik.isSerial === true) ||
                (anime._kodik && anime._kodik.isSerial === false
                    ? false
                    : kodikResultIsSerial({ link: directLink, type: anime._kodik?.kodikType })) ||
                animePrefersKodikSerial(anime);
            const payload = { href, isSerial, fromKodikCatalog: true };
            cache.set(key, payload);
            return payload;
        }

        const promise = (async () => {
            if (!global.KodikApi || typeof global.KodikApi.search !== 'function') {
                throw new Error('KodikApi не загружен');
            }
            const titles = kodikSearchTitlesForAnime(anime);
            const seen = new Set();
            const merged = [];
            for (let i = 0; i < titles.length; i++) {
                const batch = await searchKodikForAnimeOnce(anime, titles[i]);
                for (const r of batch) {
                    const k = r.link || String(r.id || '') || JSON.stringify(r);
                    if (k && !seen.has(k)) {
                        seen.add(k);
                        merged.push(r);
                    }
                }
                if (merged.length >= 36) break;
            }
            const best = pickBestKodikSearchResult(merged, anime);
            if (!best || !best.link) {
                throw new Error('По API ничего не найдено');
            }
            const href = kodikLinkToHttps(best.link);
            const isSerial = kodikResultIsSerial(best);
            const payload = { href, isSerial };
            cache.set(key, payload);
            return payload;
        })();

        inflight.set(key, promise);
        promise.finally(() => inflight.delete(key));
        return promise;
    }

    function clearCacheForAnimeId(animeId) {
        if (animeId != null) cache.delete(String(animeId));
    }

    global.KodikCatalogResolve = {
        resolveEmbedBase: resolveKodikEmbedBase,
        buildIframeUrl: buildKodikPlayerIframeUrl,
        clearCacheForAnimeId
    };
})(typeof window !== 'undefined' ? window : globalThis);
