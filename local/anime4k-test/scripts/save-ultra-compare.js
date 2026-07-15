/**
 * Генерирует ultra-53m58.jpg через headless Chrome + Anime4K.js
 * Usage: node scripts/save-ultra-compare.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.join(__dirname, '..');
const outDir = path.join(root, '..', '..', 'Fons', 'anime4k-compare', 'chainsaw-reze');
const outFile = path.join(outDir, 'ultra-53m58.jpg');

function serveStatic(port) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let p = req.url.split('?')[0];
            if (p === '/') p = '/capture-compare-auto.html';
            const file = path.join(root, decodeURIComponent(p.replace(/^\//, '')));
            if (!file.startsWith(root) || !fs.existsSync(file)) {
                res.writeHead(404);
                res.end('404');
                return;
            }
            const ext = path.extname(file).toLowerCase();
            const types = {
                '.html': 'text/html',
                '.js': 'application/javascript',
                '.mp4': 'video/mp4',
                '.jpg': 'image/jpeg'
            };
            res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.listen(port, () => resolve(server));
    });
}

async function main() {
    let puppeteer;
    try {
        puppeteer = require('puppeteer');
    } catch {
        console.error('Установите puppeteer в local/anime4k-test или используйте уже готовый ultra jpg');
        process.exit(1);
    }

    fs.mkdirSync(outDir, { recursive: true });
    const port = 9877;
    const server = await serveStatic(port);
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--use-gl=angle', '--use-angle=default']
    });
    try {
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${port}/capture-compare-auto.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.__compareCapture && window.__compareCapture.up, { timeout: 180000 });
        const dataUrl = await page.evaluate(() => window.__compareCapture.up);
        const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(outFile, Buffer.from(b64, 'base64'));
        console.log('[save-ultra] OK', outFile, fs.statSync(outFile).size, 'bytes');
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
