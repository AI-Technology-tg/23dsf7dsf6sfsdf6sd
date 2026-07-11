#!/usr/bin/env node
/**
 * Сборка компактного каталога русской манги из ReManga API.
 *
 * Запуск из корня проекта (4h3j5h3g534h5g34jh534):
 *   node scripts/build/remanga-build-catalog.js
 *
 * Переменные окружения:
 *   REMANGA_PAGES=300  — запас страниц API (ReManga сейчас отдаёт около 40 тайтлов на страницу)
 *   REMANGA_TARGET=10000 — сколько тайтлов сохранить в итоговом каталоге
 *   REMANGA_ENRICH=1   — подтянуть жанры и branch_id из v2 (медленнее)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const OUT_FILE = path.join(ROOT, 'data', 'remanga-manga-catalog.json');

const API = 'https://api.remanga.org/api';
const SITE = 'https://remanga.org';
const UA = 'Re-Minko-Catalog-Build/1.0';

const PAGES = Math.max(1, parseInt(process.env.REMANGA_PAGES || '300', 10));
const COUNT = Math.min(100, Math.max(1, parseInt(process.env.REMANGA_COUNT || '100', 10)));
const TARGET = Math.max(1, parseInt(process.env.REMANGA_TARGET || '10000', 10));
const ENRICH = process.env.REMANGA_ENRICH !== '0';
const ENRICH_CONCURRENCY = Math.max(1, parseInt(process.env.REMANGA_ENRICH_CONCURRENCY || '6', 10));
const ENRICH_DELAY_MS = Math.max(0, parseInt(process.env.REMANGA_ENRICH_DELAY_MS || '80', 10));

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function apiGet(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return res.json();
}

function coverUrl(cover) {
    if (!cover) return null;
    const rel = cover.high || cover.mid || cover.low;
    if (!rel) return null;
    if (/^https?:\/\//i.test(rel)) return rel;
    return SITE + (rel.startsWith('/') ? rel : '/' + rel);
}

function stripHtml(html) {
    if (!html || typeof html !== 'string') return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function mapListItem(row) {
    const typeName =
        typeof row.type === 'string' ? row.type : row.type?.name || 'Манга';
    const statusName = row.status?.name || 'Неизвестно';
    const rating = parseFloat(row.avg_rating) || parseFloat(row.fresh_rating) || 0;
    const poster = coverUrl(row.cover || row.img);

    return {
        id: row.id,
        title: row.main_name || row.rus_name || row.secondary_name || 'Без названия',
        titleAlt: row.secondary_name || row.en_name || '',
        year: row.issue_year || 0,
        rating: Math.round(rating * 10) / 10,
        status: statusName,
        type: typeName,
        totalChapters: row.count_chapters || 0,
        genres: [],
        author: '',
        description: '',
        cover: poster,
        poster,
        isRemangaCatalog: true,
        _remanga: {
            remangaId: row.id,
            dir: row.dir,
            branchId: null,
        },
    };
}

async function fetchListPage(page) {
    const params = new URLSearchParams({
        count: String(COUNT),
        page: String(page),
        ordering: '-total_views',
    });
    const data = await apiGet(`${API}/titles/?${params}`);
    return data.content || [];
}

function loadExistingCatalog() {
    try {
        if (!fs.existsSync(OUT_FILE)) return new Map();
        const parsed = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
        const items = Array.isArray(parsed?.items) ? parsed.items : [];
        return new Map(items.filter((item) => item?.id).map((item) => [item.id, item]));
    } catch (_) {
        return new Map();
    }
}

function mergeExistingItem(item, existingById) {
    const old = existingById.get(item.id);
    if (!old) return item;
    return {
        ...item,
        ...old,
        _remanga: {
            ...(item._remanga || {}),
            ...(old._remanga || {}),
        },
    };
}

async function fetchListPageWithRetry(page) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        const rows = await fetchListPage(page);
        if (rows.length || attempt === 3) return rows;
        console.warn(`  empty page ${page}, retry ${attempt}/3…`);
        await sleep(500 * attempt);
    }
    return [];
}

async function enrichItem(item) {
    if (!item._remanga?.dir) return item;
    if (item._remanga?.branchId && item.description && item.genres?.length) return item;
    await sleep(ENRICH_DELAY_MS);
    try {
        const d = await apiGet(`${API}/v2/titles/${encodeURIComponent(item._remanga.dir)}/`);
        if (d.genres?.length) {
            item.genres = d.genres.map((g) => g.name).filter(Boolean);
        }
        if (d.categories?.length) {
            item.categories = d.categories.map((c) => c.name).filter(Boolean);
        }
        if (d.description) {
            item.description = stripHtml(d.description);
        }
        if (d.creators?.length) {
            item.author = d.creators
                .map((c) => c.name || c.person?.name)
                .filter(Boolean)
                .join(', ');
        }
        const branch = d.branches?.[0];
        if (branch?.id) {
            item._remanga.branchId = branch.id;
        }
        if (branch?.count_chapters != null) {
            item.totalChapters = branch.count_chapters;
        }
        if (!item.cover && d.cover) {
            item.cover = coverUrl(d.cover);
            item.poster = item.cover;
        }
        if (d.avg_rating && !item.rating) {
            item.rating = Math.round(parseFloat(d.avg_rating) * 10) / 10;
        }
    } catch (e) {
        console.warn('  enrich skip', item._remanga.dir, e.message);
    }
    return item;
}

async function enrichAll(items) {
    if (!ENRICH) return items;
    console.log(`Обогащение v2 (${items.length} тайтлов, concurrency ${ENRICH_CONCURRENCY})…`);
    let idx = 0;
    async function worker() {
        while (idx < items.length) {
            const i = idx++;
            await enrichItem(items[i]);
            if ((i + 1) % 100 === 0) console.log(`  enriched ${i + 1}/${items.length}`);
        }
    }
    await Promise.all(Array.from({ length: ENRICH_CONCURRENCY }, () => worker()));
    return items;
}

async function main() {
    console.log(`ReManga catalog: pages=${PAGES}, count=${COUNT}, target=${TARGET}, enrich=${ENRICH}`);

    const seen = new Set();
    const items = [];
    const existingById = loadExistingCatalog();
    let emptyStreak = 0;

    for (let page = 1; page <= PAGES && items.length < TARGET; page++) {
        console.log(`Страница ${page}/${PAGES}…`);
        const rows = await fetchListPageWithRetry(page);
        if (!rows.length) {
            emptyStreak++;
            if (emptyStreak >= 5) break;
            continue;
        }
        emptyStreak = 0;
        for (const row of rows) {
            if (!row?.id || !row.dir || seen.has(row.id)) continue;
            seen.add(row.id);
            items.push(mergeExistingItem(mapListItem(row), existingById));
            if (items.length >= TARGET) break;
        }
        await sleep(120);
    }

    console.log(`Собрано из списка: ${items.length}`);
    await enrichAll(items);

    const withChapters = items.filter((i) => i.totalChapters > 0).length;
    const out = {
        meta: {
            source: 'remanga.org',
            builtAt: new Date().toISOString(),
            count: items.length,
            withChapters,
            pages: PAGES,
            target: TARGET,
            ordering: '-total_views',
        },
        items,
    };

    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(out));
    const mb = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);
    console.log(`Готово: ${OUT_FILE} (${items.length} тайтлов, ${withChapters} с главами, ${mb} MB)`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
