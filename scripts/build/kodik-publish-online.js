#!/usr/bin/env node
/**
 * Обновить каталог Kodik и выложить на сайт с ПК.
 *
 * Режим A — без Git (перетаскивание папки на Netlify):
 *   npm run publish:kodik
 *   → sync:kodik локально → подсказка перетащить папку на Deploys
 *
 * Режим B — Git + Build hook на Netlify:
 *   netlifyBuildHook в config.local.js → только POST на hook (sync на сервере)
 *
 * Режим C — Netlify CLI (без drag-and-drop):
 *   netlify link (один раз) → npm run publish:kodik -- --cli
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SITE_FOLDER_NAME = path.basename(ROOT);

function loadBuildHookUrl() {
    const fromEnv = String(process.env.NETLIFY_BUILD_HOOK_URL || '').trim();
    if (fromEnv) return fromEnv;

    const localPath = path.join(ROOT, 'config.local.js');
    if (!fs.existsSync(localPath)) return '';

    const text = fs.readFileSync(localPath, 'utf8');
    const patterns = [
        /netlifyBuildHook\s*:\s*['"]([^'"]+)['"]/,
        /NETLIFY_BUILD_HOOK_URL\s*=\s*['"]([^'"]+)['"]/,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1] && m[1].trim() && !/ваш|your|xxxx|build_hooks\/\.\.\./i.test(m[1])) {
            return m[1].trim();
        }
    }
    return '';
}

function runSync() {
    console.log('\n📥 Синхронизация Kodik (API → data/kodik-anime-catalog.json)…\n');
    const r = spawnSync('npm', ['run', 'sync:kodik'], {
        cwd: ROOT,
        stdio: 'inherit',
        shell: true,
        env: process.env,
    });
    if (r.status !== 0) {
        console.error('\n❌ sync:kodik завершился с ошибкой.');
        process.exit(r.status || 1);
    }
}

async function triggerNetlifyHook(hookUrl) {
    console.log('\n🚀 Build hook → сборка на Netlify (Kodik sync на сервере)…\n');
    const res = await fetch(hookUrl, { method: 'POST' });
    const body = await res.text().catch(() => '');
    if (!res.ok) {
        throw new Error(`Build hook HTTP ${res.status}${body ? ': ' + body.slice(0, 200) : ''}`);
    }
    console.log('✅ Netlify принял запрос. Deploys → через ~3–6 мин.\n');
}

function runNetlifyCliDeploy() {
    console.log('\n🚀 Netlify CLI: deploy --prod …\n');
    const r = spawnSync('npx', ['netlify', 'deploy', '--prod', '--dir', ROOT], {
        cwd: ROOT,
        stdio: 'inherit',
        shell: true,
        env: process.env,
    });
    if (r.status !== 0) {
        console.error('\n❌ netlify deploy не удался. Сделай netlify link или перетащи папку вручную.\n');
        process.exit(r.status || 1);
    }
    console.log('\n✅ Сайт обновлён через Netlify CLI.\n');
}

function printDragDropInstructions() {
    console.log('\n✅ Каталог обновлён локально.\n');
    console.log('   Дальше — выложить на Netlify (у тебя без Git):\n');
    console.log('   1. Открой https://app.netlify.com → свой сайт → Deploys');
    console.log('   2. Внизу страницы — зона «Need to deploy manually?»');
    console.log('   3. Перетащи ЭТУ папку целиком:\n');
    console.log(`      ${ROOT}\n`);
    console.log(`   (имя папки: ${SITE_FOLDER_NAME} — должны быть index.html, data/, scripts/)\n`);
    console.log('   ⚠️  Build hook работает только если привязан Git (Link repository).');
    console.log('      Без Git — только drag-and-drop или: npm run publish:kodik -- --cli\n');
}

async function main() {
    const args = process.argv.slice(2);
    const useCli = args.includes('--cli');
    const hookOnly = args.includes('--hook-only') || String(process.env.KODIK_PUBLISH_HOOK_ONLY || '').trim() === '1';

    console.log('Re-Minko — обновление каталога онлайн\n');

    const hookUrl = loadBuildHookUrl();

    if (hookOnly && hookUrl) {
        try {
            await triggerNetlifyHook(hookUrl);
        } catch (e) {
            console.error('❌ Build hook:', e.message || e);
            process.exit(1);
        }
        return;
    }

    if (hookOnly && !hookUrl) {
        console.error('❌ --hook-only: нет netlifyBuildHook в config.local.js');
        process.exit(1);
    }

    // Основной сценарий без Git: sync локально
    runSync();

    if (useCli) {
        runNetlifyCliDeploy();
        return;
    }

    if (hookUrl) {
        console.log(
            '\nℹ️  netlifyBuildHook найден, но без Git на Netlify hook часто не срабатывает.\n' +
                '   Сейчас каталог уже обновлён локально — надёжнее перетащить папку.\n' +
                '   Только hook (если Git привязан): npm run publish:kodik -- --hook-only\n'
        );
    }

    printDragDropInstructions();
}

main();
