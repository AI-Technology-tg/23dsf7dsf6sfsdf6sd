(function () {
    'use strict';

    let activeTabId = 'features';
    let tabsBound = false;

    function getTabs() {
        return document.querySelectorAll('.info-tabs [role="tab"]');
    }

    function getPanels() {
        return document.querySelectorAll('.info-panel');
    }

    function activate(tabId, { animate = true } = {}) {
        const tabs = getTabs();
        const panels = getPanels();
        if (!tabs.length || !panels.length) return false;

        const exists = Array.from(tabs).some((t) => t.dataset.tab === tabId);
        if (!exists) tabId = tabs[0].dataset.tab || 'features';

        activeTabId = tabId;

        tabs.forEach((tab) => {
            const active = tab.dataset.tab === tabId;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        panels.forEach((panel) => {
            const active = panel.dataset.tabPanel === tabId;
            panel.classList.toggle('is-active', active);
            panel.hidden = !active;
            if (!animate) {
                panel.style.animation = 'none';
                void panel.offsetHeight;
                panel.style.animation = '';
            }
        });

        return true;
    }

    function readHashTab() {
        const hash = (window.location.hash || '').replace(/^#/, '').trim();
        if (!hash) return null;
        const tabs = getTabs();
        return Array.from(tabs).some((t) => t.dataset.tab === hash) ? hash : null;
    }

    function bindTabDelegation() {
        if (tabsBound) return;
        tabsBound = true;

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.info-tabs [role="tab"]');
            if (!btn || !btn.dataset.tab) return;
            e.preventDefault();
            e.stopPropagation();
            const tabId = btn.dataset.tab;
            if (tabId === activeTabId) return;
            activate(tabId);
            try {
                const url = `${window.location.pathname}${window.location.search}#${tabId}`;
                window.history.replaceState(null, '', url);
            } catch (_) {
                /* ignore */
            }
        });
    }

    function initInfoTabsAfterNavigation() {
        if (!document.querySelector('.info-page')) return;

        bindTabDelegation();

        const fromHash = readHashTab();
        if (fromHash) {
            activeTabId = fromHash;
        }

        activate(activeTabId, { animate: false });
    }

    let infoTabsNavigationBound = false;
    function bindInfoTabsNavigation() {
        if (infoTabsNavigationBound) return;
        infoTabsNavigationBound = true;
        window.addEventListener('reminko:navigation-applied', initInfoTabsAfterNavigation);
    }

    bindInfoTabsNavigation();
})();
