/**
 * Плеер ≈4K: Anime4K в реальном времени.
 */
(function (global) {
    'use strict';

    /** Максимальное качество Anime4K (без выбора в UI) */
    const ANIME4K_MAX_FPS = 30;

    function getA4K() {
        return global.Anime4KJS || null;
    }

    function getMaxAnime4kPreset(A4K) {
        if (!A4K) return null;
        return (
            A4K.ANIME4K_HIGHEREND_MODE_C ||
            A4K.ANIME4K_HIGHEREND_MODE_B ||
            A4K.ANIME4K_HIGHEREND_MODE_A ||
            A4K.ANIME4K_HIGHEREND_MODE_C_FAST ||
            A4K.ANIME4KJS_SIMPLE_L_2X ||
            null
        );
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

    function playerShellHtml() {
        return `
        <div class="a4k-player anime4k-player" id="anime4kPlayerRoot">
            <div class="a4k-player__shell" id="anime4kPlayerShell">
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
                <div class="a4k-player__controls" id="anime4kControls">
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
                        <button type="button" class="a4k-player__btn anime4k-player__btn" id="anime4kFsBtn" title="Полный экран" aria-label="Полный экран">${svgIcon('fs')}</button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    function mountAnime4kPlayer(container, options) {
        if (!container) return null;
        const videoUrl = options?.videoUrl || '';

        container.innerHTML = playerShellHtml();

        const A4K = getA4K();
        const shell = container.querySelector('#anime4kPlayerShell');
        const video = container.querySelector('#anime4kVideo');
        const canvas = container.querySelector('#anime4kCanvas');
        const liveLabel = container.querySelector('#anime4kLiveLabel');
        const playBtn = container.querySelector('#anime4kPlayBtn');
        const centerPlay = container.querySelector('#anime4kCenterPlay');
        const seek = container.querySelector('#anime4kSeek');
        const volume = container.querySelector('#anime4kVolume');
        const timeLabel = container.querySelector('#anime4kTime');
        const ultraBtn = container.querySelector('#anime4kUltraBtn');
        const fsBtn = container.querySelector('#anime4kFsBtn');
        const overlay = container.querySelector('#anime4kOverlayMsg');
        const viewport = container.querySelector('#anime4kViewport');
        const controls = container.querySelector('#anime4kControls');

        let upscaler = null;
        let ultraOn = false;
        let sourceHeavy = false;
        let controlsHideTimer = null;

        function isFullscreen() {
            const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
            return !!(fsEl && shell && (fsEl === shell || shell.contains(fsEl)));
        }

        function revealControls() {
            shell?.classList.remove('a4k-player__shell--ui-hidden');
            if (controlsHideTimer) clearTimeout(controlsHideTimer);
            if (!isFullscreen() || video?.paused) return;
            controlsHideTimer = setTimeout(() => {
                if (isFullscreen() && video && !video.paused) {
                    shell?.classList.add('a4k-player__shell--ui-hidden');
                }
            }, 3200);
        }

        function setPlayIcon(playing) {
            const icon = playing ? svgIcon('pause') : svgIcon('play');
            if (playBtn) playBtn.innerHTML = icon;
            if (centerPlay) {
                centerPlay.innerHTML = icon;
                centerPlay.classList.toggle('a4k-player__center-btn--hidden', playing);
            }
            if (playing) revealControls();
            else shell?.classList.remove('a4k-player__shell--ui-hidden');
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
            const preset = getMaxAnime4kPreset(A4K);
            if (!preset) return null;
            return new A4K.VideoUpscaler(preset, ANIME4K_MAX_FPS);
        }

        function setUltra(on, opts) {
            const silent = !!(opts && opts.silent);
            const force = !!(opts && opts.force);

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

        async function toggleFullscreen() {
            if (!shell) return;
            const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
            if (fsEl) {
                if (document.exitFullscreen) await document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                return;
            }
            if (shell.requestFullscreen) await shell.requestFullscreen();
            else if (shell.webkitRequestFullscreen) shell.webkitRequestFullscreen();
        }

        if (!videoUrl) {
            showOverlay('Видео ещё не загружено. Создатель зальёт MP4 в «≈4K каталог».');
            return { video, setUltra, destroy: destroyUpscaler };
        }

        video.src = videoUrl;
        video.volume = 0.8;
        video.classList.add('a4k-player__video--before-start');

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
            video.classList.remove('a4k-player__video--before-start');
            viewport?.classList.add('a4k-player__viewport--ready');
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

        playBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePlay();
        });
        centerPlay?.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePlay();
        });
        viewport?.addEventListener('click', (e) => {
            if (e.target.closest('button, input, .a4k-player__controls')) return;
            togglePlay();
        });

        seek?.addEventListener('input', () => {
            if (!video.duration) return;
            video.currentTime = (Number(seek.value) / 1000) * video.duration;
            revealControls();
        });
        volume?.addEventListener('input', () => {
            video.volume = Number(volume.value) / 100;
        });
        ultraBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            setUltra(!ultraOn);
        });
        fsBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            void toggleFullscreen();
        });

        shell?.addEventListener('mousemove', revealControls);
        shell?.addEventListener('touchstart', revealControls, { passive: true });
        controls?.addEventListener('click', (e) => e.stopPropagation());

        document.addEventListener('fullscreenchange', () => {
            shell?.classList.toggle('a4k-player__shell--fullscreen', isFullscreen());
            if (!isFullscreen()) shell?.classList.remove('a4k-player__shell--ui-hidden');
            else revealControls();
        });
        document.addEventListener('webkitfullscreenchange', () => {
            shell?.classList.toggle('a4k-player__shell--fullscreen', isFullscreen());
            if (!isFullscreen()) shell?.classList.remove('a4k-player__shell--ui-hidden');
            else revealControls();
        });

        document.addEventListener('keydown', function onKey(e) {
            if (!container.isConnected) {
                document.removeEventListener('keydown', onKey);
                setBodyUltra(false);
                return;
            }
            if (e.target.matches('input, select, textarea')) return;
            const inPlayer = shell?.contains(document.activeElement) || isFullscreen();
            const rect = shell?.getBoundingClientRect();
            const visible = rect && rect.top < innerHeight && rect.bottom > 0;
            if (!inPlayer && !visible) return;

            if (e.code === 'Space') {
                e.preventDefault();
                togglePlay();
            } else if (e.code === 'KeyU') {
                setUltra(!ultraOn);
            } else if (e.code === 'KeyF') {
                e.preventDefault();
                void toggleFullscreen();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                video.currentTime = Math.max(0, video.currentTime - 10);
                revealControls();
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
                revealControls();
            }
        });

        const cleanup = () => {
            if (controlsHideTimer) clearTimeout(controlsHideTimer);
            destroyUpscaler();
            setBodyUltra(false);
        };

        return { video, setUltra, destroy: cleanup };
    }

    global.mountAnime4kPlayer = mountAnime4kPlayer;
    global.anime4kPlayerShellHtml = playerShellHtml;
})(typeof window !== 'undefined' ? window : globalThis);
