/**
 * Скопируйте в config.local.js и заполните своими значениями.
 * config.local.js не должен попадать в Netlify / публичный репозиторий (.gitignore, .netlifyignore).
 * На Netlify: KODIK_API_TOKEN и ALLOHA_API_TOKEN в Environment variables
 * (прокси /.netlify/functions/kodik-proxy и alloha-proxy).
 * В файлы репозитория токен не кладите — иначе сборка Netlify упадёт на secrets scan.
 */
window.APP_CONFIG = {
    // siteOrigin: 'https://re-minko-anime.com',
    // supabase: { url: '...', anonKey: '...' },
    // ИИ-аватар на localhost (без BOT :3334):
    // minkoAvatarGrokUrl: 'https://re-minko-anime.com/.netlify/functions/minko-avatar-grok',
    kodik: {
        /** Токен Kodik API — для поиска плеера и скачивания дампов */
        apiToken: 'ВАШ_KODIK_API_TOKEN',
    },
    // alloha: {
    //     /** Локально: токен Alloha TV. На проде — ALLOHA_API_TOKEN в Netlify. */
    //     apiToken: 'ВАШ_ALLOHA_API_TOKEN',
    // },
    // После Supabase Pro + Global file size limit 5 GB:
    // anime4k: { maxUploadBytes: 5368709120 },
};
