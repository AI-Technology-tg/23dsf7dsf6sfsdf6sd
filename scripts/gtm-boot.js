/**
 * Google Tag Manager — GTM-W4RSMVH3
 * Подключается из desktop-only-guard.js в <head> на всех страницах сайта.
 */
(function (w, d, s, l, i) {
    if (w.__reminkoGtmBoot) return;
    w.__reminkoGtmBoot = true;

    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

    var tagSrc = 'https://www.googletagmanager.com/gtm.js?id=' + i;
    var scripts = d.getElementsByTagName(s);
    for (var j = 0; j < scripts.length; j++) {
        if (scripts[j].src === tagSrc) return;
    }

    var f = scripts[0];
    var gtm = d.createElement(s);
    var dl = l !== 'dataLayer' ? '&l=' + l : '';
    gtm.async = true;
    gtm.src = tagSrc + dl;
    if (f && f.parentNode) f.parentNode.insertBefore(gtm, f);
    else (d.head || d.documentElement).appendChild(gtm);

    function injectNoScript() {
        if (d.getElementById('reminko-gtm-noscript')) return;
        var ns = d.createElement('noscript');
        ns.id = 'reminko-gtm-noscript';
        ns.innerHTML =
            '<iframe src="https://www.googletagmanager.com/ns.html?id=' +
            i +
            '" height="0" width="0" style="display:none;visibility:hidden"></iframe>';
        if (d.body) d.body.insertBefore(ns, d.body.firstChild);
    }

    if (d.body) injectNoScript();
    else d.addEventListener('DOMContentLoaded', injectNoScript, { once: true });
})(window, document, 'script', 'dataLayer', 'GTM-W4RSMVH3');
