/**
 * Подготовка WEB-DL MKV (HEVC HDR / x265 / EAC3) → MP4 для ≈4K каталога Re-Minko.
 *
 * Браузер не играет: MKV, HEVC, HDR/Dolby Vision, EAC3 5.1.
 * Выход: H.264 + AAC stereo, faststart MP4.
 *
 * Usage:
 *   node scripts/prepare-web-catalog.js --input "D:\path\film.mkv" --profile preview
 *   node scripts/prepare-web-catalog.js --input "D:\path\film.mkv" --profile 1080p
 *   node scripts/prepare-web-catalog.js --input "D:\path\film.mkv" --profile 2160p
 *
 * Profiles:
 *   preview  — 3 мин, 1080p (быстрая проверка плеера)
 *   1080p    — полный фильм 1080p SDR (~2–4 GB), лучше с Anime4K Ultra
 *   2160p    — полный фильм 2160p SDR (~8–15 GB), долгий encode
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ffmpeg = require('ffmpeg-static');
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'media', 'web-export');

function parseArgs() {
    const a = process.argv.slice(2);
    const opts = { profile: 'preview', input: '', audio: 'rus-stereo' };
    for (let i = 0; i < a.length; i++) {
        if (a[i] === '--input' && a[i + 1]) opts.input = a[++i];
        else if (a[i] === '--profile' && a[i + 1]) opts.profile = a[++i];
        else if (a[i] === '--audio' && a[i + 1]) opts.audio = a[++i];
    }
    return opts;
}

function audioMap(audio) {
    // Reze WEB-DL: 0:3 = rus AAC stereo, 0:1 = rus EAC3 5.1
    if (audio === 'rus-51') return ['-map', '0:a:0'];
    return ['-map', '0:a:2'];
}

function buildFilter(profile) {
    // HDR → SDR tonemap (если zscale есть в сборке ffmpeg-static)
    const tonemap =
        'zscale=transfer=linear:npl=100,format=gbrpf32le,' +
        'tonemap=tonemap=hable:desat=0,' +
        'zscale=transfer=bt709:matrix=bt709:primaries=bt709,format=yuv420p';
    const scale =
        profile === '2160p'
            ? 'scale=3840:-2:flags=lanczos'
            : 'scale=1920:-2:flags=lanczos';
    return `${tonemap},${scale}`;
}

function run() {
    const opts = parseArgs();
    if (!opts.input || !fs.existsSync(opts.input)) {
        console.error('Укажите существующий --input "path\\to\\file.mkv"');
        process.exit(1);
    }

    fs.mkdirSync(outDir, { recursive: true });
    const base = path.basename(opts.input, path.extname(opts.input)).replace(/[^\w\-+.() ]+/g, '_').slice(0, 80);
    const suffix = opts.profile === '2160p' ? '2160p' : '1080p';
    const outName =
        opts.profile === 'preview'
            ? `${base}.preview-1080p.mp4`
            : `chainsaw-man-reze-${suffix}.mp4`;
    const output = path.join(outDir, outName);

    const vf = buildFilter(opts.profile === 'preview' ? '1080p' : opts.profile);

    const args = [
        '-y',
        '-hide_banner',
        '-i',
        opts.input,
        '-map',
        '0:v:0',
        ...audioMap(opts.audio),
        '-vf',
        vf,
        '-c:v',
        'libx264',
        '-preset',
        opts.profile === 'preview' ? 'veryfast' : 'slow',
        '-crf',
        opts.profile === '2160p' ? '20' : '18',
        '-profile:v',
        'high',
        '-level',
        opts.profile === '2160p' ? '5.1' : '4.1',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-ac',
        '2',
        '-movflags',
        '+faststart',
        '-pix_fmt',
        'yuv420p'
    ];

    if (opts.profile === 'preview') {
        args.push('-t', '180');
    }

    args.push(output);

    console.log('[prepare-web] profile:', opts.profile);
    console.log('[prepare-web] input:', opts.input);
    console.log('[prepare-web] output:', output);
    console.log('[prepare-web] ffmpeg', args.join(' '));
    console.log('[prepare-web] Это может занять от минут до многих часов для полного фильма…');

    const t0 = Date.now();
    execFileSync(ffmpeg, args, { stdio: 'inherit' });
    const sec = Math.round((Date.now() - t0) / 1000);
    const mb = (fs.statSync(output).size / (1024 * 1024)).toFixed(1);
    console.log(`[prepare-web] готово за ${sec}s → ${output} (${mb} MB)`);
    console.log('');
    console.log('Дальше:');
    console.log('1. Supabase → Storage → anime-4k-videos → Upload');
    console.log('2. Создатель → ≈4K каталог → MAL 59062 → вставить Public URL → 💾 URL');
}

run();
