/**
 * SEO-хелпер: обновление title, description, canonical, Open Graph на страницах тайтлов.
 */
(function (global) {
    'use strict';

    const DEFAULT_ORIGIN = 'https://re-minko-anime.com';

    function siteOrigin() {
        const cfg = global.APP_CONFIG && global.APP_CONFIG.siteOrigin;
        if (cfg && typeof cfg === 'string') return cfg.replace(/\/$/, '');
        if (global.location && global.location.origin && !String(global.location.origin).startsWith('file')) {
            return global.location.origin;
        }
        return DEFAULT_ORIGIN;
    }

    function upsertMeta(nameOrProp, content, isProperty) {
        if (!content) return;
        const sel = isProperty ? `meta[property="${nameOrProp}"]` : `meta[name="${nameOrProp}"]`;
        let el = document.querySelector(sel);
        if (!el) {
            el = document.createElement('meta');
            if (isProperty) el.setAttribute('property', nameOrProp);
            else el.setAttribute('name', nameOrProp);
            document.head.appendChild(el);
        }
        el.setAttribute('content', content);
    }

    function upsertLink(rel, href) {
        if (!href) return;
        let el = document.querySelector(`link[rel="${rel}"]`);
        if (!el) {
            el = document.createElement('link');
            el.setAttribute('rel', rel);
            document.head.appendChild(el);
        }
        el.setAttribute('href', href);
    }

    function upsertJsonLd(id, data) {
        if (!data) return;
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('script');
            el.type = 'application/ld+json';
            el.id = id;
            document.head.appendChild(el);
        }
        el.textContent = JSON.stringify(data);
    }

    function updatePageSeo(opts) {
        if (!opts) return;
        const title = opts.title ? String(opts.title).trim() : '';
        const description = opts.description ? String(opts.description).trim().slice(0, 320) : '';
        const path = opts.path ? String(opts.path) : global.location.pathname + global.location.search;
        const canonical = opts.canonical || `${siteOrigin()}${path.startsWith('/') ? path : '/' + path}`;
        const image = opts.image || `${siteOrigin()}/Fons/fonG.jpg`;

        if (title) document.title = title;
        if (description) upsertMeta('description', description, false);
        upsertLink('canonical', canonical);
        upsertMeta('og:title', title || document.title, true);
        upsertMeta('og:description', description, true);
        upsertMeta('og:url', canonical, true);
        upsertMeta('og:image', image, true);
        upsertMeta('og:type', opts.ogType || 'website', true);
        upsertMeta('twitter:card', 'summary_large_image', false);
        upsertMeta('twitter:title', title || document.title, false);
        upsertMeta('twitter:description', description, false);
        upsertMeta('twitter:image', image, false);
        if (opts.jsonLd) upsertJsonLd('reminko-page-jsonld', opts.jsonLd);
    }

    global.reminkoUpdatePageSeo = updatePageSeo;
})(typeof window !== 'undefined' ? window : globalThis);
