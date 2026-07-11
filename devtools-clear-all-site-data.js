(async function clearAllReMinkoSiteData() {
    const origin = location.origin;
    const host = location.hostname;

    // --- localStorage + sessionStorage ---
    try {
        localStorage.clear();
        console.log('[clear] localStorage очищен');
    } catch (e) {
        console.warn('[clear] localStorage:', e);
    }
    try {
        sessionStorage.clear();
        console.log('[clear] sessionStorage очищен');
    } catch (e) {
        console.warn('[clear] sessionStorage:', e);
    }

    // --- document.cookie (только не-HttpOnly для текущего пути/origin) ---
    try {
        const parts = document.cookie ? document.cookie.split(';') : [];
        const paths = ['/', window.location.pathname];
        const domains = [undefined, host, '.' + host];
        for (const part of parts) {
            const name = part.split('=')[0].trim();
            if (!name) continue;
            for (const path of paths) {
                for (const domain of domains) {
                    let c = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=' + (path || '/');
                    if (domain) c += ';domain=' + domain;
                    document.cookie = c;
                }
            }
        }
        console.log('[clear] document.cookie — попытка сброса (доступные из JS)');
    } catch (e) {
        console.warn('[clear] cookies:', e);
    }

    // --- IndexedDB ---
    try {
        if (indexedDB.databases) {
            const dbs = await indexedDB.databases();
            for (const db of dbs) {
                if (db && db.name) {
                    indexedDB.deleteDatabase(db.name);
                    console.log('[clear] IndexedDB удалена:', db.name);
                }
            }
        }
    } catch (e) {
        console.warn('[clear] IndexedDB:', e);
    }

    // --- Cache Storage (Cache API) ---
    try {
        if (typeof caches !== 'undefined' && caches.keys) {
            const keys = await caches.keys();
            for (const k of keys) {
                await caches.delete(k);
                console.log('[clear] Cache удалён:', k);
            }
        }
    } catch (e) {
        console.warn('[clear] Cache API:', e);
    }

    // --- Service Workers ---
    try {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) {
                await r.unregister();
                console.log('[clear] Service Worker снят');
            }
        }
    } catch (e) {
        console.warn('[clear] Service Worker:', e);
    }

    console.log('%c[clear] Готово: ' + origin + ' — перезагрузка…', 'color:#22c55e;font-weight:bold');
    setTimeout(() => location.reload(), 400);
})();