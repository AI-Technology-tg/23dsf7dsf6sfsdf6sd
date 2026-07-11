/**
 * Live2D после полной загрузки и скрытия экрана загрузки. Только модель Рэм.
 * @see https://www.npmjs.com/package/live2d-widget
 */
(function () {
    if (window.__reminkoLive2dWidgetStarted) return;

    var REM = {
        jsonPath: 'https://unpkg.com/live2d-widget-model-rem@1.0.1/assets/rem.model.json',
        scale: 1.22,
        display: { width: 232, height: 464, vOffset: -115 },
        opacity: 0.62
    };

    function injectLive2dCss() {
        if (document.getElementById('reminko-live2d-css')) return;
        var cur = document.currentScript;
        if (!cur || !cur.src) {
            var list = document.querySelectorAll('script[src*="live2d-widget-init"]');
            cur = list[list.length - 1];
        }
        if (!cur || !cur.src) return;
        var href;
        try {
            href = new URL('../styles/live2d-widget.css', cur.src).href;
        } catch (e) {
            return;
        }
        var link = document.createElement('link');
        link.id = 'reminko-live2d-css';
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    function startLive2d() {
        if (window.__reminkoLive2dWidgetStarted) return;
        window.__reminkoLive2dWidgetStarted = true;
        injectLive2dCss();
        var sc = document.createElement('script');
        sc.src =
            'https://cdn.jsdelivr.net/npm/live2d-widget@3.1.4/lib/L2Dwidget.min.js';
        sc.charset = 'utf-8';
        sc.onload = function () {
            var targetOpacity = REM.opacity != null ? REM.opacity : 0.75;
            var display = {
                position: 'right',
                width: REM.display.width,
                height: REM.display.height,
                hOffset: 0,
                vOffset: REM.display.vOffset != null ? REM.display.vOffset : -20
            };

            L2Dwidget.on('create-container', function (el) {
                if (!el || !el.style) return;
                el.style.setProperty('transition', 'opacity 0.55s ease');
                el.style.opacity = '0';
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        el.style.opacity = String(targetOpacity);
                    });
                });
            });
            L2Dwidget.init({
                model: {
                    jsonPath: REM.jsonPath,
                    scale: REM.scale
                },
                display: display,
                mobile: {
                    show: true,
                    scale: 0.5,
                    motion: true
                },
                react: {
                    opacity: targetOpacity
                }
            });
        };
        document.head.appendChild(sc);
    }

    function loadingOverlayGone() {
        var el = document.getElementById('loadingScreen');
        if (!el) return true;
        if (el.style.display === 'none') return true;
        if (el.classList.contains('hidden')) return true;
        try {
            var st = window.getComputedStyle(el);
            if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0) {
                return true;
            }
        } catch (e) {}
        return false;
    }

    function afterWindowLoad(cb) {
        if (document.readyState === 'complete') cb();
        else window.addEventListener('load', cb, { once: true });
    }

    function schedule() {
        afterWindowLoad(function () {
            var el = document.getElementById('loadingScreen');
            if (!el) {
                startLive2d();
                return;
            }
            var done = false;
            var poll = null;
            function go() {
                if (done || window.__reminkoLive2dWidgetStarted) return;
                if (!loadingOverlayGone()) return;
                done = true;
                if (poll) clearInterval(poll);
                window.removeEventListener('reminko:loading-screen-hidden', go);
                startLive2d();
            }
            window.addEventListener('reminko:loading-screen-hidden', go);
            poll = setInterval(go, 80);
            setTimeout(function () {
                if (poll) clearInterval(poll);
                go();
            }, 16000);
        });
    }

    schedule();
})();
