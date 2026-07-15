/**
 * Плеер ≈4K: Anime4K в реальном времени.
 */
(function (global) {
    'use strict';

    function getA4K() {
        return global.Anime4KJS || null;
    }

    function buildPresetMap(A4K) {
        return {
            higher_c: A4K.ANIME4K_HIGHEREND_MODE_C,
            higher_a: A4K.ANIME4K_HIGHEREND_MODE_A,
            higher_b: A4K.ANIME4K_HIGHEREND_MODE_B,
            simple_ul: A4K.ANIME4KJS_SIMPLE_UL_2X,
            simple_l: A4K.ANIME4KJS_SIMPLE_L_2X,
            simple_m: A4K.ANIME4KJS_SIMPLE_M_2X,
            simple_s: A4K.ANIME4KJS_SIMPLE_S_2X
        };
    }

    function formatTime(sec) {
        if (!Number.isFinite(sec) || sec < 0) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function playerShellHtml(title) {
        const safeTitle =
            typeof escapeHtmlText === 'function' ? escapeHtmlText(title || 'Просмотр') : String(title || 'Просмотр');
        return `
        <div class="anime4k-player" id="anime4kPlayerRoot">
            <div class="anime4k-player__stage" id="anime4kStage">
                <div class="anime4k-player__viewport" id="anime4kViewport">
                    <span class="anime4k-player__pane-label anime4k-player__pane-label--live" id="anime4kLiveLabel">1080p</span>
                    <video id="anime4kVideo" class="anime4k-player__video" playsinline preload="metadata" crossorigin="anonymous"></video>
                    <canvas id="anime4kCanvas" class="anime4k-player__canvas anime4k-player__canvas--hidden"></canvas>
                </div>
                <div class="anime4k-player__overlay-msg" id="anime4kOverlayMsg" hidden></div>
            </div>
            <div class="anime4k-player__bar">
                <button type="button" class="anime4k-player__btn" id="anime4kPlayBtn" title="Play/Pause">▶</button>
                <input type="range" class="anime4k-player__seek" id="anime4kSeek" min="0" max="1000" value="0" aria-label="Позиция">
                <span class="anime4k-player__time" id="anime4kTime">0:00 / 0:00</span>
                <input type="range" class="anime4k-player__volume" id="anime4kVolume" min="0" max="100" value="80" aria-label="Громкость">
                <button type="button" class="anime4k-player__btn anime4k-player__btn--ultra" id="anime4kUltraBtn" title="Anime4K (U)">Anime4K</button>
                <select class="anime4k-player__preset" id="anime4kPreset" title="Профиль Anime4K" aria-label="Профиль Anime4K">
                    <option value="higher_c" selected>Higher-end C</option>
                    <option value="higher_a">Higher-end A</option>
                    <option value="higher_b">Higher-end B</option>
                    <option value="simple_ul">Simple UL</option>
                    <option value="simple_l">Simple L</option>
                </select>
                <button type="button" class="anime4k-player__btn" id="anime4kFsBtn" title="Полный экран">⛶</button>
            </div>
            <p class="anime4k-player__hint">${safeTitle} · <strong>U</strong> — Anime4K, <strong>Space</strong> — пауза</p>
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
        const seek = container.querySelector('#anime4kSeek');
        const volume = container.querySelector('#anime4kVolume');
        const timeLabel = container.querySelector('#anime4kTime');
        const ultraBtn = container.querySelector('#anime4kUltraBtn');
        const presetSelect = container.querySelector('#anime4kPreset');
        const fsBtn = container.querySelector('#anime4kFsBtn');
        const overlay = container.querySelector('#anime4kOverlayMsg');

        let upscaler = null;
        let ultraOn = false;

        function showOverlay(text) {
            if (!overlay) return;
            overlay.textContent = text || '';
            overlay.hidden = !text;
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

        function applyViewMode() {
            if (!video || !canvas) return;
            if (ultraOn) {
                canvas.classList.remove('anime4k-player__canvas--hidden');
                video.classList.add('anime4k-player__video--hidden');
                if (liveLabel) liveLabel.textContent = '≈4K · Anime4K';
            } else {
                canvas.classList.add('anime4k-player__canvas--hidden');
                video.classList.remove('anime4k-player__video--hidden');
                if (liveLabel) liveLabel.textContent = '1080p';
            }
        }

        function setUltra(on, silent) {
            ultraOn = !!on;
            if (ultraBtn) {
                ultraBtn.classList.toggle('anime4k-player__btn--ultra-on', ultraOn);
                ultraBtn.textContent = ultraOn ? 'Anime4K ✓' : 'Anime4K';
            }
            destroyUpscaler();
            if (ultraOn && A4K && A4K.VideoUpscaler?.isSupported?.()) {
                const presets = buildPresetMap(A4K);
                const preset = presets[presetSelect?.value] || presets.higher_c;
                upscaler = new A4K.VideoUpscaler(preset);
                upscaler.attachVideo(video, canvas);
                upscaler.start();
            } else if (ultraOn && (!A4K || !A4K.VideoUpscaler?.isSupported?.())) {
                ultraOn = false;
                if (!silent) showOverlay('WebGL недоступен — Anime4K выключен.');
            }
            applyViewMode();
        }

        if (!videoUrl) {
            showOverlay('Видео ещё не загружено. Создатель зальёт MP4 в «≈4K каталог».');
            return { video, setUltra, destroy: destroyUpscaler };
        }

        video.src = videoUrl;
        video.volume = 0.8;

        video.addEventListener('loadedmetadata', () => {
            timeLabel.textContent = `0:00 / ${formatTime(video.duration)}`;
        });
        video.addEventListener('timeupdate', () => {
            if (!video.duration || seek?.matches(':active')) return;
            seek.value = String(Math.round((video.currentTime / video.duration) * 1000));
            timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
        });
        video.addEventListener('play', () => {
            playBtn.textContent = '⏸';
        });
        video.addEventListener('pause', () => {
            playBtn.textContent = '▶';
        });
        video.addEventListener('error', () => {
            showOverlay('Не удалось загрузить видео. Нужен MP4 (H.264 + AAC) в Supabase Storage.');
        });

        playBtn?.addEventListener('click', () => {
            if (video.paused) void video.play();
            else video.pause();
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
            if (ultraOn) setUltra(true, true);
        });
        fsBtn?.addEventListener('click', () => {
            if (!document.fullscreenElement) void stage?.requestFullscreen();
            else void document.exitFullscreen();
        });

        document.addEventListener('keydown', function onKey(e) {
            if (!container.isConnected) {
                document.removeEventListener('keydown', onKey);
                return;
            }
            if (e.target.matches('input, select, textarea')) return;
            if (e.code === 'Space') {
                const rect = stage?.getBoundingClientRect();
                if (rect && rect.top < innerHeight && rect.bottom > 0) {
                    e.preventDefault();
                    playBtn?.click();
                }
            } else if (e.code === 'KeyU') {
                ultraBtn?.click();
            }
        });

        return { video, setUltra, destroy: destroyUpscaler };
    }

    global.mountAnime4kPlayer = mountAnime4kPlayer;
    global.anime4kPlayerShellHtml = playerShellHtml;
})(typeof window !== 'undefined' ? window : globalThis);
