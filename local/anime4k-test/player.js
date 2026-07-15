(function () {
    'use strict';

    var A4K = window.Anime4KJS;
    if (!A4K) {
        document.body.innerHTML = '<p style="color:#f87171;padding:2rem">Не загружен vendor/anime4k.js — выполните npm install в этой папке.</p>';
        return;
    }

    var PRESETS = {
        higher_c: A4K.ANIME4K_HIGHEREND_MODE_C,
        higher_a: A4K.ANIME4K_HIGHEREND_MODE_A,
        higher_b: A4K.ANIME4K_HIGHEREND_MODE_B,
        simple_ul: A4K.ANIME4KJS_SIMPLE_UL_2X,
        simple_l: A4K.ANIME4KJS_SIMPLE_L_2X,
        simple_m: A4K.ANIME4KJS_SIMPLE_M_2X,
        simple_s: A4K.ANIME4KJS_SIMPLE_S_2X
    };

    var video = document.getElementById('video');
    var videoRaw = document.getElementById('videoRaw');
    var canvas = document.getElementById('canvas');
    var viewport = document.getElementById('viewport');
    var controls = document.getElementById('controls');
    var stats = document.getElementById('stats');
    var statusMsg = document.getElementById('statusMsg');
    var webglBadge = document.getElementById('webglBadge');
    var toggleUltraBtn = document.getElementById('toggleUltraBtn');
    var compareBtn = document.getElementById('compareBtn');
    var presetSelect = document.getElementById('presetSelect');
    var fileInput = document.getElementById('fileInput');
    var playBtn = document.getElementById('playBtn');
    var seekBar = document.getElementById('seekBar');
    var volumeBar = document.getElementById('volumeBar');
    var timeLabel = document.getElementById('timeLabel');
    var fsBtn = document.getElementById('fsBtn');
    var stage = document.getElementById('stage');
    var paneRaw = document.getElementById('paneRaw');
    var paneUp = document.getElementById('paneUp');

    var upscaler = null;
    var ultraOn = false;
    var compareOn = false;
    var objectUrl = null;
    var fpsFrames = 0;
    var fpsLast = performance.now();
    var fpsRaf = 0;

    function setStatus(text, ok) {
        statusMsg.textContent = text || '';
        statusMsg.classList.toggle('is-ok', !!ok);
        statusMsg.classList.toggle('is-error', !ok && !!text);
    }

    function formatTime(sec) {
        if (!Number.isFinite(sec) || sec < 0) return '0:00';
        var m = Math.floor(sec / 60);
        var s = Math.floor(sec % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    function revokeObjectUrl() {
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
        }
    }

    function destroyUpscaler() {
        if (upscaler) {
            try {
                upscaler.stop();
                upscaler.detachVideo();
            } catch (_) {}
            upscaler = null;
        }
        cancelAnimationFrame(fpsRaf);
        fpsRaf = 0;
    }

    function createUpscaler() {
        destroyUpscaler();
        var preset = PRESETS[presetSelect.value] || PRESETS.higher_c;
        upscaler = new A4K.VideoUpscaler(preset);
        upscaler.attachVideo(video, canvas);
    }

    function updateStats() {
        document.getElementById('statSource').textContent =
            video.videoWidth && video.videoHeight
                ? video.videoWidth + '×' + video.videoHeight
                : '—';
        document.getElementById('statCanvas').textContent =
            canvas.width && canvas.height ? canvas.width + '×' + canvas.height : '—';
        document.getElementById('statUltra').textContent = ultraOn ? 'вкл' : 'выкл';
    }

    function tickFps() {
        fpsFrames += 1;
        var now = performance.now();
        if (now - fpsLast >= 1000) {
            document.getElementById('statFps').textContent = String(fpsFrames);
            fpsFrames = 0;
            fpsLast = now;
            updateStats();
        }
        if (ultraOn) fpsRaf = requestAnimationFrame(tickFps);
    }

    function applyViewMode() {
        viewport.classList.toggle('lab-viewport--compare', compareOn);
        paneRaw.hidden = !compareOn;
        if (compareOn) {
            videoRaw.classList.remove('lab-video--hidden');
            videoRaw.classList.add('lab-video--visible');
            videoRaw.currentTime = video.currentTime;
            if (!video.paused) videoRaw.play().catch(function () {});
        } else {
            videoRaw.pause();
            videoRaw.classList.add('lab-video--hidden');
            videoRaw.classList.remove('lab-video--visible');
        }
        if (ultraOn) {
            canvas.classList.remove('lab-canvas--hidden');
            video.classList.remove('lab-video--visible');
            video.classList.add('lab-video--hidden');
        } else {
            canvas.classList.add('lab-canvas--hidden');
            video.classList.remove('lab-video--hidden');
            video.classList.add('lab-video--visible');
        }
    }

    function setUltra(on) {
        ultraOn = !!on;
        toggleUltraBtn.textContent = ultraOn ? 'Anime4K: вкл' : 'Anime4K: выкл';
        toggleUltraBtn.classList.toggle('lab-btn--accent-on', ultraOn);

        if (ultraOn) {
            createUpscaler();
            upscaler.start();
            fpsFrames = 0;
            fpsLast = performance.now();
            tickFps();
        } else {
            destroyUpscaler();
            document.getElementById('statFps').textContent = '—';
        }
        applyViewMode();
        updateStats();
    }

    function bindVideoEvents() {
        video.addEventListener('loadedmetadata', function () {
            updateStats();
            timeLabel.textContent = formatTime(0) + ' / ' + formatTime(video.duration);
        });
        video.addEventListener('error', function () {
            var code = video.error && video.error.code;
            var src = video.currentSrc || video.src || '';
            setStatus(
                'Браузер не воспроизводит этот файл (MKV/EAC3). Используйте sample-1080.mp4 — npm run remux',
                false
            );
            if (/sample\.mkv/i.test(src)) {
                tryFallbackAfterMkvFail();
            }
        });
        video.addEventListener('timeupdate', function () {
            if (!video.duration) return;
            if (!seekBar.matches(':active')) {
                seekBar.value = String(Math.round((video.currentTime / video.duration) * 1000));
            }
            timeLabel.textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);
            if (compareOn && Math.abs(videoRaw.currentTime - video.currentTime) > 0.15) {
                videoRaw.currentTime = video.currentTime;
            }
        });
        video.addEventListener('play', function () {
            playBtn.textContent = '⏸';
            if (compareOn) videoRaw.play().catch(function () {});
        });
        video.addEventListener('pause', function () {
            playBtn.textContent = '▶';
            if (compareOn) videoRaw.pause();
        });
        video.addEventListener('ended', function () {
            playBtn.textContent = '▶';
            videoRaw.pause();
        });
    }

    function loadVideoSource(src, label) {
        revokeObjectUrl();
        destroyUpscaler();
        ultraOn = false;
        toggleUltraBtn.textContent = 'Anime4K: выкл';
        toggleUltraBtn.classList.remove('lab-btn--accent-on');

        video.src = src;
        videoRaw.src = src;
        video.load();
        videoRaw.load();

        controls.hidden = false;
        stats.hidden = false;
        toggleUltraBtn.disabled = false;
        compareBtn.disabled = false;

        applyViewMode();
        setStatus(label || 'Видео загружено. Нажмите ▶ или включите Anime4K.', true);
    }

    function loadFile(file) {
        if (!file) return;
        var name = (file.name || '').toLowerCase();
        var okType = file.type && file.type.startsWith('video/');
        var okExt = /\.(mp4|webm|mkv|mov|m4v)$/i.test(name);
        if (!okType && !okExt) {
            setStatus('Нужен видеофайл (MP4, MKV, WebM…)', false);
            return;
        }
        objectUrl = URL.createObjectURL(file);
        loadVideoSource(objectUrl, 'Файл: ' + file.name);
    }

    function tryFallbackAfterMkvFail() {
        var fallbacks = ['media/sample-1080.mp4', 'media/sample.mp4', 'media/sample.webm'];
        var i = 0;
        function next() {
            if (i >= fallbacks.length) return;
            var url = fallbacks[i++];
            fetch(url, { method: 'HEAD' })
                .then(function (r) {
                    if (r.ok) loadVideoSource(url, 'Fallback: ' + url);
                    else next();
                })
                .catch(next);
        }
        next();
    }

    function tryDefaultSample() {
        var candidates = ['media/sample-1080.mp4', 'media/sample.mp4', 'media/sample.webm'];
        var i = 0;
        function next() {
            if (i >= candidates.length) return;
            var url = candidates[i++];
            fetch(url, { method: 'HEAD' })
                .then(function (r) {
                    if (r.ok) loadVideoSource(url, 'Загружен ' + url);
                    else next();
                })
                .catch(next);
        }
        next();
    }

    // WebGL check
    if (A4K.VideoUpscaler.isSupported()) {
        webglBadge.textContent = 'WebGL OK';
        webglBadge.classList.add('is-ok');
    } else {
        webglBadge.textContent = 'WebGL недоступен';
        webglBadge.classList.add('is-bad');
        setStatus('WebGL не поддерживается — Anime4K не запустится.', false);
    }

    bindVideoEvents();
    video.volume = 0.8;
    videoRaw.volume = 0;
    videoRaw.muted = true;

    fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        if (f) loadFile(f);
    });

    toggleUltraBtn.addEventListener('click', function () {
        if (!video.src) return;
        setUltra(!ultraOn);
    });

    compareBtn.addEventListener('click', function () {
        compareOn = !compareOn;
        compareBtn.classList.toggle('lab-btn--accent-on', compareOn);
        compareBtn.textContent = compareOn ? 'Сравнение: вкл' : 'Сравнение A/B';
        applyViewMode();
    });

    presetSelect.addEventListener('change', function () {
        if (ultraOn) setUltra(true);
    });

    playBtn.addEventListener('click', function () {
        if (video.paused) void video.play();
        else video.pause();
    });

    seekBar.addEventListener('input', function () {
        if (!video.duration) return;
        video.currentTime = (Number(seekBar.value) / 1000) * video.duration;
        videoRaw.currentTime = video.currentTime;
    });

    volumeBar.addEventListener('input', function () {
        video.volume = Number(volumeBar.value) / 100;
    });

    fsBtn.addEventListener('click', function () {
        if (!document.fullscreenElement) void stage.requestFullscreen();
        else void document.exitFullscreen();
    });

    document.addEventListener('keydown', function (e) {
        if (e.target.matches('input, select, textarea')) return;
        if (e.code === 'Space') {
            e.preventDefault();
            playBtn.click();
        } else if (e.code === 'KeyU') {
            toggleUltraBtn.click();
        } else if (e.code === 'KeyC') {
            compareBtn.click();
        }
    });

    tryDefaultSample();
})();
