(function () {
    'use strict';

    var STORAGE_THEME = 'rem_transform_theme';
    var SKIP_LOADING = 'rem_transform_skip_loading';
    var WARMUP_CLICKS = 5;
    var CLICKS_TO_DARK = 100;
    var CLICKS_TO_WHITE = 250;
    var RAMP_UP = 0.14;
    var RAMP_DOWN = 0.06;

    var LOGO_WHITE = 'Fons/fonG.jpg';
    var LOGO_DARK = 'Fons/logo-dark-rem.png';

    var clickCount = 0;
    var resetTimer = null;
    var isFinishing = false;
    var microLayer = null;

    var percentWrap = null;
    var percentDigits = null;
    var flash = null;
    var veil = null;
    var scanlines = null;
    var hintTheme = null;

    function getTheme() {
        return localStorage.getItem(STORAGE_THEME) === 'dark' ? 'dark' : 'white';
    }

    function getThreshold() {
        return getTheme() === 'white' ? CLICKS_TO_DARK : CLICKS_TO_WHITE;
    }

    function activeClicks() {
        return Math.max(0, clickCount - WARMUP_CLICKS);
    }

    function siteRootFromPage() {
        var p = window.location.pathname || '';
        if (/\/(catalog|manga|anime)\//i.test(p)) return '../';
        return '';
    }

    function logoPath(file) {
        return siteRootFromPage() + file;
    }

    function setThemeClass(theme) {
        document.body.classList.remove('theme-white', 'theme-dark');
        document.body.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-white');
        updateLogo(theme);
        if (hintTheme) hintTheme.textContent = theme === 'dark' ? 'тёмная' : 'белая';
    }

    function updateLogo(theme) {
        var img = document.querySelector('.top-logo-img');
        if (!img) return;
        var src = theme === 'dark' ? logoPath(LOGO_DARK) : logoPath(LOGO_WHITE);
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    }

    function displayPercent(active, threshold, toDark) {
        if (active <= 0) return toDark ? 0 : 100;
        var raw = Math.floor((active / threshold) * 100);
        if (toDark) return Math.min(100, raw);
        return Math.max(0, 100 - raw);
    }

    /** Плавный хаос: нарастание → пик → затухание только на 100 / 0 */
    function chaosIntensity(active, threshold, toDark, pct) {
        if (active <= 0) return 0;
        if (toDark && pct >= 100) return 0;
        if (!toDark && pct <= 0) return 0;

        var progress = Math.min(1, active / threshold);
        var intensity;

        if (toDark) {
            if (progress >= 1) {
                intensity = 0;
            } else if (progress < RAMP_UP) {
                intensity = progress / RAMP_UP;
            } else if (progress > 1 - RAMP_DOWN) {
                intensity = (1 - progress) / RAMP_DOWN;
            } else {
                intensity = 1;
            }
        } else {
            var norm = pct / 100;
            if (norm <= 0) return 0;
            var elapsed = 1 - norm;
            if (elapsed < RAMP_UP) {
                intensity = norm * (elapsed / RAMP_UP);
            } else if (norm < RAMP_DOWN) {
                intensity = norm / RAMP_DOWN;
            } else {
                intensity = norm;
            }
        }

        return Math.max(0, Math.min(1, intensity));
    }

    function setPercentStyle(pct, toDark) {
        var t = Math.max(0, Math.min(1, pct / 100));
        var wrap = percentWrap;
        if (!wrap) return;

        wrap.style.setProperty('--pct', String(pct));
        wrap.style.setProperty('--pct-t', t.toFixed(3));

        if (toDark) {
            wrap.style.setProperty('--pct-r', Math.round(255 * t));
            wrap.style.setProperty('--pct-g', Math.round(255 * (1 - t * 0.82)));
            wrap.style.setProperty('--pct-b', Math.round(255 * (1 - t * 0.67)));
        } else {
            wrap.style.setProperty('--pct-r', Math.round(255 * t));
            wrap.style.setProperty('--pct-g', Math.round(255 * (1 - t * 0.82)));
            wrap.style.setProperty('--pct-b', Math.round(255 * (1 - t * 0.67)));
        }
    }

    function ensureOverlayDom() {
        if (!percentWrap) {
            percentWrap = document.createElement('div');
            percentWrap.className = 'rem-transform-percent';
            percentWrap.id = 'remTransformPercent';
            percentWrap.innerHTML =
                '<div class="rem-transform-percent-aura"></div>' +
                '<div class="rem-transform-percent-ring"></div>' +
                '<div class="rem-transform-percent-glass">' +
                '<span class="rem-transform-percent-digits" id="remTransformPercentDigits">0</span>' +
                '<span class="rem-transform-percent-suffix">%</span>' +
                '</div>';
            document.body.appendChild(percentWrap);
            percentDigits = document.getElementById('remTransformPercentDigits');
        }
        if (!flash) {
            flash = document.createElement('div');
            flash.className = 'rem-transform-flash';
            flash.id = 'remTransformFlash';
            document.body.appendChild(flash);
        }
        if (!veil) {
            veil = document.createElement('div');
            veil.className = 'rem-curse-glitch-veil';
            veil.id = 'remCurseGlitchVeil';
            document.body.appendChild(veil);
        }
        if (!scanlines) {
            scanlines = document.createElement('div');
            scanlines.className = 'rem-transform-scanlines';
            scanlines.id = 'remTransformScanlines';
            document.body.appendChild(scanlines);
        }
        if (!microLayer) {
            microLayer = document.createElement('div');
            microLayer.className = 'rem-micro-layer';
            microLayer.id = 'remMicroLayer';
            document.body.appendChild(microLayer);
        }
    }

    function spawnMicroBurst(intensity) {
        if (!microLayer || intensity < 0.08) return;
        var types = ['red', 'violet', 'white', 'crimson'];
        var el = document.createElement('div');
        el.className = 'rem-micro-burst rem-micro-burst--' + types[Math.floor(Math.random() * types.length)];
        el.style.left = (8 + Math.random() * 84).toFixed(1) + '%';
        el.style.top = (10 + Math.random() * 80).toFixed(1) + '%';
        el.style.setProperty('--burst-scale', (0.6 + intensity * 1.4).toFixed(2));
        el.style.animationDuration = (0.25 + Math.random() * 0.35).toFixed(2) + 's';
        microLayer.appendChild(el);
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 700);
    }

    function applyChaos(intensity) {
        var body = document.body;
        intensity = Math.max(0, Math.min(1, intensity));

        if (intensity > 0.001) {
            body.classList.remove('rem-curse-calm', 'rem-curse-glitch-recover');
            body.classList.add('rem-curse-shake', 'rem-curse-glitch-active');

            if (intensity > 0.55) body.classList.add('rem-curse-shake--heavy');
            else body.classList.remove('rem-curse-shake--heavy');

            if (intensity > 0.35) body.classList.add('rem-chaos-flash');
            else body.classList.remove('rem-chaos-flash');

            body.style.setProperty('--rem-veil-opacity', (0.12 + intensity * 0.72).toFixed(2));
            body.style.setProperty('--rem-hue', (intensity * 22 - 11).toFixed(1) + 'deg');
            body.style.setProperty('--rem-chaos', intensity.toFixed(3));

            if (veil) veil.classList.add('is-on');
            if (scanlines) scanlines.classList.toggle('is-on', intensity > 0.25);

            void body.offsetWidth;
        } else {
            body.classList.remove(
                'rem-curse-shake',
                'rem-curse-shake--heavy',
                'rem-curse-glitch-active',
                'rem-chaos-flash'
            );
            body.classList.add('rem-curse-glitch-recover', 'rem-curse-calm');
            if (veil) veil.classList.remove('is-on');
            if (scanlines) scanlines.classList.remove('is-on');
            body.style.removeProperty('--rem-hue');
            body.style.removeProperty('--rem-chaos');
        }
    }

    function updatePercentUI() {
        var active = activeClicks();
        if (active <= 0) return;

        ensureOverlayDom();
        var theme = getTheme();
        var toDark = theme === 'white';
        var threshold = getThreshold();
        var pct = displayPercent(active, threshold, toDark);
        var intensity = chaosIntensity(active, threshold, toDark, pct);

        percentWrap.classList.add('is-visible');
        percentWrap.setAttribute('aria-hidden', 'false');
        percentDigits.textContent = String(pct);
        setPercentStyle(pct, toDark);

        applyChaos(intensity);
        spawnMicroBurst(intensity);

        if (active >= threshold) {
            if (toDark && pct >= 100) finishTransform('dark');
            if (!toDark && pct <= 0) finishTransform('white');
        }
    }

    function finishTransform(nextTheme) {
        if (isFinishing) return;
        isFinishing = true;
        applyChaos(0);
        document.body.classList.add('rem-curse-calm');
        localStorage.setItem(STORAGE_THEME, nextTheme);
        sessionStorage.setItem(SKIP_LOADING, '1');
        if (flash) flash.classList.add('is-active');
        setTimeout(function () {
            window.location.reload();
        }, 620);
    }

    function scheduleReset() {
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(function () {
            clickCount = 0;
            if (percentWrap) {
                percentWrap.classList.remove('is-visible');
                percentWrap.setAttribute('aria-hidden', 'true');
            }
            applyChaos(0);
            document.body.classList.remove('rem-curse-glitch-recover');
        }, 2800);
    }

    function bindLogoElements() {
        document.querySelectorAll('.top-logo').forEach(function (logo) {
            if (logo.dataset.remTransformBound === '1') return;
            logo.dataset.remTransformBound = '1';
            logo.setAttribute('href', '#');
            logo.setAttribute('role', 'button');
            logo.addEventListener('click', onLogoClick, true);
        });
    }

    function onLogoClick(e) {
        var logo = e.target.closest('.top-logo');
        if (!logo || isFinishing) return;

        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

        clickCount += 1;
        if (resetTimer) clearTimeout(resetTimer);

        if (clickCount <= WARMUP_CLICKS) return;

        updatePercentUI();

        var totalNeeded = WARMUP_CLICKS + getThreshold();
        if (clickCount < totalNeeded) scheduleReset();
    }

    function ensureHint() {
        if (document.getElementById('remTransformHint')) return;
        var hint = document.createElement('aside');
        hint.id = 'remTransformHint';
        hint.className = 'rem-transform-hint';
        hint.innerHTML =
            '<strong>Тест трансформации</strong><br>' +
            'Тема: <span id="remHintTheme">белая</span><br>' +
            '5 кликов — разогрев<br>' +
            'затем 100× → тёмная<br>' +
            'или 250× → белая';
        document.body.appendChild(hint);
        hintTheme = document.getElementById('remHintTheme');
    }

    function init() {
        ensureOverlayDom();
        ensureHint();
        setThemeClass(getTheme());
        bindLogoElements();

        window.addEventListener('reminko:navigation-applied', function () {
            bindLogoElements();
            updateLogo(getTheme());
        });

        var obs = new MutationObserver(function () {
            bindLogoElements();
            updateLogo(getTheme());
        });
        var navSlot = document.querySelector('.top-navbar');
        if (navSlot) obs.observe(navSlot, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
