(function () {
    'use strict';

    var STORAGE_REF = 'reminko_giveaway_ref';
    var STORAGE_DEVICE = 'reminko_giveaway_device_v1';
    var TRACKED_KEY = 'reminko_giveaway_tracked';

    function siteOrigin() {
        try {
            return window.location.origin.replace(/\/$/, '');
        } catch (_) {
            return 'https://re-minko-anime.com';
        }
    }

    function trackEndpoint() {
        var origin = siteOrigin();
        if (/localhost|127\.0\.0\.1/.test(origin)) {
            return origin + '/.netlify/functions/giveaway-track';
        }
        return origin + '/.netlify/functions/giveaway-track';
    }

    function getVisitorId() {
        try {
            var key = 'reminko_visitor_id_v1';
            var v = localStorage.getItem(key);
            if (v && v.length >= 8) return v.slice(0, 64);
            v =
                typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            localStorage.setItem(key, v);
            return v.slice(0, 64);
        } catch (_) {
            return 'v-' + Date.now();
        }
    }

    async function sha256Hex(text) {
        if (!window.crypto || !crypto.subtle) {
            return String(text)
                .split('')
                .reduce(function (h, c) {
                    return ((h << 5) - h + c.charCodeAt(0)) | 0;
                }, 0)
                .toString(16)
                .padStart(32, '0');
        }
        var buf = new TextEncoder().encode(text);
        var hash = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(hash))
            .map(function (b) {
                return b.toString(16).padStart(2, '0');
            })
            .join('');
    }

    async function getDeviceHash() {
        try {
            var cached = localStorage.getItem(STORAGE_DEVICE);
            if (cached && cached.length >= 32) return cached;
        } catch (_) {
            /* ignore */
        }

        var parts = [
            getVisitorId(),
            navigator.userAgent || '',
            navigator.language || '',
            String(screen.width || 0) + 'x' + String(screen.height || 0),
            String(new Date().getTimezoneOffset())
        ];
        var hash = await sha256Hex(parts.join('|'));
        try {
            localStorage.setItem(STORAGE_DEVICE, hash);
        } catch (_) {
            /* ignore */
        }
        return hash;
    }

    function saveRefCode(code) {
        if (!code) return;
        try {
            sessionStorage.setItem(STORAGE_REF, code);
            localStorage.setItem(STORAGE_REF, code);
        } catch (_) {
            /* ignore */
        }
    }

    function getSavedRefCode() {
        try {
            return sessionStorage.getItem(STORAGE_REF) || localStorage.getItem(STORAGE_REF) || '';
        } catch (_) {
            return '';
        }
    }

    function captureRefFromUrl() {
        try {
            var params = new URLSearchParams(window.location.search || '');
            var code = (params.get('gref') || params.get('ref') || '').trim().toLowerCase();
            if (!code || !/^[a-z0-9]{8,16}$/.test(code)) return null;
            saveRefCode(code);
            if (window.history && window.history.replaceState) {
                params.delete('gref');
                params.delete('ref');
                var qs = params.toString();
                var next = window.location.pathname + (qs ? '?' + qs : '') + (window.location.hash || '');
                window.history.replaceState(null, '', next);
            }
            return code;
        } catch (_) {
            return null;
        }
    }

    async function trackRefClick(refCode) {
        if (!refCode) return;
        var sessionKey = TRACKED_KEY + ':' + refCode;
        try {
            if (sessionStorage.getItem(sessionKey) === '1') return;
        } catch (_) {
            /* ignore */
        }

        var deviceHash = await getDeviceHash();
        try {
            var res = await fetch(trackEndpoint(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refCode: refCode,
                    deviceHash: deviceHash,
                    visitorId: getVisitorId(),
                    landingPath: (window.location.pathname || '') + (window.location.search || '')
                })
            });
            if (res.ok) {
                try {
                    sessionStorage.setItem(sessionKey, '1');
                } catch (_) {
                    /* ignore */
                }
            }
        } catch (_) {
            /* ignore network */
        }
    }

    async function reminkoGiveawayAttributeRegistration() {
        if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
        var ref = getSavedRefCode();
        if (!ref) return;
        var deviceHash = await getDeviceHash();
        try {
            await supabaseClient.rpc('giveaway_attribute_registration', {
                p_ref_code: ref,
                p_device_hash: deviceHash,
                p_visitor_id: getVisitorId()
            });
        } catch (_) {
            /* ignore */
        }
    }

    window.reminkoGetGiveawayDeviceHash = getDeviceHash;
    window.reminkoGiveawayAttributeRegistration = reminkoGiveawayAttributeRegistration;
    window.reminkoGiveawayGetSavedRef = getSavedRefCode;
    window.reminkoGiveawayBuildShareUrl = function (sharePath) {
        var path = sharePath || '';
        if (path.charAt(0) !== '/') path = '/' + path;
        return siteOrigin() + path;
    };

    (function boot() {
        var code = captureRefFromUrl();
        if (code) {
            void trackRefClick(code);
        }
    })();
})();
