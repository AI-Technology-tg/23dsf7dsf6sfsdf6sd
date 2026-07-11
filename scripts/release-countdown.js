/**
 * Живые таймеры выхода серий: один глобальный тик в секунду для всех блоков на странице.
 */
(function (global) {
    'use strict';

    const _slots = new Map();
    let _masterTimer = null;

    function reminkoRuUnit(n, one, few, many) {
        const nAbs = Math.floor(Math.abs(n)) % 100;
        const n1 = nAbs % 10;
        if (nAbs >= 11 && nAbs <= 14) return many;
        if (n1 === 1) return one;
        if (n1 >= 2 && n1 <= 4) return few;
        return many;
    }

    function reminkoBroadcastToNextIso(broadcast) {
        if (!broadcast?.day || !broadcast?.time) return null;
        const tz = 'Asia/Tokyo';
        const dayStr = String(broadcast.day).toLowerCase().replace(/s$/, '');
        const [th, tm] = String(broadcast.time)
            .split(':')
            .map((n) => parseInt(n, 10) || 0);
        const now = Date.now();
        for (let i = 0; i < 10; i++) {
            const probe = new Date(now + i * 86400000);
            const longDay = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' })
                .format(probe)
                .toLowerCase();
            if (longDay !== dayStr) continue;
            const ymd = new Intl.DateTimeFormat('en-CA', {
                timeZone: tz,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(probe);
            const [yy, mm, dd] = ymd.split('-').map(Number);
            const ms = Date.UTC(yy, mm - 1, dd, th - 9, tm, 0);
            if (ms > now) return new Date(ms).toISOString();
        }
        return null;
    }

    function reminkoIsAiringAnimeStatus(status) {
        if (!status) return false;
        const s = String(status).toLowerCase();
        return (
            s === 'currently airing' ||
            s.includes('ongoing') ||
            s.includes('онгоинг') ||
            s.includes('выходит')
        );
    }

    /** Если ISO в прошлом — сдвинуть на следующий эфир (расписание Jikan или +7 дн.). */
    function reminkoRollForwardCountdownIso(iso, data) {
        const raw = iso ? String(iso) : '';
        const now = Date.now();
        let t = Date.parse(raw);
        if (!raw || Number.isNaN(t)) return '';

        if (t > now) return raw;

        if (!reminkoIsAiringAnimeStatus(data?.status)) return '';

        if (data?.broadcast?.day && data?.broadcast?.time) {
            const b = reminkoBroadcastToNextIso(data.broadcast);
            if (b && Date.parse(b) > now) return b;
        }

        for (let i = 0; i < 52; i++) {
            t += 7 * 86400000;
            if (t > now) return new Date(t).toISOString();
        }

        t = Date.parse(raw);
        for (let i = 0; i < 14; i++) {
            t += 86400000;
            if (t > now) return new Date(t).toISOString();
        }
        return '';
    }

    function reminkoResolveCountdownTargetIso(data, shiki, extra) {
        const cal = extra?.calendar || extra?._calendar || data?._calendar;
        const candidates = [];
        const now = Date.now();

        const calendarIso = cal && (cal.next_at || cal.nextAt);
        if (calendarIso) {
            const t = Date.parse(calendarIso);
            if (Number.isFinite(t) && t > now) {
                return String(calendarIso);
            }
            return '';
        }

        const ne = shiki && (shiki.next_episode_at || shiki.nextEpisodeAt);
        if (ne) candidates.push(String(ne));

        if (data?.status === 'Not yet aired' && data.aired?.from) {
            candidates.push(String(data.aired.from));
        }
        if (reminkoIsAiringAnimeStatus(data?.status) && data?.broadcast?.day && data?.broadcast?.time) {
            const b = reminkoBroadcastToNextIso(data.broadcast);
            if (b) candidates.push(b);
        }

        for (const iso of candidates) {
            const future = reminkoRollForwardCountdownIso(iso, data);
            if (future) return future;
        }
        return '';
    }

    function reminkoCountdownParts(diffMs) {
        if (diffMs <= 0) return null;
        let s = Math.floor(diffMs / 1000);
        const secs = s % 60;
        s = Math.floor(s / 60);
        const mins = s % 60;
        s = Math.floor(s / 60);
        const hours = s % 24;
        const days = Math.floor(s / 24);
        return { days, hours, mins, secs };
    }

    function reminkoCountdownMarkupHtml(parts) {
        if (!parts) {
            return '<div class="countdown__unknown">Ожидаем обновление расписания…</div>';
        }
        const d = String(parts.days).padStart(2, '0');
        const h = String(parts.hours).padStart(2, '0');
        const m = String(parts.mins).padStart(2, '0');
        const sec = String(parts.secs).padStart(2, '0');
        return `<div class="countdown__line" aria-live="polite">
            <span class="countdown__num" data-cd-part="d">${d}</span> <span class="countdown__unit">${reminkoRuUnit(parts.days, 'день', 'дня', 'дней')}</span>
            <span class="countdown__colon"> : </span>
            <span class="countdown__num" data-cd-part="h">${h}</span> <span class="countdown__unit">${reminkoRuUnit(parts.hours, 'час', 'часа', 'часов')}</span>
            <span class="countdown__colon"> : </span>
            <span class="countdown__num" data-cd-part="m">${m}</span> <span class="countdown__unit">${reminkoRuUnit(parts.mins, 'минута', 'минуты', 'минут')}</span>
            <span class="countdown__colon"> : </span>
            <span class="countdown__num" data-cd-part="s">${sec}</span> <span class="countdown__unit">${reminkoRuUnit(parts.secs, 'секунда', 'секунды', 'секунд')}</span>
        </div>`;
    }

    function reminkoUpdateCountdownDom(root, parts, unknownText) {
        if (!root) return;
        if (!parts) {
            if (!root.querySelector('[data-cd-part]')) {
                root.innerHTML = `<div class="countdown__unknown">${unknownText || 'Дата следующего эпизода неизвестна.'}</div>`;
            } else {
                root.innerHTML = `<div class="countdown__unknown">${unknownText || 'Время выхода прошло — скоро обновим.'}</div>`;
            }
            return;
        }
        let line = root.querySelector('.countdown__line');
        if (!line) {
            root.innerHTML = reminkoCountdownMarkupHtml(parts);
            return;
        }
        const map = {
            d: String(parts.days).padStart(2, '0'),
            h: String(parts.hours).padStart(2, '0'),
            m: String(parts.mins).padStart(2, '0'),
            s: String(parts.secs).padStart(2, '0')
        };
        line.querySelectorAll('[data-cd-part]').forEach((el) => {
            const k = el.getAttribute('data-cd-part');
            if (k && map[k] != null) el.textContent = map[k];
        });
    }

    function reminkoEnsureMasterTimer() {
        if (_masterTimer != null) return;
        _masterTimer = setInterval(reminkoTickAllCountdowns, 1000);
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) reminkoTickAllCountdowns();
            });
        }
    }

    function reminkoStopMasterTimerIfEmpty() {
        if (_slots.size > 0) return;
        if (_masterTimer != null) {
            clearInterval(_masterTimer);
            _masterTimer = null;
        }
    }

    function reminkoTickAllCountdowns() {
        const now = Date.now();
        for (const [el, slot] of _slots) {
            if (!el.isConnected) {
                _slots.delete(el);
                continue;
            }
            const iso = slot.iso;
            const target = iso ? Date.parse(iso) : NaN;
            if (!iso || Number.isNaN(target)) {
                reminkoUpdateCountdownDom(el, null, slot.unknownText || 'Дата следующего эпизода неизвестна.');
                continue;
            }
            let left = target - now;
            if (left <= 0) {
                const rolled =
                    typeof reminkoRollForwardCountdownIso === 'function'
                        ? reminkoRollForwardCountdownIso(iso, slot.rollData)
                        : '';
                if (rolled && Date.parse(rolled) > now) {
                    slot.iso = rolled;
                    left = Date.parse(rolled) - now;
                } else {
                    reminkoUpdateCountdownDom(
                        el,
                        null,
                        slot.expiredText || 'Ожидаем обновление расписания следующей серии…'
                    );
                    if (typeof slot.onExpire === 'function') slot.onExpire(el);
                    continue;
                }
            }
            reminkoUpdateCountdownDom(el, reminkoCountdownParts(left));
        }
        reminkoStopMasterTimerIfEmpty();
    }

    /**
     * @param {HTMLElement} containerEl — куда рисовать цифры
     * @param {string} iso — ISO-время цели
     * @param {{ unknownText?: string, expiredText?: string, onExpire?: function }} [opts]
     */
    function reminkoStartLiveCountdown(containerEl, iso, opts) {
        if (!containerEl) return;
        const slot = {
            iso: iso ? String(iso) : '',
            unknownText: opts?.unknownText,
            expiredText: opts?.expiredText,
            onExpire: opts?.onExpire,
            rollData: opts?.rollData || null
        };
        _slots.set(containerEl, slot);
        reminkoEnsureMasterTimer();
        reminkoTickAllCountdowns();
    }

    function reminkoStopLiveCountdown(containerEl) {
        if (!containerEl) return;
        _slots.delete(containerEl);
        reminkoStopMasterTimerIfEmpty();
    }

    function reminkoStopAllLiveCountdowns() {
        _slots.clear();
        reminkoStopMasterTimerIfEmpty();
    }

    let _calendarItems = null;
    let _calendarByMal = null;
    let _calendarLoading = null;

    function reminkoIsLocalDevOrigin() {
        const host = global.location && global.location.hostname;
        return (
            !host ||
            host === 'localhost' ||
            host === '127.0.0.1' ||
            String(global.location?.protocol).startsWith('file')
        );
    }

    function reminkoCalendarUrl() {
        const cfg = global.APP_CONFIG && global.APP_CONFIG.kodik;
        const rel = (cfg && cfg.calendarPath) || 'data/kodik-calendar.json';
        if (/^https?:\/\//i.test(rel)) return rel;
        const base =
            (global.APP_CONFIG && global.APP_CONFIG.siteOrigin) ||
            (global.location && global.location.origin) ||
            '';
        const path = rel.replace(/^\//, '');
        if (base && !reminkoIsLocalDevOrigin()) {
            return base.replace(/\/$/, '') + '/' + path;
        }
        const depth =
            global.location && global.location.pathname
                ? (global.location.pathname.match(/\//g) || []).length - 1
                : 0;
        const prefix = depth > 0 ? '../'.repeat(depth) : '';
        return prefix + path;
    }

    async function reminkoLoadCalendarData(force) {
        if (_calendarItems && !force) return _calendarItems;
        if (_calendarLoading && !force) return _calendarLoading;
        _calendarLoading = fetch(reminkoCalendarUrl(), { credentials: 'omit', cache: 'default' })
            .then((res) => (res.ok ? res.json() : { items: [] }))
            .then((data) => {
                _calendarItems = (data && data.items) || data || [];
                _calendarByMal = new Map();
                for (const row of _calendarItems) {
                    const mal = parseInt(row.mal_id, 10);
                    if (Number.isFinite(mal) && mal > 0) _calendarByMal.set(mal, row);
                }
                return _calendarItems;
            })
            .catch(() => {
                _calendarItems = [];
                _calendarByMal = new Map();
                return _calendarItems;
            })
            .finally(() => {
                _calendarLoading = null;
            });
        return _calendarLoading;
    }

    function reminkoCalendarRowForMal(malId) {
        const mal = parseInt(malId, 10);
        if (!mal || !_calendarByMal) return null;
        return _calendarByMal.get(mal) || null;
    }

    /** Детские / ежедневные мультсериалы — не показываем в анонсах календаря. */
    const REMINKO_KIDS_CARTOON_MAL = new Set([
        966, 1960, 235, 2406, 6149, 8687, 53876, 56566, 32353, 50418, 60534, 50250, 18941, 63356,
        62933, 63383, 63150, 63403, 64357, 63641, 62683, 62856, 63042, 63352, 37096, 42295
    ]);

    const REMINKO_KIDS_GENRE_NAMES = new Set(['kids', 'детское', 'детский']);

    function reminkoCatalogMetaForCalendarRow(row, metaByMal) {
        const mal = parseInt(row && row.mal_id, 10);
        if (!Number.isFinite(mal) || mal <= 0 || !metaByMal) return null;
        return metaByMal.get(mal) || null;
    }

    function reminkoRowHasKidsGenre(meta) {
        if (!meta || !Array.isArray(meta.genres)) return false;
        return meta.genres.some((g) => {
            const n = String(g || '')
                .trim()
                .toLowerCase();
            return REMINKO_KIDS_GENRE_NAMES.has(n);
        });
    }

    function reminkoRowTitleLooksLikeKidsCartoon(row, meta) {
        const title = String((row && row.title_ru) || (meta && meta.title) || '')
            .trim()
            .toLowerCase();
        if (!title) return false;
        const patterns = [
            /анпанман/,
            /дораэмон/,
            /покемон/,
            /син-тян/,
            /садзаэ/,
            /маруко/,
            /bono\s*bono|боно\s*боно/,
            /ниндзяла/,
            /shimajirou|шимаджиро/,
            /томика\s+и\s+том/,
            /копэн/,
            /кумарба/,
            /асибэ/,
            /карамелька/,
            /табакошка/,
            /планозавр/,
            /тикава/,
            /бейблэйд/,
            /отряд\s+мистики/,
            /qq\s+гома/
        ];
        return patterns.some((re) => re.test(title));
    }

    function reminkoIsMislabeledOngoingPremiere(row, meta) {
        if (!meta || meta.status !== 'Онгоинг') return false;
        const last =
            meta._kodik && meta._kodik.lastEpisode != null
                ? parseInt(meta._kodik.lastEpisode, 10)
                : NaN;
        if (Number.isFinite(last) && last >= 2) return true;
        const ep = parseInt(row && row.next_episode, 10) || 1;
        return ep <= 1 && Number.isFinite(last) && last >= 1;
    }

    /** Детский мульт / долгий ежедневный сериал — скрываем из календарных анонсов. */
    function reminkoIsKidsCartoonCalendarRow(row, catalogMeta) {
        const mal = parseInt(row && row.mal_id, 10);
        if (Number.isFinite(mal) && mal > 0 && REMINKO_KIDS_CARTOON_MAL.has(mal)) return true;
        if (reminkoRowHasKidsGenre(catalogMeta)) return true;
        if (reminkoRowTitleLooksLikeKidsCartoon(row, catalogMeta)) return true;
        if (reminkoIsMislabeledOngoingPremiere(row, catalogMeta)) return true;
        return false;
    }

    /** Настоящая премьера: 1-я серия, не детский мульт и не уже идущий онгоинг. */
    function reminkoIsTrueCalendarAnnounced(row, catalogMeta) {
        const ep = parseInt(row && row.next_episode, 10) || 1;
        if (ep > 1) return false;
        if (!row || !row.next_at || !Number.isFinite(Date.parse(row.next_at))) return false;
        if (reminkoIsKidsCartoonCalendarRow(row, catalogMeta)) return false;
        if (catalogMeta && catalogMeta.status === 'Онгоинг') {
            const last =
                catalogMeta._kodik && catalogMeta._kodik.lastEpisode != null
                    ? parseInt(catalogMeta._kodik.lastEpisode, 10)
                    : NaN;
            if (Number.isFinite(last) && last >= 1) return false;
        }
        return true;
    }

    /** Онгоинги (след. серия > 1) и анонсы (премьера, ep ≤ 1), без дублей mal_id. */
    function reminkoSplitCalendarRows(items, metaByMal) {
        const now = Date.now();
        const airing = [];
        const announced = [];
        const seenAiringMal = new Set();
        const seenAnnouncedMal = new Set();
        for (const row of items || []) {
            const mal = parseInt(row.mal_id, 10);
            const t = Date.parse(row.next_at);
            if (!Number.isFinite(t) || t <= now) continue;
            const ep = parseInt(row.next_episode, 10) || 1;
            const meta =
                metaByMal && typeof metaByMal.get === 'function'
                    ? reminkoCatalogMetaForCalendarRow(row, metaByMal)
                    : null;
            if (ep <= 1) {
                if (!reminkoIsTrueCalendarAnnounced(row, meta)) continue;
                if (Number.isFinite(mal) && mal > 0) {
                    if (seenAnnouncedMal.has(mal)) continue;
                    seenAnnouncedMal.add(mal);
                }
                announced.push(row);
            } else {
                if (Number.isFinite(mal) && mal > 0) {
                    if (seenAiringMal.has(mal)) continue;
                    seenAiringMal.add(mal);
                }
                airing.push(row);
            }
        }
        const byTime = (a, b) => Date.parse(a.next_at) - Date.parse(b.next_at);
        airing.sort(byTime);
        announced.sort(byTime);
        return { airing, announced };
    }

    function reminkoFormatReleaseDateShort(iso) {
        const t = Date.parse(iso);
        if (Number.isNaN(t)) return '';
        return new Date(t).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    global.reminkoRuUnit = reminkoRuUnit;
    global.reminkoBroadcastToNextIso = reminkoBroadcastToNextIso;
    global.reminkoIsAiringAnimeStatus = reminkoIsAiringAnimeStatus;
    global.reminkoRollForwardCountdownIso = reminkoRollForwardCountdownIso;
    global.reminkoResolveCountdownTargetIso = reminkoResolveCountdownTargetIso;
    global.reminkoCountdownParts = reminkoCountdownParts;
    global.reminkoStartLiveCountdown = reminkoStartLiveCountdown;
    global.reminkoStopLiveCountdown = reminkoStopLiveCountdown;
    global.reminkoStopAllLiveCountdowns = reminkoStopAllLiveCountdowns;
    global.reminkoLoadCalendarData = reminkoLoadCalendarData;
    global.reminkoCalendarRowForMal = reminkoCalendarRowForMal;
    global.reminkoSplitCalendarRows = reminkoSplitCalendarRows;
    global.reminkoIsKidsCartoonCalendarRow = reminkoIsKidsCartoonCalendarRow;
    global.reminkoIsTrueCalendarAnnounced = reminkoIsTrueCalendarAnnounced;
    global.reminkoFormatReleaseDateShort = reminkoFormatReleaseDateShort;
})(typeof window !== 'undefined' ? window : globalThis);
