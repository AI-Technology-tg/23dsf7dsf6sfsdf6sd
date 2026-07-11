/**
 * Прокси ReManga API — обход CORS в браузере.
 * GET /.netlify/functions/remanga-proxy?url=https://api.remanga.org/api/...
 */
const ALLOWED_HOST = 'api.remanga.org';

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json; charset=utf-8'
    };
}

exports.handler = async (event) => {
    const headers = corsHeaders();
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const raw = (event.queryStringParameters || {}).url;
    if (!raw) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing url parameter' }) };
    }

    let target;
    try {
        target = new URL(raw);
    } catch (_) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid url' }) };
    }

    if (target.hostname !== ALLOWED_HOST) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Host not allowed' }) };
    }

    try {
        const res = await fetch(target.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json, */*',
                'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                Origin: 'https://remanga.org',
                Referer: 'https://remanga.org/',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
            }
        });
        const text = await res.text();
        if (!res.ok) {
            console.warn('[remanga-proxy] upstream', res.status, target.pathname);
        }
        const contentType = res.headers.get('content-type') || '';
        return {
            statusCode: res.status,
            headers: {
                ...headers,
                'Content-Type': contentType.includes('json')
                    ? 'application/json; charset=utf-8'
                    : 'text/plain; charset=utf-8'
            },
            body: text || '{}'
        };
    } catch (e) {
        console.error('[remanga-proxy]', e);
        return {
            statusCode: 502,
            headers,
            body: JSON.stringify({ error: 'Upstream fetch failed' })
        };
    }
};
