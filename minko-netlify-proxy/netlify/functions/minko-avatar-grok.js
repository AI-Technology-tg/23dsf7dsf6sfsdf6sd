/**
 * Генерация аватара через xAI (Grok) Images API + лимит 3 шт. / 24 ч на пользователя (Supabase).
 *
 * Env:
 *   XAI_API_KEY или GROK_API_KEY или MINKO_XAI_API_KEY
 *   XAI_IMAGE_MODEL (опц., по умолчанию grok-imagine-image — при ошибке укажите актуальную модель из кабинета xAI)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY — для валидации JWT пользователя
 *
 * POST JSON: { prompt: string }
 * Header: Authorization: Bearer <supabase_access_token>
 *
 * GET — квота: { limit, used, remaining, resetsAt }
 */
const XAI_URL = 'https://api.x.ai/v1/images/generations';
const LIMIT = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000;

const NSFW_RE =
    /(nude|naked|nsfw|porn|porno|sexual|xxx|erotic|fetish|hentai|loli|shota|rape|nudes?|nipple|genital|penis|vagina|boobs?|tits\b|\bnsfw\b)/i;
const NSFW_RU =
    /(порно|секс|эротик|голый|голая|голые|нюд|интим|фетиш|хентай|извращ|генитал|мастурб|камасутр|18\s*\+)/i;

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };
}

function ok(body) {
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(body) };
}

function err(status, msg, extra) {
    return {
        statusCode: status,
        headers: corsHeaders(),
        body: JSON.stringify({ error: { message: msg }, ...extra })
    };
}

function getXaiKey() {
    return (
        process.env.XAI_API_KEY ||
        process.env.GROK_API_KEY ||
        process.env.MINKO_XAI_API_KEY ||
        ''
    ).trim();
}

function getImageModel() {
    return (process.env.XAI_IMAGE_MODEL || 'grok-imagine-image').trim();
}

async function verifySupabaseUser(jwt) {
    const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const anon = (process.env.SUPABASE_ANON_KEY || '').trim();
    if (!base || !anon || !jwt) return null;
    const r = await fetch(`${base}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${jwt}`, apikey: anon }
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j && j.id ? j : null;
}

async function countGenerationsInWindow(userId) {
    const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!base || !key) return { rows: [], error: 'no_service_key' };

    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const url = `${base}/rest/v1/avatar_ai_generations?user_id=eq.${encodeURIComponent(
        userId
    )}&created_at=gte.${encodeURIComponent(since)}&select=id,created_at&order=created_at.asc`;
    const r = await fetch(url, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const rows = await r.json().catch(() => []);
    if (!r.ok || !Array.isArray(rows)) return { rows: [], error: 'count_failed' };
    return { rows };
}

async function insertGeneration(userId) {
    const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!base || !key) return false;
    const r = await fetch(`${base}/rest/v1/avatar_ai_generations`, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
        },
        body: JSON.stringify({ user_id: userId })
    });
    return r.ok;
}

function quotaFromRows(rows) {
    const used = rows.length;
    const remaining = Math.max(0, LIMIT - used);
    let resetsAt = null;
    if (used >= LIMIT && rows[0] && rows[0].created_at) {
        const t = new Date(rows[0].created_at).getTime() + WINDOW_MS;
        resetsAt = new Date(t).toISOString();
    }
    return { limit: LIMIT, used, remaining, resetsAt };
}

function buildPrompt(userLine) {
    const line = String(userLine || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400);
    return (
        'Square anime-style user avatar, bust-up portrait, clean illustration, bright anime art style, ' +
        'professional character design, soft shading, appealing colors. ' +
        'Strictly SFW: fully dressed, non-sexual, no nudity, no fetish, no minors in suggestive context. ' +
        'Single character focus, simple background. User description (interpret in anime style only): ' +
        line
    );
}

exports.handler = async (event) => {
    const headers = corsHeaders();
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

    const apiKey = getXaiKey();
    const svc = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

    const user = await verifySupabaseUser(jwt);
    if (!user || !user.id) {
        return err(401, 'Нужна авторизация: войдите в аккаунт и обновите страницу.');
    }

    if (!svc) {
        return err(503, 'На сервере не настроен SUPABASE_SERVICE_ROLE_KEY.');
    }

    const { rows: windowRows } = await countGenerationsInWindow(user.id);
    const quota = quotaFromRows(windowRows);

    if (event.httpMethod === 'GET') {
        return ok(quota);
    }

    if (event.httpMethod !== 'POST') {
        return err(404, 'Not found');
    }

    if (!apiKey) {
        return err(503, 'На сервере не задан XAI_API_KEY (или GROK_API_KEY).');
    }

    let body = event.body;
    if (event.isBase64Encoded && body) body = Buffer.from(body, 'base64').toString('utf8');
    let json;
    try {
        json = JSON.parse(body || '{}');
    } catch {
        return err(400, 'Некорректный JSON');
    }

    const rawPrompt = (json.prompt != null ? String(json.prompt) : '').trim();
    if (rawPrompt.length < 4) {
        return err(400, 'Опиши образ чуть подробнее (от 4 символов).');
    }
    if (NSFW_RE.test(rawPrompt) || NSFW_RU.test(rawPrompt)) {
        return err(
            400,
            'Такой запрос недопустим. Только безопасный аниме-стиль, без сексуального и откровенного контента.'
        );
    }

    if (quota.remaining <= 0) {
        return {
            statusCode: 429,
            headers: corsHeaders(),
            body: JSON.stringify({
                error: {
                    message: `Лимит ${LIMIT} генераций на 24 часа исчерпан. Следующая попытка после сброса окна.`
                },
                resetsAt: quota.resetsAt,
                remaining: 0,
                limit: LIMIT
            })
        };
    }

    const prompt = buildPrompt(rawPrompt);

    let xaiRes;
    try {
        xaiRes = await fetch(XAI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: getImageModel(),
                prompt,
                n: 1,
                response_format: 'b64_json'
            })
        });
    } catch (e) {
        console.error('[minko-avatar-grok] xai fetch', e);
        return err(502, 'Не удалось связаться с сервисом генерации изображений.');
    }

    const xaiData = await xaiRes.json().catch(() => ({}));
    if (!xaiRes.ok) {
        console.error('[minko-avatar-grok] xai error', xaiRes.status, xaiData);
        return err(
            502,
            (xaiData && xaiData.error && (xaiData.error.message || xaiData.error)) ||
                `Ошибка генерации (${xaiRes.status}). Проверьте модель в XAI_IMAGE_MODEL.`
        );
    }

    const item = xaiData.data && xaiData.data[0];
    let url = item && item.url;
    if (!url && item && item.b64_json) {
        url = 'data:image/png;base64,' + item.b64_json;
    }
    if (!url) {
        console.error('[minko-avatar-grok] unexpected response', xaiData);
        return err(502, 'Пустой ответ картинки. Уточните модель в кабинете xAI.');
    }

    const inserted = await insertGeneration(user.id);
    if (!inserted) {
        console.error('[minko-avatar-grok] insert failed');
    }

    const next = await countGenerationsInWindow(user.id);
    const q2 = quotaFromRows(next.rows);

    return ok({
        url,
        remaining: q2.remaining,
        limit: LIMIT,
        resetsAt: q2.resetsAt
    });
};
