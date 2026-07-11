/**
 * Анонимная аналитика посещений для панели создателя (site_visit_events).
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;
    const path = window.location.pathname || '';
    if (path.includes('admin.html')) return;

    const VISITOR_KEY = 'reminko_visitor_id_v1';
    const DEDUP_MS = 8000;
    let lastSent = 0;

    function visitorId() {
        try {
            let id = localStorage.getItem(VISITOR_KEY);
            if (!id) {
                id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
                localStorage.setItem(VISITOR_KEY, id);
            }
            return id;
        } catch (_) {
            return 'v_anon';
        }
    }

    async function trackPageView() {
        if (!window.supabaseClient) return;
        const now = Date.now();
        if (now - lastSent < DEDUP_MS) return;
        lastSent = now;

        let userId = null;
        try {
            const { data } = await window.supabaseClient.auth.getUser();
            userId = data?.user?.id || null;
        } catch (_) {}

        const row = {
            visitor_id: visitorId(),
            path: path || '/',
            page_title: document.title || '',
            referrer: document.referrer ? String(document.referrer).slice(0, 512) : null,
            event_kind: 'pageview',
            user_id: userId,
            user_agent: navigator.userAgent ? String(navigator.userAgent).slice(0, 512) : null,
        };

        try {
            await window.supabaseClient.from('site_visit_events').insert(row);
        } catch (_) {
            /* таблица/RPC может отсутствовать */
        }
    }

    function schedule() {
        if (document.readyState === 'complete') {
            setTimeout(trackPageView, 1200);
        } else {
            window.addEventListener(
                'load',
                () => {
                    setTimeout(trackPageView, 1200);
                },
                { once: true }
            );
        }
    }

    window.addEventListener('reminko:navigation-applied', () => {
        setTimeout(trackPageView, 1500);
    });

    schedule();
})();
