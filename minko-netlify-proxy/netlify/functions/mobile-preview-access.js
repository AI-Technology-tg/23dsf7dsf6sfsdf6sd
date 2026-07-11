const ALLOWED_IPS = new Set(['46.125.148.209']);

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Cache-Control': 'no-store, max-age=0',
            'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(body)
    };
}

function firstForwardedIp(value) {
    return String(value || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)[0] || '';
}

function clientIp(event) {
    const headers = event.headers || {};
    return (
        headers['x-nf-client-connection-ip'] ||
        headers['X-Nf-Client-Connection-Ip'] ||
        firstForwardedIp(headers['x-forwarded-for'] || headers['X-Forwarded-For']) ||
        event.requestContext?.identity?.sourceIp ||
        ''
    );
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'GET') {
        return json(405, { allowed: false, error: 'Method not allowed' });
    }

    const ip = clientIp(event);
    return json(200, {
        allowed: ALLOWED_IPS.has(ip),
        ip
    });
};
