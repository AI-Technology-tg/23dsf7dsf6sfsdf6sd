#!/usr/bin/env node
/*
 * Local ReManga proxy for Re-Minko.
 *
 * Run:
 *   node scripts/proxy/remanga-local-proxy.js
 *
 * Then expose it for the public site with Cloudflare Tunnel:
 *   cloudflared tunnel --url http://localhost:8787
 */

const http = require('http');

const PORT = Math.max(1, parseInt(process.env.REMANGA_PROXY_PORT || '8787', 10));
const ALLOWED_HOST = 'api.remanga.org';
const SITE = 'https://remanga.org';

function corsHeaders(contentType) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
        'Content-Type': contentType || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    };
}

function send(res, statusCode, body, contentType) {
    res.writeHead(statusCode, corsHeaders(contentType));
    res.end(body);
}

function parseTarget(reqUrl) {
    const current = new URL(reqUrl, 'http://localhost');
    const raw = current.searchParams.get('url');
    if (!raw) return null;
    const target = new URL(raw);
    if (target.protocol !== 'https:' || target.hostname !== ALLOWED_HOST) {
        throw new Error('Host not allowed');
    }
    if (!target.pathname.startsWith('/api/')) {
        throw new Error('Path not allowed');
    }
    return target;
}

async function handle(req, res) {
    if (req.method === 'OPTIONS') {
        send(res, 204, '');
        return;
    }
    if (req.method !== 'GET') {
        send(res, 405, JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    let target;
    try {
        target = parseTarget(req.url);
    } catch (e) {
        send(res, 403, JSON.stringify({ error: e.message || 'Forbidden' }));
        return;
    }

    if (!target) {
        send(
            res,
            200,
            JSON.stringify({
                ok: true,
                service: 'remanga-local-proxy',
                usage: '/?url=https%3A%2F%2Fapi.remanga.org%2Fapi%2F...',
            })
        );
        return;
    }

    try {
        const upstream = await fetch(target.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json, */*',
                'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                Origin: SITE,
                Referer: `${SITE}/`,
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
            },
        });
        const text = await upstream.text();
        const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
        send(res, upstream.status, text || '{}', contentType.includes('json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8');
    } catch (e) {
        send(res, 502, JSON.stringify({ error: 'Upstream fetch failed', details: e.message || String(e) }));
    }
}

const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
        send(res, 500, JSON.stringify({ error: 'Proxy crashed', details: e.message || String(e) }));
    });
});

server.listen(PORT, () => {
    console.log(`ReManga proxy running: http://localhost:${PORT}`);
});
