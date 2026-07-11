// Универсальный скрипт для применения навигации ко всем страницам
// Добавляется в конец body перед закрывающим тегом

(function injectLive2dWidgetEverywhere() {
    if (typeof window === 'undefined' || window.__reminkoLive2dInjected) return;
    window.__reminkoLive2dInjected = true;
    try {
        var cur = document.currentScript;
        if (!cur || !cur.src) {
            var list = document.querySelectorAll('script[src*="apply-navigation"]');
            cur = list[list.length - 1];
        }
        if (!cur || !cur.src) return;
        var base = cur.src.replace(/[^/]+$/, '');
        var s = document.createElement('script');
        s.src = base + 'live2d-widget-init.js?v=mobile-v4-5';
        s.async = true;
        (document.head || document.documentElement).appendChild(s);
    } catch (e) {
        console.warn('[Live2D] inject:', e);
    }
})();

(function injectSupportMinkoChatScript() {
    if (typeof window === 'undefined' || window.__reminkoSupportChatInjected) return;
    window.__reminkoSupportChatInjected = true;
    try {
        var cur = document.currentScript;
        if (!cur || !cur.src) {
            var list = document.querySelectorAll('script[src*="apply-navigation"]');
            cur = list[list.length - 1];
        }
        if (!cur || !cur.src) return;
        var base = cur.src.replace(/[^/]+$/, '');
        var s = document.createElement('script');
        s.src = base + 'support-minko-chat.js';
        (document.body || document.documentElement).appendChild(s);
    } catch (e) {
        console.warn('[Support Minko] inject:', e);
    }
})();

(function() {
    'use strict';
    
    // Проверяем, нужно ли применять навигацию
    const path = window.location.pathname;
    const skipPages = ['reset-password.html', 'payment-success.html', 'cancel-success.html'];
    const shouldSkip = skipPages.some(page => path.includes(page));
    
    if (shouldSkip) {
        const fireSkip = () => {
            document.body.classList.add('reminko-ui-ready');
            try {
                window.dispatchEvent(new CustomEvent('reminko:navigation-applied'));
            } catch (e) {
                /* ignore */
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fireSkip, { once: true });
        } else {
            fireSkip();
        }
        return;
    }
    
    let __reminkoNavInitPromise = null;

    async function initNavigation() {
        if (__reminkoNavInitPromise) return __reminkoNavInitPromise;

        __reminkoNavInitPromise = (async () => {
            while (!window.navigationManager) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
            try {
                if (typeof window.reminkoEnsureMaintenanceGate === 'function') {
                    await window.reminkoEnsureMaintenanceGate();
                }
            } catch (e) {
                console.warn('[Maintenance gate]', e);
            }
            if (window.__reminkoMaintenancePageReplaced) {
                try {
                    window.dispatchEvent(new CustomEvent('reminko:navigation-applied'));
                } catch (err) {
                    /* ignore */
                }
                return;
            }
            window.navigationManager.applyNavigation();
        })();

        return __reminkoNavInitPromise;
    }

    function scheduleNavigationInit() {
        const run = () => {
            void initNavigation();
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run, { once: true });
        } else {
            run();
        }
    }

    scheduleNavigationInit();
})();
