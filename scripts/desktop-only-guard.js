/**
 * Раньше сайт блокировал телефоны и планшеты. Сейчас мобильные устройства
 * допускаются на сайт и получают класс мобильного preview-оформления.
 */
(function reminkoGtmBoot(w, d, s, l, i) {
    if (w.__reminkoGtmBoot) return;
    w.__reminkoGtmBoot = true;

    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

    var tagSrc = 'https://www.googletagmanager.com/gtm.js?id=' + i;
    var scripts = d.getElementsByTagName(s);
    for (var j = 0; j < scripts.length; j++) {
        if (scripts[j].src === tagSrc) return;
    }

    var f = scripts[0];
    var gtm = d.createElement(s);
    var dl = l !== 'dataLayer' ? '&l=' + l : '';
    gtm.async = true;
    gtm.src = tagSrc + dl;
    if (f && f.parentNode) f.parentNode.insertBefore(gtm, f);
    else (d.head || d.documentElement).appendChild(gtm);

    function injectNoScript() {
        if (d.getElementById('reminko-gtm-noscript')) return;
        var ns = d.createElement('noscript');
        ns.id = 'reminko-gtm-noscript';
        ns.innerHTML =
            '<iframe src="https://www.googletagmanager.com/ns.html?id=' +
            i +
            '" height="0" width="0" style="display:none;visibility:hidden"></iframe>';
        if (d.body) d.body.insertBefore(ns, d.body.firstChild);
    }

    if (d.body) injectNoScript();
    else d.addEventListener('DOMContentLoaded', injectNoScript, { once: true });
})(window, document, 'script', 'dataLayer', 'GTM-W4RSMVH3');

(function remThemeEarlyBoot() {
    if (typeof window === 'undefined' || window.__remThemeEarlyBoot) return;
    window.__remThemeEarlyBoot = true;

    var STORAGE = 'rem_transform_theme';

    function assetRoot() {
        var p = window.location.pathname || '';
        return /\/(catalog|manga|anime)\//i.test(p) ? '../' : '';
    }

    try {
        var theme = localStorage.getItem(STORAGE) === 'dark' ? 'dark' : 'white';
        var root = assetRoot();
        var docEl = document.documentElement;
        docEl.setAttribute('data-rem-theme', theme);

        if (theme === 'dark') {
            if (!document.getElementById('rem-theme-dark-css')) {
                var css = document.createElement('link');
                css.id = 'rem-theme-dark-css';
                css.rel = 'stylesheet';
                css.href = root + 'styles/theme-dark.css?v=rem-theme-4';
                document.head.appendChild(css);
            }
            if (!document.getElementById('rem-dark-bg-preload')) {
                var preload = document.createElement('link');
                preload.id = 'rem-dark-bg-preload';
                preload.rel = 'preload';
                preload.as = 'image';
                preload.href = root + 'Fons/rem-dark-bg.png';
                document.head.appendChild(preload);
            }
        }

        function applyBodyThemeClass() {
            if (!document.body) return;
            document.body.classList.remove('theme-white', 'theme-dark');
            document.body.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-white');
        }

        if (document.body) applyBodyThemeClass();
        else document.addEventListener('DOMContentLoaded', applyBodyThemeClass, { once: true });
    } catch (_) {
        /* ignore */
    }
})();

