/**
 * Подключение блоков Яндекс РТБ (context) на странице info.html.
 * ID блоков задаются в config.local.js → APP_CONFIG.yandexRtb.infoPageBlockIds
 */
(function () {
    function safeElId(blockId) {
        return 'yandex_rtb_' + String(blockId).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function run() {
        var cfg = typeof window.APP_CONFIG !== 'undefined' && window.APP_CONFIG.yandexRtb;
        var ids = cfg && Array.isArray(cfg.infoPageBlockIds) ? cfg.infoPageBlockIds : [];
        var root = document.getElementById('info-yandex-rtb-root');
        var wrap = document.getElementById('info-ad-yandex-wrap');
        if (!root || !ids.length) {
            if (wrap) wrap.hidden = true;
            return;
        }

        var setupNote = wrap.querySelector('.info-ad-yandex-note');
        if (setupNote) setupNote.hidden = true;

        window.yaContextCb = window.yaContextCb || [];

        ids.forEach(function (blockId) {
            var bid = typeof blockId === 'string' ? blockId.trim() : '';
            if (!bid) return;
            var elId = safeElId(bid);
            var div = document.createElement('div');
            div.id = elId;
            div.className = 'info-ad-rtb-slot';
            root.appendChild(div);
            window.yaContextCb.push(function () {
                try {
                    if (typeof Ya !== 'undefined' && Ya.Context && Ya.Context.AdvManager) {
                        Ya.Context.AdvManager.render({
                            blockId: bid,
                            renderTo: elId
                        });
                    }
                } catch (e) {
                    console.warn('[Yandex RTB]', e);
                }
            });
        });

        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://yandex.ru/ads/system/context.js';
        document.head.appendChild(s);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
