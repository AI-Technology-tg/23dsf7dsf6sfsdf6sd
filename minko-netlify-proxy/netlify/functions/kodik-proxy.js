/**
 * Прокси Kodik API — токен только на сервере (Netlify env: KODIK_API_TOKEN).
 * GET/POST /.netlify/functions/kodik-proxy?path=/search&title=...
 */
const KODIK_ORIGIN = 'https://kodik-api.com';
const TOKEN = (process.env.KODIK_API_TOKEN || '').trim();

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json; charset=utf-8'
    };
}

function normalizePath(raw) {
    const p = String(raw || '/search').trim();
    if (!p || p === '/') return '/search';
    return p.startsWith('/') ? p : `/${p}`;
}

exports.handler = async (event) => {
    const headers = corsHeaders();
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!TOKEN) {
        return {
            statusCode: 503,
            headers,
            body: JSON.stringify({
                error: 'KODIK_API_TOKEN не задан в переменных окружения Netlify'
            })
        };
    }

    const q = event.queryStringParameters || {};
    const path = normalizePath(q.path);
    const params = Object.assign({}, q, { token: TOKEN });
    delete params.path;

    const target = new URL(KODIK_ORIGIN + path);
    Object.keys(params).forEach((key) => {
        const v = params[key];
        if (v !== undefined && v !== null && String(v) !== '') {
            target.searchParams.set(key, String(v));
        }
    });

    try {
        let res;
        if (event.httpMethod === 'POST') {
            let body = event.body || '';
            if (event.isBase64Encoded && body) {
                body = Buffer.from(body, 'base64').toString('utf8');
            }
            const form = new URLSearchParams(body);
            if (!form.has('token')) form.set('token', TOKEN);
            res = await fetch(target.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form.toString()
            });
        } else {
            res = await fetch(target.toString(), { method: 'GET' });
        }
        const text = await res.text();
        return {
            statusCode: res.status,
            headers,
            body: text || '{}'
        };
    } catch (e) {
        console.error('[kodik-proxy]', e);
        return {
            statusCode: 502,
            headers,
            body: JSON.stringify({ error: 'Kodik proxy error', message: String(e.message || e) })
        };
    }
};
