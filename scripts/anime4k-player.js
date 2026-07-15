/**
 * Плеер ≈4K: Anime4K в реальном времени (оптимизированный).
 */
(function (global) {
    'use strict';

    const ULTRA_CONFIRM =
        'Включить Anime4K?\n\n' +
        'После включения сайт, плеер и ваше устройство могут заметно потерять производительность — возможны лаги и подтормаживания видео.\n\n' +
        'Если уверены в мощности ПК или телефона — включайте. Иначе смотрите без улучшения.';

    function getA4K() {
        return global.Anime4KJS || null;
    }

    function buildPresetMap(A4K) {
        return {
            fast_c: A4K.ANIME4K_HIGHEREND_MODE_C_FAST,
            fast_a: A4K.ANIME4K_HIGHEREND_MODE_A_FAST,
            fast_b: A4K.ANIME4K_HIGHEREND_MODE_B_FAST,
            simple_s: A4K.ANIME4KJS_SIMPLE_S_2X,
            simple_m: A4K.ANIME4KJS_SIMPLE_M_2X,
            simple_l: A4K.ANIME4KJS_SIMPLE_L_2X,
            higher_c: A4K.ANIME4K_HIGHEREND_MODE_C,
            higher_a: A4K.ANIME4K_HIGHEREND_MODE_A,
            higher_b: A4K.ANIME4K_HIGHEREND_MODE_B
        };
    }

    function getUltraFps(selectEl) {
        const n = parseInt(selectEl?.value, 10);
        if (n === 20 || n === 24 || n === 30) return n;
        return 24;
    }

    function isSourceHeavyForUpscale(video) {
        const w = video?.videoWidth || 0;
        const h = video?.videoHeight || 0;
        if (!w || !h) return false;
        if (w >= 2560 || h >= 1440) return true;
        return w * h > 1920 * 1080 * 1.25;
    }

    function formatTime(sec) {
        if (!Number.isFinite(sec) || sec < 0) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function svgIcon(name) {
        const icons = {
            play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
            pause: '<path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" fill="currentColor"/>',
            fs: '<path d="M7 3H3v4h2V5h2V3zm10 0h-4v2h2v2h2V3zM3 17v-4H1v6h6v-2H3zm16 0h-2v2h-2v2h4v-6h-2v4z" fill="currentColor"/>',
            vol:
                '<path d="M11 5L6 9H3v6h3l5 4V5zm5.5 2.5a4.5 4.5 0 010 9" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
        };
        return `<svg class="a4k-player__icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
    }

    function playerShellHtml(title) {
        const safeTitle =
            typeof escapeHtmlText === 'function' ? escapeHtmlText(title || 'Просмотр') : String(title || 'Просмотр');
        return `
        <div class="a4k-player anime4k-player" id="anime4kPlayerRoot">
            <div class="a4k-player__shell">
                <header class="a4k-player__head">
                    <div class="a4k-player__brand">
                        <span class="a4k-player__brand-mark">Re-Minko</span>
                        <span class="a4k-player__brand-sub">≈4K</span>
                    </div>
                    <span class="a4k-player__quality" id="anime4kLiveLabel">Исходное</span>
                </header>
                <div class="a4k-player__stage" id="anime4kStage">
                    <div class="a4k-player__viewport" id="anime4kViewport">
                        <video id="anime4kVideo" class="a4k-player__video anime4k-player__video" playsinline preload="metadata" crossorigin="anonymous"></video>
                        <canvas id="anime4kCanvas" class="a4k-player__canvas anime4k-player__canvas anime4k-player__canvas--hidden"></canvas>
                        <button type="button" class="a4k-player__center-btn" id="anime4kCenterPlay" aria-label="Воспроизвести">
                            ${svgIcon('play')}
                        </button>
                    </div>
                    <div class="a4k-player__overlay-msg" id="anime4kOverlayMsg" hidden></div>
                </div>
                <div class="a4k-player__controls">
                    <input type="range" class="a4k-player__seek anime4k-player__seek" id="anime4kSeek" min="0" max="1000" value="0" aria-label="Позиция">
                    <div class="a4k-player__bar">
                        <button type="button" class="a4k-player__btn anime4k-player__btn" id="anime4kPlayBtn" title="Play/Pause" aria-label="Play/Pause">${svgIcon('play')}</button>
                        <span class="a4k-player__time anime4k-player__time" id="anime4kTime">0:00 / 0:00</span>
                        <div class="a4k-player__spacer"></div>
                        <label class="a4k-player__vol-wrap" title="Громкость">
                            ${svgIcon('vol')}
                            <input type="range" class="a4k-player__volume anime4k-player__volume" id="anime4kVolume" min="0" max="100" value="80" aria-label="Громкость">
                        </label>
                        <button type="button" class="a4k-player__ultra anime4k-player__btn--ultra" id="anime4kUltraBtn" title="Anime4K — улучшение в реальном времени">
                            <span class="a4k-player__ultra-dot"></span>
                            Anime4K
                        </button>
                        <select class="a4k-player__select anime4k-player__preset" id="anime4kPreset" title="Профиль" aria-label="Профиль Anime4K">
                            <option value="fast_c" selected>Баланс (быстрый)</option>
                            <option value="simple_s">Лёгкий</option>
                            <option value="simple_m">Средний</option>
                            <option value="fast_a">Качество A</option>
                            <option value="fast_b">Качество B</option>
                            <option value="higher_c">Макс. (тяжёлый)</option>
                        </select>
                        <select class="a4k-player__select a4k-player__select--fps" id="anime4kFps" title="FPS улучшения" aria-label="FPS Anime4K">
                            <option value="20">20 FPS</option>
                            <option value="24" selected>24 FPS</option>
                            <option value="30">30 FPS</option>
                        </select>
                        <button type="button" class="a4k-player__btn anime4k-player__btn" id="anime4kFsBtn" title="Полный экран" aria-label="Полный экран">${svgIcon('fs')}</button>
                    </div>
                </div>
            </div>
            <p class="a4k-player__hint anime4k-player__hint">${safeTitle} · <strong>U</strong> — Anime4K · <strong>Space</strong> — пауза</p>
        </div>`;
    }

    function mountAnime4kPlayer(container, options) {
        if (!container) return null;
        const title = options?.title || '';
        const videoUrl = options?.videoUrl || '';

        container.innerHTML = playerShellHtml(title);

        const A4K = getA4K();
        const video = container.querySelector('#anime4kVideo');
        const canvas = container.querySelector('#anime4kCanvas');
        const liveLabel = container.querySelector('#anime4kLiveLabel');
        const stage = container.querySelector('#anime4kStage');
        const playBtn = container.querySelector('#anime4kPlayBtn');
        const centerPlay = container.querySelector('#anime4kCenterPlay');
        const seek = container.querySelector('#anime4kSeek');
        const volume = container.querySelector('#anime4kVolume');
        const timeLabel = container.querySelector('#anime4kTime');
        const ultraBtn = container.querySelector('#anime4kUltraBtn');
        const presetSelect = container.querySelector('#anime4kPreset');
        const fpsSelect = container.querySelector('#anime4kFps');
        const fsBtn = container.querySelector('#anime4kFsBtn');
        const overlay = container.querySelector('#anime4kOverlayMsg');
        const viewport = container.querySelector('#anime4kViewport');

        let upscaler = null;
        let ultraOn = false;
        let sourceHeavy = false;

        function setPlayIcon(playing) {
            const icon = playing ? svgIcon('pause') : svgIcon('play');
            if (playBtn) playBtn.innerHTML = icon;
            if (centerPlay) {
                centerPlay.innerHTML = icon;
                centerPlay.classList.toggle('a4k-player__center-btn--hidden', playing);
            }
        }

        function showOverlay(text) {
            if (!overlay) return;
            overlay.textContent = text || '';
            overlay.hidden = !text;
        }

        function setBodyUltra(on) {
            document.body.classList.toggle('reminko-anime4k-ultra', !!on);
        }

        function destroyUpscaler() {
            if (upscaler) {
                try {
                    upscaler.stop();
                    upscaler.detachVideo();
                } catch (_) {}
                upscaler = null;
            }
        }

        function syncUpscalerPlayback() {
            if (!upscaler || !ultraOn) return;
            try {
                if (video.paused) upscaler.stop();
                else upscaler.start();
            } catch (_) {}
        }

        function applyViewMode() {
            if (!video || !canvas) return;
            if (ultraOn) {
                canvas.classList.remove('anime4k-player__canvas--hidden');
                video.classList.add('anime4k-player__video--hidden');
                if (liveLabel) liveLabel.textContent = 'Anime4K';
            } else {
                canvas.classList.add('anime4k-player__canvas--hidden');
                video.classList.remove('anime4k-player__video--hidden');
                if (liveLabel) liveLabel.textContent = sourceHeavy ? 'Высокое качество' : 'Исходное';
            }
        }

        function createUpscaler() {
            if (!A4K?.VideoUpscaler?.isSupported?.()) return null;
            const presets = buildPresetMap(A4K);
            const key = presetSelect?.value || 'fast_c';
            const preset = presets[key] || presets.fast_c || presets.simple_m;
            const fps = getUltraFps(fpsSelect);
            return new A4K.VideoUpscaler(preset, fps);
        }

        function setUltra(on, opts) {
            const silent = !!(opts && opts.silent);
            const force = !!(opts && opts.force);

            if (on && !ultraOn && !silent) {
                if (!window.confirm(ULTRA_CONFIRM)) return;
            }

            if (on && sourceHeavy && !force) {
                showOverlay(
                    'Исходное видео уже высокого разрешения — Anime4K отключён, чтобы не лагало. Смотрите в исходном качестве.'
                );
                on = false;
            }

            ultraOn = !!on;
            if (ultraBtn) {
                ultraBtn.classList.toggle('a4k-player__ultra--on', ultraOn);
                ultraBtn.classList.toggle('anime4k-player__btn--ultra-on', ultraOn);
            }
            setBodyUltra(ultraOn);

            destroyUpscaler();
            if (ultraOn && A4K && A4K.VideoUpscaler?.isSupported?.()) {
                upscaler = createUpscaler();
                if (upscaler) {
                    upscaler.attachVideo(video, canvas);
                    if (!video.paused) upscaler.start();
                }
            } else if (ultraOn && (!A4K || !A4K.VideoUpscaler?.isSupported?.())) {
                ultraOn = false;
                setBodyUltra(false);
                if (!silent) showOverlay('WebGL недоступен — Anime4K выключен.');
            }
            applyViewMode();
            if (ultraOn) showOverlay('');
        }

        if (!videoUrl) {
            showOverlay('Видео ещё не загружено. Создатель зальёт MP4 в «≈4K каталог».');
            return { video, setUltra, destroy: destroyUpscaler };
        }

        video.src = videoUrl;
        video.volume = 0.8;

        video.addEventListener('loadedmetadata', () => {
            sourceHeavy = isSourceHeavyForUpscale(video);
            if (sourceHeavy && liveLabel) liveLabel.textContent = 'Высокое качество';
            timeLabel.textContent = `0:00 / ${formatTime(video.duration)}`;
            if (sourceHeavy) {
                showOverlay(
                    'Видео уже в высоком разрешении — рекомендуем смотреть без Anime4K для плавности.'
                );
                setTimeout(() => {
                    if (!ultraOn) showOverlay('');
                }, 6000);
            }
        });

        video.addEventListener('timeupdate', () => {
            if (!video.duration || seek?.matches(':active')) return;
            seek.value = String(Math.round((video.currentTime / video.duration) * 1000));
            timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
        });

        video.addEventListener('play', () => {
            setPlayIcon(true);
            syncUpscalerPlayback();
        });
        video.addEventListener('pause', () => {
            setPlayIcon(false);
            syncUpscalerPlayback();
        });
        video.addEventListener('ended', () => setPlayIcon(false));

        video.addEventListener('error', () => {
            showOverlay('Не удалось загрузить видео. Нужен MP4 (H.264 + AAC).');
        });

        const togglePlay = () => {
            if (video.paused) void video.play();
            else video.pause();
        };

        playBtn?.addEventListener('click', togglePlay);
        centerPlay?.addEventListener('click', togglePlay);
        viewport?.addEventListener('click', (e) => {
            if (e.target.closest('button, input, select, .a4k-player__bar')) return;
            togglePlay();
        });

        seek?.addEventListener('input', () => {
            if (!video.duration) return;
            video.currentTime = (Number(seek.value) / 1000) * video.duration;
        });
        volume?.addEventListener('input', () => {
            video.volume = Number(volume.value) / 100;
        });
        ultraBtn?.addEventListener('click', () => setUltra(!ultraOn));
        presetSelect?.addEventListener('change', () => {
            if (ultraOn) setUltra(true, { silent: true });
        });
        fpsSelect?.addEventListener('change', () => {
            if (ultraOn) setUltra(true, { silent: true });
        });
        fsBtn?.addEventListener('click', () => {
            if (!document.fullscreenElement) void stage?.requestFullscreen();
            else void document.exitFullscreen();
        });

        document.addEventListener('keydown', function onKey(e) {
            if (!container.isConnected) {
                document.removeEventListener('keydown', onKey);
                setBodyUltra(false);
                return;
            }
            if (e.target.matches('input, select, textarea')) return;
            if (e.code === 'Space') {
                const rect = stage?.getBoundingClientRect();
                if (rect && rect.top < innerHeight && rect.bottom > 0) {
                    e.preventDefault();
                    togglePlay();
                }
            } else if (e.code === 'KeyU') {
                ultraBtn?.click();
            }
        });

        const cleanup = () => {
            destroyUpscaler();
            setBodyUltra(false);
        };

        return { video, setUltra, destroy: cleanup };
    }

    global.mountAnime4kPlayer = mountAnime4kPlayer;
    global.anime4kPlayerShellHtml = playerShellHtml;
})(typeof window !== 'undefined' ? window : globalThis);