(function () {
    if (typeof window === 'undefined' || window.__reminkoDesktopGuardRan) return;
    window.__reminkoDesktopGuardRan = true;

    var PHONE_MAX_LONG_SIDE = 1000;
    var PHONE_MAX_SHORT_SIDE = 540;
    var MOBILE_PREVIEW_CLASS = 'reminko-mobile-preview';
    var MOBILE_PREVIEW_ENDPOINT = '/.netlify/functions/mobile-preview-access';
    var mobilePreviewAccessPromise = null;

    function isLikelySearchOrPreviewBot(userAgent) {
        var ua = userAgent || '';
        return /Googlebot|Google-InspectionTool|AdsBot-Google|Mediapartners-Google|bingbot|YandexBot|YandexImages|Slurp|DuckDuckBot|facebookexternalhit|Facebot|TelegramBot|vkShare|Twitterbot|LinkedInBot|Applebot|ia_archiver/i.test(
            ua
        );
    }

    function isLikelyDesktopOs(userAgent) {
        var ua = userAgent || '';
        if (/iPhone|iPod|iPad|Android.*Mobile|Mobile Safari|IEMobile|Opera Mini/i.test(ua)) {
            return false;
        }
        if (/Windows NT|Win64|WOW64|Win32/i.test(ua)) return true;
        if (/Macintosh|Mac OS X/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua)) return true;
        if (/CrOS/i.test(ua)) return true;
        if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return true;
        return false;
    }

    function hasMobileClientHintsSync() {
        try {
            if (navigator.userAgentData && navigator.userAgentData.mobile === true) return true;
        } catch (_) {
            /* ignore */
        }
        return false;
    }

    /** Android / iOS в Client Hints — даже при «Версии для ПК» в Chrome. */
    function hasMobilePlatformHintSync() {
        try {
            var platform = navigator.userAgentData && navigator.userAgentData.platform;
            if (platform && /Android|iOS/i.test(String(platform))) return true;
        } catch (_) {
            /* ignore */
        }
        return false;
    }

    function hasFinePointerAndHover() {
        try {
            if (!window.matchMedia) return false;
            return (
                window.matchMedia('(pointer: fine)').matches &&
                window.matchMedia('(hover: hover)').matches
            );
        } catch (_) {
            return false;
        }
    }

    /**
     * Настоящий ПК/ноутбук: десктопный UA + нет mobile-hints + большой экран или мышь.
     * Не путать с телефоном в режиме «Версия для ПК» (там UA десктопный, но hints/экран — нет).
     */
    function isLikelyRealDesktop(userAgent) {
        var ua = userAgent || '';
        if (!isLikelyDesktopOs(ua)) return false;
        if (hasMobileClientHintsSync()) return false;
        if (hasMobilePlatformHintSync()) return false;
        if (hasMobileApplePlatform()) return false;

        var sides = getScreenSides();
        if (sides.max > PHONE_MAX_LONG_SIDE && sides.min > PHONE_MAX_SHORT_SIDE) return true;
        if (hasFinePointerAndHover() && sides.max > PHONE_MAX_LONG_SIDE) return true;
        return false;
    }

    function hasMobileUserAgent(userAgent) {
        var ua = userAgent || '';
        if (/iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini|Mobile Safari|Silk|Kindle|KFAPWI/i.test(ua)) {
            return true;
        }
        if (/iPad/i.test(ua)) return true;
        if (/Android/i.test(ua)) return true;
        return false;
    }

    function hasMobileApplePlatform() {
        try {
            var p = navigator.platform || '';
            if (/iPhone|iPad|iPod/i.test(p)) return true;
        } catch (_) {
            /* ignore */
        }
        return false;
    }

    function getScreenSides() {
        var sw = (window.screen && window.screen.width) || 0;
        var sh = (window.screen && window.screen.height) || 0;
        return {
            max: Math.max(sw, sh),
            min: Math.min(sw, sh)
        };
    }

    /** Физический экран телефона + тач — срабатывает даже при десктопном UA. */
    function hasPhoneLikeHardware() {
        var sides = getScreenSides();
        if (sides.max <= 0 || sides.min <= 0) return false;
        if (sides.max > PHONE_MAX_LONG_SIDE || sides.min > PHONE_MAX_SHORT_SIDE) return false;

        var touch = 0;
        try {
            touch = navigator.maxTouchPoints || 0;
        } catch (_) {
            /* ignore */
        }

        var coarse = false;
        var noHover = false;
        try {
            if (window.matchMedia) {
                coarse = window.matchMedia('(pointer: coarse)').matches;
                noHover = window.matchMedia('(hover: none)').matches;
            }
        } catch (_) {
            /* ignore */
        }

        if (coarse && noHover && touch >= 1) return true;
        // «Версия для ПК» в Chrome: UA десктопный, но экран телефона и тач остаются
        if (touch >= 1 && sides.max <= PHONE_MAX_LONG_SIDE) return true;

        return false;
    }

    function isReminkoNativeApp(userAgent) {
        var ua = userAgent || navigator.userAgent || '';
        if (/ReMinkoMobile\//i.test(ua)) return true;
        if (/ReMinkoTV\//i.test(ua)) return true;
        try {
            if (window.__reminkoNativeApp === true) return true;
            if (window.__reminkoTvApp === true) return true;
            if (document.documentElement && document.documentElement.getAttribute('data-reminko-app') === '1') {
                return true;
            }
            if (document.documentElement && document.documentElement.getAttribute('data-reminko-tv') === '1') {
                return true;
            }
            var q = window.location && window.location.search ? window.location.search : '';
            if (/[?&]app=native(?:&|$)/i.test(q)) return true;
            if (/[?&]app=tv(?:&|$)/i.test(q)) return true;
        } catch (_) {
            /* ignore */
        }
        return false;
    }

    function shouldBlockMobileBrowsing(userAgent) {
        if (isReminkoNativeApp(userAgent)) return false;
        var ua = userAgent || navigator.userAgent || '';
        if (!ua) return false;
        if (isLikelySearchOrPreviewBot(ua)) return false;
        if (isLikelyRealDesktop(ua)) return false;
        if (hasMobileClientHintsSync()) return true;
        if (hasMobilePlatformHintSync()) return true;
        if (hasMobileUserAgent(ua)) return true;
        if (hasMobileApplePlatform()) return true;
        if (hasPhoneLikeHardware()) return true;
        return false;
    }

    function scheduleAsyncMobileRecheck() {
        try {
            if (!navigator.userAgentData || typeof navigator.userAgentData.getHighEntropyValues !== 'function') {
                return;
            }
            navigator.userAgentData
                .getHighEntropyValues(['mobile', 'platform'])
                .then(function (values) {
                    if (!values) return;
                    if (isLikelyRealDesktop(navigator.userAgent || '')) return;
                    if (values.mobile === true) {
                        maybeMountWallForMobilePreview();
                        return;
                    }
                    var platform = String(values.platform || '');
                    if (/Android|iOS/i.test(platform)) {
                        maybeMountWallForMobilePreview();
                        return;
                    }
                    if (hasPhoneLikeHardware()) maybeMountWallForMobilePreview();
                })
                .catch(function () {
                    /* ignore */
                });
        } catch (_) {
            /* ignore */
        }
    }

    function getSiteRootPrefix() {
        var list = document.querySelectorAll('script[src*="desktop-only-guard"]');
        var el = list[list.length - 1];
        if (el && el.src) {
            return el.src.replace(/\/scripts\/[^/]+$/, '/');
        }
        var path = (window.location && window.location.pathname) || '';
        if (
            path.indexOf('/catalog/') !== -1 ||
            path.indexOf('/anime/') !== -1 ||
            path.indexOf('/manga/') !== -1
        ) {
            return '../';
        }
        return '';
    }

    function isLikelyTvDevice(userAgent) {
        var ua = userAgent || navigator.userAgent || '';
        if (/ReMinkoTV/i.test(ua)) return true;
        if (
            /Android TV|Google TV|GoogleTV|AFT[A-Z0-9]|BRAVIA|SmartTV|Smart TV|Tizen|webOS|AppleTV|CrKey|Chromecast|HbbTV|NetCast|Opera TV|TV Safari|MiTV|Shield Android TV/i.test(
                ua
            )
        ) {
            return true;
        }
        if (/Android/i.test(ua)) {
            var sides = getScreenSides();
            if (sides.max >= 960 && sides.min >= 540 && !hasPhoneLikeHardware()) return true;
        }
        return false;
    }

    function resolvePublicUrl(relativePath) {
        var root = getSiteRootPrefix();
        return root + String(relativePath || '').replace(/^\//, '');
    }

    function markMobilePreviewAllowed() {
        try {
            var root = document.documentElement;
            if (root) {
                root.classList.add(MOBILE_PREVIEW_CLASS);
                root.setAttribute('data-reminko-mobile-preview', '1');
            }
            if (document.body) document.body.classList.add(MOBILE_PREVIEW_CLASS);
            window.__reminkoMobilePreviewAllowed = true;
            var wall = document.getElementById('reminko-desktop-only-wall');
            if (wall) wall.remove();
            if (document.body) document.body.style.overflow = '';
            if (root) root.style.overflow = '';
        } catch (_) {
            /* ignore */
        }
    }

    function isGitHubPagesMobilePreview() {
        try {
            var host = String(window.location.hostname || '').toLowerCase();
            var path = String(window.location.pathname || '');
            return host === 'ai-technology-tg.github.io' && path.indexOf('/23dsf7dsf6sfsdf6sd/') === 0;
        } catch (_) {
            return false;
        }
    }

    function checkMobilePreviewAccess() {
        if (mobilePreviewAccessPromise) return mobilePreviewAccessPromise;
        if (isGitHubPagesMobilePreview()) {
            markMobilePreviewAllowed();
            mobilePreviewAccessPromise = Promise.resolve(true);
            return mobilePreviewAccessPromise;
        }
        mobilePreviewAccessPromise = fetch(MOBILE_PREVIEW_ENDPOINT, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit'
        })
            .then(function (res) {
                if (!res || !res.ok) return false;
                return res.json();
            })
            .then(function (data) {
                if (data && data.allowed === true) {
                    markMobilePreviewAllowed();
                    return true;
                }
                return false;
            })
            .catch(function () {
                return false;
            });
        return mobilePreviewAccessPromise;
    }

    function maybeMountWallForMobilePreview() {
        checkMobilePreviewAccess().then(function (allowed) {
            if (!allowed) mountWall();
        });
    }

    function checkApkAvailable(relativePath) {
        var url = resolvePublicUrl(relativePath);
        return fetch(url, { method: 'HEAD', cache: 'no-store' })
            .then(function (res) {
                return !!(res && res.ok);
            })
            .catch(function () {
                return false;
            });
    }

    function openTelegramAppNews() {
        var url = 'https://telegram.me/re_minko';
        try {
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (_) {
            window.location.href = url;
        }
    }

    function triggerApkDownload(relativePath, filename) {
        var url = resolvePublicUrl(relativePath);
        try {
            var a = document.createElement('a');
            a.href = url;
            a.download = filename || '';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (_) {
            window.location.href = url;
        }
    }

    function mountWall() {
        if (document.getElementById('reminko-desktop-only-wall')) return;

        var root = getSiteRootPrefix();
        var androidImg = root + 'Fons/androids.png';

        var css =
            '#reminko-desktop-only-wall{position:fixed;inset:0;z-index:2147483647;' +
            'display:flex;align-items:center;justify-content:center;padding:1.25rem;' +
            'box-sizing:border-box;background:#0a0a12;color:#e2e8f0;' +
            'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
            'text-align:center;-webkit-text-size-adjust:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;}' +
            '#reminko-desktop-only-wall *{box-sizing:border-box;}' +
            '#reminko-desktop-only-wall .reminko-dow-card{max-width:22rem;width:100%;' +
            'margin:0 auto;padding:1.5rem 1.25rem 1.35rem;border-radius:1rem;' +
            'background:linear-gradient(145deg,rgba(91,33,182,0.35),rgba(15,15,28,0.95));' +
            'border:1px solid rgba(167,139,250,0.35);box-shadow:0 12px 40px rgba(0,0,0,0.5);}' +
            '#reminko-desktop-only-wall .reminko-dow-android{width:min(72vw,180px);height:min(72vw,180px);margin:0 auto 1.15rem;' +
            'display:block;object-fit:contain;border-radius:1rem;}' +
            '#reminko-desktop-only-wall p{margin:0;font-size:1rem;line-height:1.5;color:#e2e8f0;}';

        var st = document.createElement('style');
        st.textContent = css;
        (document.head || document.documentElement).appendChild(st);

        var wall = document.createElement('div');
        wall.id = 'reminko-desktop-only-wall';
        wall.setAttribute('role', 'alertdialog');
        wall.setAttribute('aria-modal', 'true');
        wall.setAttribute('aria-labelledby', 'reminko-dow-title');
        wall.innerHTML =
            '<div class="reminko-dow-card">' +
            '<img class="reminko-dow-android" src="' +
            androidImg +
            '" alt="Re-Minko для Android" width="180" height="180" decoding="async" />' +
            '<p id="reminko-dow-title">Мы все еще работаем над приложением для телефона</p>' +
            '</div>';

        (document.body || document.documentElement).appendChild(wall);
        if (document.body) {
            document.body.style.overflow = 'hidden';
        }

        try {
            var rootEl = document.documentElement;
            if (rootEl) rootEl.style.overflow = 'hidden';
        } catch (_) {
            /* ignore */
        }
    }

    function getPcHintBaseUrl() {
        var list = document.querySelectorAll('script[src*="desktop-only-guard"]');
        var el = list[list.length - 1];
        if (el && el.src) {
            var base = el.src.replace(/\/[^/]+$/, '/');
            return base + '../Fons/mobile-pc-hint/';
        }
        var path = (window.location && window.location.pathname) || '';
        if (
            path.indexOf('/catalog/') !== -1 ||
            path.indexOf('/anime/') !== -1 ||
            path.indexOf('/manga/') !== -1
        ) {
            return '../Fons/mobile-pc-hint/';
        }
        return 'Fons/mobile-pc-hint/';
    }

    function boot() {
        if (shouldBlockMobileBrowsing()) {
            markMobilePreviewAllowed();
            return;
        }
        try {
            if (isGitHubPagesMobilePreview()) markMobilePreviewAllowed();
        } catch (_) {
            /* ignore */
        }
    }

    if (document.body) boot();
    else document.addEventListener('DOMContentLoaded', boot);
})();
