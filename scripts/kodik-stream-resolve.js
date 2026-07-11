/**
 * Прямая ссылка на поток Kodik через Supabase Edge Function resolve-kodik-stream.
 * Без задеплоенной функции «Смотреть вместе» не сможет открыть поток в &lt;video&gt;.
 */
(function (global) {
    async function resolveStream(pageUrl) {
        if (!pageUrl || typeof pageUrl !== 'string') {
            throw new Error('Нет URL страницы плеера');
        }
        const client = global.supabaseClient;
        if (!client || typeof client.functions?.invoke !== 'function') {
            throw new Error('Supabase клиент не готов');
        }
        const name =
            (global.APP_CONFIG &&
                global.APP_CONFIG.kodik &&
                global.APP_CONFIG.kodik.streamResolverFunctionName) ||
            'resolve-kodik-stream';
        const { data, error } = await client.functions.invoke(name, {
            body: { url: pageUrl }
        });
        if (error) {
            const msg = error.message || String(error);
            throw new Error(msg);
        }
        if (!data || !data.ok || !data.streamUrl) {
            throw new Error((data && data.error) || 'Поток не найден в HTML плеера');
        }
        return {
            streamUrl: String(data.streamUrl),
            kind: data.kind === 'mp4' ? 'mp4' : 'hls'
        };
    }

    global.KodikStreamResolve = { resolveStream };
})(typeof window !== 'undefined' ? window : globalThis);
