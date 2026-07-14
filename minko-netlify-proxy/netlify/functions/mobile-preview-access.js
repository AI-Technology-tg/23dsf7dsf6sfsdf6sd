const ALLOWED_IPS = new Set(['46.125.148.209']);

const { corsHeaders: buildCorsHeaders, clientIp } = require('./_cors');

function json(statusCode, body, event) {
    return {
        statusCode,
        headers: {
            ...buildCorsHeaders(event, 'GET, OPTIONS'),
            'Cache-Control': 'no-store, max-age=0',
            'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(body)
    };
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return json(204, {}, event);
    if (event.httpMethod !== 'GET') {
        return json(405, { allowed: false, error: 'Method not allowed' }, event);
    }

    const ip = clientIp(event);
    return json(200, { allowed: ALLOWED_IPS.has(ip) }, event);
};
