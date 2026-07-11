/**
 * Обёртка для комнаты: тот же Kodik, что на странице anime/view (KodikCatalogResolve).
 */
(function (global) {
    function k() {
        return global.KodikCatalogResolve;
    }

    global.watchTogetherKodik = {
        async resolveKodikEmbed(anime) {
            const K = k();
            if (!K || typeof K.resolveEmbedBase !== 'function') {
                throw new Error('KodikCatalogResolve не загружен');
            }
            return K.resolveEmbedBase(anime);
        },
        iframeUrl(href, isSerial, episode, startSeconds, viewerAutoplay, muteOnAutoplay = true) {
            const K = k();
            if (!K || typeof K.buildIframeUrl !== 'function') {
                throw new Error('KodikCatalogResolve не загружен');
            }
            return K.buildIframeUrl(href, isSerial, episode, startSeconds, !!viewerAutoplay, !!muteOnAutoplay);
        },
        clearCacheForAnime(animeId) {
            global.KodikCatalogResolve?.clearCacheForAnimeId?.(animeId);
        }
    };
})(window);
