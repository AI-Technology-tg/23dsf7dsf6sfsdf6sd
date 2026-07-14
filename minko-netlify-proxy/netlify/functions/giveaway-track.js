/**
 * POST JSON: { refCode, deviceHash, visitorId?, landingPath? }
 * Запись уникального перехода по реф-ссылке розыгрыша.
 */
const crypto = require('crypto');
const { corsHeaders, clientIp } = require('./_cors');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const IP_SALT = process.env.GIVEAWAY_IP_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'reminko-giveaway';

const rateBuckets = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 40;

function hashIp(ip) {
    return crypto.createHash('sha256').update(`${IP_SALT}:${ip}`).digest('hex');
}

function rateLimitOk(key) {
    const now = Date.now();
    const bucket = rateBuckets.get(key) || { count: 0, reset: now + RATE_WINDOW_MS };
    if (now > bucket.reset) {
        bucket.count = 0;
        bucket.reset = now + RATE_WINDOW_MS;
    }
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    return bucket.count <= RATE_LIMIT;
}

async function recordClick(payload) {
    const url = `${SUPABASE_URL}/rest/v1/rpc/giveaway_record_click`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            p_ref_code: payload.refCode,
            p_device_hash: payload.deviceHash,
            p_visitor_id: payload.visitorId || null,
            p_ip_hash: payload.ipHash || null,
            p_user_agent: payload.userAgent || null,
            p_landing_path: payload.landingPath || null
        })
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 400));
    }
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : { recorded: true, reason: 'ok' };
}

exports.handler = async function handler(event) {
    const headers = corsHeaders(event, 'POST, OPTIONS');

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return { statusCode: 503, headers, body: JSON.stringify({ error: 'Service unavailable' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (_) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const refCode = String(body.refCode || body.ref_code || '').trim().toLowerCase();
    const deviceHash = String(body.deviceHash || body.device_hash || '').trim();
    const visitorId = String(body.visitorId || body.visitor_id || '').trim().slice(0, 64);
    const landingPath = String(body.landingPath || body.landing_path || '').trim().slice(0, 512);

    if (!/^[a-z0-9]{8,16}$/.test(refCode)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid ref code' }) };
    }
    if (deviceHash.length < 32 || deviceHash.length > 128) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid device hash' }) };
    }

    const ip = clientIp(event);
    const rateKey = `${hashIp(ip)}:${refCode}`;
    if (!rateLimitOk(rateKey)) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests' }) };
    }

    try {
        const result = await recordClick({
            refCode,
            deviceHash,
            visitorId,
            ipHash: hashIp(ip),
            userAgent: event.headers['user-agent'] || event.headers['User-Agent'] || '',
            landingPath
        });
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };
    } catch (e) {
        console.error('[giveaway-track]', e.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Track failed' }) };
    }
};
