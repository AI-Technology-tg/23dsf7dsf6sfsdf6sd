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
                Referer: 'https://remanga.org/'
            }
        });
        const text = await res.text();
        return { statusCode: res.status, headers, body: text || '{}' };
    } catch (e) {
        console.error('[remanga-proxy]', e);
        return {
            statusCode: 502,
            headers,
            body: JSON.stringify({ error: 'Upstream fetch failed' })
        };
    }
};
