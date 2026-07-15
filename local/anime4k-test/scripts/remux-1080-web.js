/**
 * Быстрый remux 1080p x264 MKV → MP4 для браузера (без перекодирования видео).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ffmpeg = require('ffmpeg-static');
const root = path.join(__dirname, '..');
const input =
    process.argv[2] ||
    'c:\\Users\\Minko\\Downloads\\[NOOBDLxFortunaTV]Chainsaw.Man.Movie.Reze-hen.1080p.WEB-DL.x264.mkv';
const outDir = path.join(root, 'media', 'web-export');
const output = path.join(outDir, 'chainsaw-man-reze-1080p.mp4');

if (!fs.existsSync(input)) {
    console.error('Нет файла:', input);
    process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const args = [
    '-y',
    '-hide_banner',
    '-i',
    input,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ac',
    '2',
    '-movflags',
    '+faststart',
    output
];

console.log('[remux-1080] input:', input);
console.log('[remux-1080] output:', output);
const t0 = Date.now();
execFileSync(ffmpeg, args, { stdio: 'inherit' });
const mb = (fs.statSync(output).size / (1024 * 1024)).toFixed(1);
console.log(`[remux-1080] готово за ${Math.round((Date.now() - t0) / 1000)}s (${mb} MB)`);
