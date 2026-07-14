/** Общие CORS-правила для Netlify Functions Re-Minko. */
const ALLOWED_ORIGINS = new Set([
    'https://re-minko-anime.com',
    'https://ai-technology-tg.github.io',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
]);

function parseExtraOrigins() {
    return (process.env.MINKO_EXTRA_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function allowedOrigin(event) {
    const origin = event?.headers?.origin || event?.headers?.Origin || '';
    if (!origin) return 'https://re-minko-anime.com';
    if (ALLOWED_ORIGINS.has(origin)) return origin;
    if (parseExtraOrigins().includes(origin)) return origin;
    return null;
}

function corsHeaders(event, methods, extraHeaders) {
    const origin = allowedOrigin(event);
    const headers = {
        'Access-Control-Allow-Headers': extraHeaders || 'Content-Type',
        'Access-Control-Allow-Methods': methods,
        Vary: 'Origin',
        'Content-Type': 'application/json'
    };
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    return headers;
}

function clientIp(event) {
    const headers = event.headers || {};
    const forwarded = String(headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)[0];
    return (
        headers['x-nf-client-connection-ip'] ||
        headers['X-Nf-Client-Connection-Ip'] ||
        forwarded ||
        event.requestContext?.identity?.sourceIp ||
        'unknown'
    );
}

module.exports = { allowedOrigin, corsHeaders, clientIp, ALLOWED_ORIGINS };
