/**
 * MKV → MP4 для браузера: видео copy (H.264), аудio → AAC stereo.
 * Usage: node scripts/remux-for-browser.js [minutes]
 * Default: 5 минут в media/sample-1080.mp4
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ffmpeg = require('ffmpeg-static');
const root = path.join(__dirname, '..');
const input = path.join(root, 'media', 'sample.mkv');
const minutes = Number(process.argv[2]) || 5;
const full = process.argv.includes('--full');
const outName = full ? 'sample-1080-full.mp4' : 'sample-1080.mp4';
const output = path.join(root, 'media', outName);

if (!fs.existsSync(input)) {
    console.error('Нет media/sample.mkv');
    process.exit(1);
}

const args = ['-y', '-i', input, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ac', '2'];
if (!full) args.push('-t', String(minutes * 60));
args.push(output);

console.log('[remux]', full ? 'полный фильм' : minutes + ' мин', '→', outName);
console.log('[remux] ffmpeg', args.join(' '));

execFileSync(ffmpeg, args, { stdio: 'inherit' });
console.log('[remux] готово:', output);
