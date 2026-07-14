(function () {
    'use strict';

    /** Старт: 14 июля 2026 · окончание через 14 суток (23:59 UTC+2) */
    var GIVEAWAY_END_ISO = '2026-07-28T21:59:59.000Z';
    var GIVEAWAY_TG_URL = 'https://t.me/re_minko';

    function $(id) {
        return document.getElementById(id);
    }

    function isGiveawayEnded() {
        var end = Date.parse(GIVEAWAY_END_ISO);
        return !Number.isNaN(end) && Date.now() >= end;
    }

    function formatGiveawayEndDate() {
        try {
            return new Date(GIVEAWAY_END_ISO).toLocaleString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Kyiv'
            });
        } catch (_) {
            return '28 июля 2026, 23:59';
        }
    }

    function applyGiveawayEndedUi() {
        var ended = isGiveawayEnded();
        var endedNote = $('giveawayEndedNote');
        var timerBox = document.querySelector('.info-giveaway-timer-box');
        var joinBtn = $('giveawayJoinBtn');
        if (endedNote) endedNote.hidden = !ended;
        if (timerBox) timerBox.hidden = ended;
        if (joinBtn) {
            joinBtn.disabled = ended;
            if (ended) joinBtn.title = 'Розыгрыш завершён';
        }
    }

    function initGiveawayCountdown() {
        var root = $('giveawayCountdownInner');
        if (!root || root.dataset.started === '1') {
            applyGiveawayEndedUi();
            return;
        }
        root.dataset.started = '1';

        var endLabel = $('giveawayEndDate');
        if (endLabel) endLabel.textContent = formatGiveawayEndDate();

        if (isGiveawayEnded()) {
            applyGiveawayEndedUi();
            if (root) {
                root.innerHTML = '<div class="countdown__unknown">Розыгрыш завершён</div>';
            }
            return;
        }

        if (typeof reminkoStartLiveCountdown === 'function') {
            reminkoStartLiveCountdown(root, GIVEAWAY_END_ISO, {
                expiredText: 'Розыгрыш завершён. Итоги — в Telegram.',
                onExpire: function () {
                    applyGiveawayEndedUi();
                }
            });
        } else {
            root.textContent = formatGiveawayEndDate();
        }

        applyGiveawayEndedUi();
    }

    function showMsg(el, text, ok) {
        if (!el) return;
        el.textContent = text || '';
        el.classList.toggle('is-ok', !!ok);
        el.classList.toggle('is-error', !ok && !!text);
    }

    async function isLoggedIn() {
        if (typeof supabaseClient === 'undefined' || !supabaseClient) return false;
        try {
            var res = await supabaseClient.auth.getSession();
            return !!(res.data && res.data.session);
        } catch (_) {
            return false;
        }
    }

    async function loadGiveawayPanel() {
        var joinBlock = $('giveawayJoinBlock');
        var statsBlock = $('giveawayStatsBlock');
        var loginHint = $('giveawayLoginHint');
        if (!joinBlock) return;

        var logged = await isLoggedIn();
        if (loginHint) loginHint.hidden = logged;

        if (!logged) {
            joinBlock.hidden = false;
            if (statsBlock) statsBlock.hidden = true;
            return;
        }

        if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

        try {
            var res = await supabaseClient.rpc('giveaway_my_status');
            var row = Array.isArray(res.data) ? res.data[0] : res.data;
            if (res.error || !row) {
                joinBlock.hidden = false;
                if (statsBlock) statsBlock.hidden = true;
                return;
            }

            if (row.is_participant) {
                joinBlock.hidden = true;
                if (statsBlock) statsBlock.hidden = false;
                var url =
                    typeof window.reminkoGiveawayBuildShareUrl === 'function'
                        ? window.reminkoGiveawayBuildShareUrl(row.share_path)
                        : window.location.origin + (row.share_path || '');
                var linkInput = $('giveawayShareUrl');
                if (linkInput) linkInput.value = url;
                var clicksEl = $('giveawayStatClicks');
                var regsEl = $('giveawayStatRegs');
                if (clicksEl) clicksEl.textContent = String(row.unique_clicks != null ? row.unique_clicks : 0);
                if (regsEl) regsEl.textContent = String(row.registrations != null ? row.registrations : 0);
            } else {
                joinBlock.hidden = false;
                if (statsBlock) statsBlock.hidden = true;
            }
        } catch (_) {
            joinBlock.hidden = false;
            if (statsBlock) statsBlock.hidden = true;
        }
    }

    async function onJoinClick() {
        var btn = $('giveawayJoinBtn');
        var msg = $('giveawayJoinMsg');
        if (isGiveawayEnded()) {
            showMsg(msg, 'Розыгрыш уже завершён. Следите за итогами в Telegram.', false);
            return;
        }
        if (!(await isLoggedIn())) {
            showMsg(msg, 'Войдите или зарегистрируйтесь на сайте, чтобы участвовать.', false);
            if (typeof openLoginModal === 'function') openLoginModal();
            return;
        }

        if (btn) btn.disabled = true;
        showMsg(msg, 'Создаём вашу ссылку…', true);

        try {
            var res = await supabaseClient.rpc('giveaway_join');
            if (res.error) throw res.error;
            var row = Array.isArray(res.data) ? res.data[0] : res.data;
            if (!row || !row.ref_code) throw new Error('Не удалось получить ссылку');
            showMsg(msg, 'Вы участвуете! Скопируйте ссылку ниже.', true);
            await loadGiveawayPanel();
        } catch (e) {
            showMsg(msg, (e && e.message) || 'Ошибка участия. Попробуйте позже.', false);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function onCopyClick() {
        var input = $('giveawayShareUrl');
        var msg = $('giveawayCopyMsg');
        if (!input || !input.value) return;
        input.select();
        input.setSelectionRange(0, input.value.length);
        var done = function (ok) {
            showMsg(msg, ok ? 'Ссылка скопирована!' : 'Скопируйте ссылку вручную.', ok);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard
                .writeText(input.value)
                .then(function () {
                    done(true);
                })
                .catch(function () {
                    done(document.execCommand('copy'));
                });
        } else {
            done(document.execCommand('copy'));
        }
    }

    function bindGiveawayInfo() {
        if (!document.querySelector('[data-tab-panel="giveaway"]')) return;
        if (window.__reminkoGiveawayInfoBound) return;
        window.__reminkoGiveawayInfoBound = true;

        initGiveawayCountdown();

        $('giveawayJoinBtn')?.addEventListener('click', function () {
            void onJoinClick();
        });
        $('giveawayCopyBtn')?.addEventListener('click', onCopyClick);
        $('giveawayOpenLoginBtn')?.addEventListener('click', function () {
            if (typeof openLoginModal === 'function') openLoginModal();
        });

        window.addEventListener('reminko:navigation-applied', function () {
            initGiveawayCountdown();
            void loadGiveawayPanel();
        });
        document.addEventListener('click', function (e) {
            var tab = e.target.closest('.info-tabs [data-tab="giveaway"]');
            if (tab) {
                setTimeout(function () {
                    initGiveawayCountdown();
                    void loadGiveawayPanel();
                }, 0);
            }
        });
    }

    window.reminkoGiveawayEndsAt = GIVEAWAY_END_ISO;
    window.reminkoGiveawayTelegramUrl = GIVEAWAY_TG_URL;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindGiveawayInfo);
    } else {
        bindGiveawayInfo();
    }
})();
