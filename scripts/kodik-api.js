/**
 * Kodik API: напрямую (config.local.js) или через Netlify-прокси (KODIK_API_TOKEN в env).
 */
(function () {
    function kodikCfg() {
        return (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.kodik) || {};
    }

    function isLocalDevHost() {
        if (typeof window === 'undefined' || !window.location) return true;
        const h = window.location.hostname || '';
        return h === 'localhost' || h === '127.0.0.1' || window.location.protocol === 'file:';
    }

    function clientApiToken() {
        const t = kodikCfg().apiToken;
        return t && typeof t === 'string' && t.trim() ? t.trim() : '';
    }

    function proxyUrl() {
        const rel = kodikCfg().apiProxyUrl || '/.netlify/functions/kodik-proxy';
        if (/^https?:\/\//i.test(rel)) return rel;
        if (typeof window !== 'undefined' && window.location && window.location.origin) {
            return window.location.origin.replace(/\/$/, '') + (rel.startsWith('/') ? rel : '/' + rel);
        }
        return rel;
    }

    function useKodikProxy() {
        if (clientApiToken()) return false;
        if (kodikCfg().useKodikProxy === false) return false;
        return !isLocalDevHost();
    }

    function apiToken() {
        const t = clientApiToken();
        if (t) return t;
        if (useKodikProxy()) return '__proxy__';
        throw new Error(
            '[Kodik API] Нет токена. Локально: config.local.js → kodik.apiToken. На сайте: KODIK_API_TOKEN в Netlify.'
        );
    }

    function baseUrl() {
        return (kodikCfg().apiOrigin || 'https://kodik-api.com').replace(/\/$/, '');
    }

    function normalizePath(path) {
        const p = String(path || '').trim();
        if (!p) return '/';
        return p.startsWith('/') ? p : `/${p}`;
    }

    async function requestDirect(path, params, opts) {
        const token = clientApiToken();
        const merged = Object.assign({}, params || {}, { token });
        const method = ((opts && opts.method) || 'GET').toUpperCase();
        const url = new URL(baseUrl() + normalizePath(path));

        if (method === 'GET') {
            Object.keys(merged).forEach((key) => {
                const v = merged[key];
                if (v !== undefined && v !== null && v !== '') {
                    url.searchParams.set(key, String(v));
                }
            });
            const res = await fetch(url.toString(), { method: 'GET', credentials: 'omit' });
            return parseResponse(res);
        }

        const body = new URLSearchParams();
        Object.keys(merged).forEach((key) => {
            const v = merged[key];
            if (v !== undefined && v !== null && v !== '') {
                body.append(key, String(v));
            }
        });
        const res = await fetch(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            credentials: 'omit'
        });
        return parseResponse(res);
    }

    async function requestViaProxy(path, params, opts) {
        const method = ((opts && opts.method) || 'GET').toUpperCase();
        const url = new URL(proxyUrl());
        url.searchParams.set('path', normalizePath(path));
        Object.keys(params || {}).forEach((key) => {
            const v = params[key];
            if (v !== undefined && v !== null && v !== '') {
                url.searchParams.set(key, String(v));
            }
        });

        if (method === 'GET') {
            const res = await fetch(url.toString(), { method: 'GET', credentials: 'omit' });
            return parseResponse(res);
        }

        const body = new URLSearchParams();
        Object.keys(params || {}).forEach((key) => {
            const v = params[key];
            if (v !== undefined && v !== null && v !== '') {
                body.append(key, String(v));
            }
        });
        url.searchParams.set('path', normalizePath(path));
        const res = await fetch(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            credentials: 'omit'
        });
        return parseResponse(res);
    }

    async function request(path, params, opts) {
        if (useKodikProxy()) {
            return requestViaProxy(path, params, opts);
        }
        return requestDirect(path, params, opts);
    }

    async function parseResponse(res) {
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch (_) {
            const err = new Error(`[Kodik API] Ответ не JSON: ${text.slice(0, 160)}`);
            err.status = res.status;
            throw err;
        }
        if (!res.ok) {
            const err = new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    function hasToken() {
        if (clientApiToken()) return true;
        return useKodikProxy();
    }

    function usesProxy() {
        return useKodikProxy();
    }

    window.KodikApi = {
        request,
        hasToken,
        usesProxy,
        qualities: (p) => request('/qualities', p || {}),
        translations: (p) => request('/translations/v2', p || {}),
        countries: (p) => request('/countries', p || {}),
        genres: (p) => request('/genres', p || {}),
        years: (p) => request('/years', p || {}),
        list: (p) => request('/list', p || {}),
        search: (p) => request('/search', p || {})
    };
})();
