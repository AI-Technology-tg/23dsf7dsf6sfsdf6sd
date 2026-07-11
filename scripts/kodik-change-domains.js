/**
 * Официальная замена старых доменов плееров Kodik на актуальные (kodikplayer.com).
 * @see https://kodik-add.com/change-domains.min.js — загружается после window.kodikChangeDomains
 *
 * Переопределение: window.APP_CONFIG.kodik.domainReplace в config.local.js (до config.js)
 */
(function () {
    var cfg =
        (typeof window !== 'undefined' &&
            window.APP_CONFIG &&
            window.APP_CONFIG.kodik &&
            window.APP_CONFIG.kodik.domainReplace) ||
        {};

    // Подмена старых доменов (aniqit и т.д.) на kodikplayer.com. Ответы Kodik API обычно уже с
    // kodikplayer.com; внешний change-domains.min.js включается только через loadChangeDomainsScript.
    var defaults = {
        fromDomains: ['kodik.org', 'kodik.biz', 'kodik.cc', 'aniqit.com'],
        toDomain: 'kodikplayer.com',
        onDomReady: true
    };

    window.kodikChangeDomains = {
        fromDomains: cfg.fromDomains || defaults.fromDomains,
        toDomain: cfg.toDomain || defaults.toDomain,
        onDomReady: cfg.onDomReady !== false
    };

    var loadExternal =
        typeof window.APP_CONFIG !== 'undefined' &&
        window.APP_CONFIG.kodik &&
        window.APP_CONFIG.kodik.loadChangeDomainsScript === true;
    if (!loadExternal) return;

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://kodik-add.com/change-domains.min.js';
    (document.head || document.documentElement).appendChild(s);
})();
