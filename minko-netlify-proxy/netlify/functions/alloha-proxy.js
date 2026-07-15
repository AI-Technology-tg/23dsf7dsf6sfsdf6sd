/**
 * Прокси Alloha TV API — токен только на сервере (Netlify env: ALLOHA_API_TOKEN).
 * GET /.netlify/functions/alloha-proxy?shikimori=123&season=1&episode=1
 */
const ALLOHA_ORIGIN = 'https://api.alloha.tv';
const TOKEN = (process.env.ALLOHA_API_TOKEN || '').trim();
const ALLOWED_PARAMS = new Set([
    'mal',
    'shikimori',
    'kp',
    'imdb',
    'tmdb',
    'wa_id',
    'world_art',
    'name',
    'list',
    'order',
    'page',
    'uhd'
]);
const { corsHeaders: buildCorsHeaders } = require('./_cors');

function corsHeaders(event) {
    return {
        ...buildCorsHeaders(event, 'GET, OPTIONS'),
        'Content-Type': 'application/json; charset=utf-8'
    };
}

function hasLookupId(q) {
    return ['mal', 'shikimori', 'kp', 'imdb', 'tmdb', 'wa_id', 'world_art', 'name'].some((k) => {
        const v = q[k];
        return v !== undefined && v !== null && String(v).trim() !== '';
    });
}

exports.handler = async (event) => {
    const headers = corsHeaders(event);
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!TOKEN) {
        return {
            statusCode: 503,
            headers,
            body: JSON.stringify({
                error: 'ALLOHA_API_TOKEN не задан в переменных окружения Netlify'
            })
        };
    }

    const q = event.queryStringParameters || {};
    if (!hasLookupId(q)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Укажите mal, shikimori, kp или другой id для поиска' })
        };
    }

    let target;
    try {
        target = new URL(`${ALLOHA_ORIGIN}/`);
    } catch (_) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Alloha proxy error' }) };
    }
    target.searchParams.set('token', TOKEN);
    Object.keys(q).forEach((key) => {
        if (!ALLOWED_PARAMS.has(key)) return;
        const v = q[key];
        if (v !== undefined && v !== null && String(v) !== '') {
            target.searchParams.set(key, String(v));
        }
    });

    try {
        const res = await fetch(target.toString(), { method: 'GET' });
        const text = await res.text();
        return {
            statusCode: res.status,
            headers,
            body: text || '{}'
        };
    } catch (e) {
        console.error('[alloha-proxy]', e);
        return {
            statusCode: 502,
            headers,
            body: JSON.stringify({ error: 'Alloha proxy error' })
        };
    }
};
