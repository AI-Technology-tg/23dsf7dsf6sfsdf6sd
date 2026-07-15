const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'anime4k.js', 'dist', 'anime4k.js');
const destDir = path.join(__dirname, '..', 'vendor');
const dest = path.join(destDir, 'anime4k.js');

if (!fs.existsSync(src)) {
  console.warn('[anime4k-test] anime4k.js not installed yet — run npm install');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('[anime4k-test] vendor/anime4k.js updated');
