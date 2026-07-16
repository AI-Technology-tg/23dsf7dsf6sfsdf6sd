/**
 * Google tag (gtag.js) — GA4 G-S9CBJW9NLK
 * Подключается из desktop-only-guard.js в <head> на всех страницах сайта.
 */
(function (w, d, s, measureId) {
    if (w.__reminkoGtagBoot) return;
    w.__reminkoGtagBoot = true;

    w.dataLayer = w.dataLayer || [];
    w.gtag =
        w.gtag ||
        function gtag() {
            w.dataLayer.push(arguments);
        };
    w.gtag('js', new Date());
    w.gtag('config', measureId);

    var src = 'https://www.googletagmanager.com/gtag/js?id=' + measureId;
    var scripts = d.getElementsByTagName(s);
    for (var j = 0; j < scripts.length; j++) {
        if (scripts[j].src === src) return;
    }

    var tag = d.createElement(s);
    tag.async = true;
    tag.src = src;
    var first = scripts[0];
    if (first && first.parentNode) first.parentNode.insertBefore(tag, first);
    else (d.head || d.documentElement).appendChild(tag);
})(window, document, 'script', 'G-S9CBJW9NLK');
