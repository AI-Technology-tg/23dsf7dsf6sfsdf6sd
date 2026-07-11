/**
 * Избранное аниме: Supabase favorites_anime + зеркало в localStorage (userData.favorites).
 */
(function (global) {
    'use strict';

    const _cache = new Set();
    let _loaded = false;
    let _loading = null;

    function parseAnimeId(animeId) {
        const n = parseInt(animeId, 10);
        return Number.isNaN(n) ? null : n;
    }

    function syncLocalFavorites(userId, ids) {
        if (!userId || typeof updateUserData !== 'function') return;
        const numeric = ids
            .map((id) => parseInt(id, 10))
            .filter((n) => !Number.isNaN(n));
        updateUserData(userId, { favorites: numeric });
    }

    function dispatchFavoritesLoaded() {
        try {
            global.dispatchEvent(
                new CustomEvent('reminko:favorites-loaded', { detail: { count: _cache.size } })
            );
        } catch (_) {
            /* ignore */
        }
    }

    async function loadFavorites(force) {
        if (_loaded && !force) return _cache;
        if (_loading && !force) return _loading;

        _loading = (async () => {
            _cache.clear();
            let user = null;
            const authPending =
                typeof global.isAuthenticatedSync === 'function' && global.isAuthenticatedSync();

            if (typeof getCurrentUser === 'function') {
                user = await getCurrentUser();
                if (authPending && (!user || user.isAnonymous)) {
                    for (let i = 0; i < 6 && (!user || user.isAnonymous); i++) {
                        await new Promise((r) => setTimeout(r, 250));
                        user = await getCurrentUser(true);
                    }
                }
            } else if (typeof global.getCurrentUserSync === 'function') {
                user = global.getCurrentUserSync();
            }

            if (user && !user.isAnonymous && typeof supabaseClient !== 'undefined' && supabaseClient) {
                try {
                    const { data, error } = await supabaseClient
                        .from('favorites_anime')
                        .select('anime_id')
                        .eq('user_id', user.id);
                    if (!error && Array.isArray(data)) {
                        for (const row of data) {
                            if (row && row.anime_id != null) _cache.add(String(row.anime_id));
                        }
                        syncLocalFavorites(user.id, [..._cache]);
                        _loaded = true;
                        return _cache;
                    }
                } catch (e) {
                    console.warn('[favorites] Supabase:', e);
                }
            }

            if (user && typeof getUserData === 'function') {
                const ud = getUserData(user.id);
                const favs = (ud && ud.favorites) || [];
                for (const id of favs) _cache.add(String(id));
            }

            const deferLoaded = authPending && (!user || user.isAnonymous) && _cache.size === 0;
            if (!deferLoaded) {
                _loaded = true;
            }
            dispatchFavoritesLoaded();
            return _cache;
        })().finally(() => {
            _loading = null;
        });

        return _loading;
    }

    function isInFavorites(animeId) {
        const id = parseAnimeId(animeId);
        if (id == null) return false;
        return _cache.has(String(id));
    }

    function getFavoriteAnimeIds() {
        return [..._cache];
    }

    async function addToFavorites(animeId) {
        const id = parseAnimeId(animeId);
        if (id == null) return { success: false, message: 'Некорректный id' };

        await loadFavorites();
        const idStr = String(id);
        if (_cache.has(idStr)) return { success: true, already: true, message: 'Уже в избранном' };

        let user = null;
        if (typeof getCurrentUser === 'function') user = await getCurrentUser();
        if (!user || user.isAnonymous) {
            return { success: false, message: 'auth_required' };
        }

        _cache.add(idStr);

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            const { error } = await supabaseClient.from('favorites_anime').insert({
                user_id: user.id,
                anime_id: idStr,
            });
            if (error && error.code !== '23505') {
                _cache.delete(idStr);
                console.warn('[favorites] insert:', error);
                return { success: false, message: error.message };
            }
        }

        syncLocalFavorites(user.id, [..._cache]);

        if (typeof global.reminkoEpisodeNotifySeedFavorite === 'function') {
            try {
                await global.reminkoEpisodeNotifySeedFavorite(id);
            } catch (_) {
                /* ignore */
            }
        }

        return { success: true, message: 'Добавлено в избранное — сообщим о новых сериях 🎬' };
    }

    async function removeFromFavorites(animeId) {
        const id = parseAnimeId(animeId);
        if (id == null) return { success: false, message: 'Некорректный id' };

        await loadFavorites();
        const idStr = String(id);
        if (!_cache.has(idStr)) return { success: true, already: true, message: 'Уже удалено из избранного' };

        let user = null;
        if (typeof getCurrentUser === 'function') user = await getCurrentUser();
        if (!user || user.isAnonymous) {
            return { success: false, message: 'auth_required' };
        }

        _cache.delete(idStr);

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            const { error } = await supabaseClient
                .from('favorites_anime')
                .delete()
                .eq('user_id', user.id)
                .eq('anime_id', idStr);
            if (error) {
                _cache.add(idStr);
                console.warn('[favorites] delete:', error);
                return { success: false, message: error.message };
            }
        }

        syncLocalFavorites(user.id, [..._cache]);
        return { success: true, message: 'Удалено из избранного' };
    }

    global.addToFavorites = addToFavorites;
    global.removeFromFavorites = removeFromFavorites;
    global.isInFavorites = isInFavorites;
    global.loadFavorites = loadFavorites;
    global.getFavoriteAnimeIds = getFavoriteAnimeIds;

    function bindAuthFavoritesReload() {
        if (typeof supabaseClient === 'undefined' || !supabaseClient?.auth?.onAuthStateChange) return;
        supabaseClient.auth.onAuthStateChange((event) => {
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                _loaded = false;
                void loadFavorites(true);
            }
            if (event === 'SIGNED_OUT') {
                _cache.clear();
                _loaded = false;
                dispatchFavoritesLoaded();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            loadFavorites();
            bindAuthFavoritesReload();
        });
    } else {
        loadFavorites();
        bindAuthFavoritesReload();
    }
})(typeof window !== 'undefined' ? window : globalThis);
