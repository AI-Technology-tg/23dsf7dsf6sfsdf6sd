// Переписанная UI-панель Создателя (без вкладки "Контент" и без заглушек).
let currentUsersPage = 1;
const usersPerPage = 25;
let __usersDebounce = null;
let __chatDebounce = null;
let __usersViewMode = 'cards';
let __visitorRealtimeTimer = null;
let __chatAutomodRulesCache = [];

function showErrorSafe(message) {
    if (typeof showError === 'function') {
        showError(message);
    } else {
        console.error('[Creator UI] ERROR:', message);
        alert('Ошибка: ' + message);
    }
}

function adminPanelEscapeHtml(text) {
    if (text == null) return '';
    const d = document.createElement('div');
    d.textContent = String(text);
    return d.innerHTML;
}

function openCreatorActionModal({ title, submitLabel = 'Сохранить', danger = false, fields = [] }) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        const bodyHtml = fields
            .map((f) => {
                const id = `creatorActionField_${f.id}`;
                if (f.type === 'textarea') {
                    return `<div class="setting-item"><label>${adminPanelEscapeHtml(f.label)}</label><textarea class="setting-textarea" id="${id}" placeholder="${adminPanelEscapeHtml(f.placeholder || '')}">${adminPanelEscapeHtml(f.value || '')}</textarea></div>`;
                }
                return `<div class="setting-item"><label>${adminPanelEscapeHtml(f.label)}</label><input class="setting-input" id="${id}" type="${adminPanelEscapeHtml(f.type || 'text')}" value="${adminPanelEscapeHtml(f.value || '')}" placeholder="${adminPanelEscapeHtml(f.placeholder || '')}"></div>`;
            })
            .join('');
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">${adminPanelEscapeHtml(title || 'Действие')}</h2>
                    <button class="modal-close" type="button">×</button>
                </div>
                <div class="modal-body">${bodyHtml}</div>
                <div class="modal-footer">
                    <button class="admin-btn ${danger ? 'admin-btn-danger' : ''}" type="button" data-action="submit">${adminPanelEscapeHtml(submitLabel)}</button>
                    <button class="admin-btn admin-btn-secondary" type="button" data-action="cancel">Отмена</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        const close = (result) => {
            modal.remove();
            resolve(result);
        };
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => close(null));
        modal.querySelector('.modal-close')?.addEventListener('click', () => close(null));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close(null);
        });
        modal.querySelector('[data-action="submit"]')?.addEventListener('click', () => {
            const data = {};
            fields.forEach((f) => {
                const el = modal.querySelector(`#creatorActionField_${f.id}`);
                data[f.id] = el ? String(el.value || '') : '';
            });
            close(data);
        });
    });
}

function applyUsersViewMode(mode) {
    __usersViewMode = mode === 'table' ? 'table' : 'cards';
    const cards = document.getElementById('usersCardsGrid');
    const tableWrap = document.getElementById('usersTableWrap');
    const cardsBtn = document.getElementById('usersViewCardsBtn');
    const tableBtn = document.getElementById('usersViewTableBtn');
    if (cards) cards.style.display = __usersViewMode === 'cards' ? '' : 'none';
    if (tableWrap) tableWrap.style.display = __usersViewMode === 'table' ? '' : 'none';
    cardsBtn?.classList.toggle('active', __usersViewMode === 'cards');
    tableBtn?.classList.toggle('active', __usersViewMode === 'table');
}

function stopVisitorRealtime() {
    if (__visitorRealtimeTimer) {
        clearInterval(__visitorRealtimeTimer);
        __visitorRealtimeTimer = null;
    }
}

function refreshVisitorRealtimeState() {
    stopVisitorRealtime();
    const isDashboardTab = window.creatorAdminPanel?.currentTab === 'dashboard';
    const enabled = !!document.getElementById('visitorAnalyticsRealtimeToggle')?.checked;
    if (isDashboardTab && enabled) {
        __visitorRealtimeTimer = setInterval(() => void loadVisitorAnalyticsPanel(), 15000);
    }
}

function hideAdminPageLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (typeof hideLoading === 'function') hideLoading();
}

function initTabs() {
    document.querySelectorAll('.admin-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach((t) => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.admin-tab-content').forEach((c) => {
        c.classList.toggle('active', c.id === `tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    });

    window.creatorAdminPanel.currentTab = tabName;
    if (tabName !== 'dashboard') stopVisitorRealtime();

    if (tabName === 'dashboard') {
        void loadDashboard();
    } else if (tabName === 'users') {
        void loadUsersAdvanced(1);
    } else if (tabName === 'moderation') {
        void loadChatAutomodPanel();
        void loadChatMessagesMod();
    } else if (tabName === 'notifications') {
        void loadNotificationsManagement();
    } else if (tabName === 'minkoServer') {
        void loadMinkoAiServerPanel();
    } else if (tabName === 'giveaway') {
        void loadGiveawayAdminPanel();
    } else if (tabName === 'anime4k') {
        void loadAnime4kAdminPanel();
    } else if (tabName === 'settings') {
        void loadMaintenanceSettings();
    }
}

function initGiveawaySection() {
    if (window.__reminkoGiveawayAdminBound) return;
    window.__reminkoGiveawayAdminBound = true;
    document.getElementById('giveawayAdminRefreshBtn')?.addEventListener('click', () => void loadGiveawayAdminPanel());
}

function initAnime4kSection() {
    if (window.__reminkoAnime4kAdminBound) return;
    window.__reminkoAnime4kAdminBound = true;
    document.getElementById('anime4kAdminRefreshBtn')?.addEventListener('click', () => void loadAnime4kAdminPanel());
    document.getElementById('anime4kAdminFetchJikanBtn')?.addEventListener('click', () => void anime4kAdminFetchAndUpsert());
    document.getElementById('anime4kAdminUploadBtn')?.addEventListener('click', () => void anime4kAdminUploadVideo());
}

async function loadAnime4kAdminPanel() {
    const tbody = document.getElementById('anime4kAdminTableBody');
    const statusEl = document.getElementById('anime4kAdminStatus');
    if (!tbody || !window.creatorAdminPanel) return;

    if (statusEl) statusEl.textContent = 'Загрузка…';
    tbody.innerHTML = '<tr><td colspan="5">Загрузка…</td></tr>';

    const res = await window.creatorAdminPanel.listCatalog4kAnime();
    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:#f87171;">${adminPanelEscapeHtml(res.message || 'Ошибка')}</td></tr>`;
        if (statusEl) statusEl.textContent = '';
        return;
    }

    const rows = res.rows || [];
    if (statusEl) statusEl.textContent = `Тайтлов: ${rows.length}`;
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5">Пусто — добавьте MAL id через Jikan</td></tr>';
        return;
    }

    tbody.innerHTML = rows
        .map((row) => {
            const j = row.jikan && typeof row.jikan === 'object' ? row.jikan : {};
            const title = row.title_ru || j.title_english || j.title || '—';
            const siteId = 22000000 + Number(row.mal_id);
            const vid = row.video_url || '';
            const vidShort = vid.length > 48 ? vid.slice(0, 45) + '…' : vid || '—';
            return `<tr data-mal="${row.mal_id}">
                <td>${row.mal_id}<br><small style="opacity:.7">id ${siteId}</small></td>
                <td>${adminPanelEscapeHtml(title)}</td>
                <td>
                    <input type="url" class="admin-input anime4k-admin-video-input" data-mal="${row.mal_id}" value="${adminPanelEscapeHtml(vid)}" placeholder="https://…/video.mp4" style="min-width:14rem;">
                    <div style="font-size:0.75rem;opacity:.65;margin-top:0.2rem;" title="${adminPanelEscapeHtml(vid)}">${adminPanelEscapeHtml(vidShort)}</div>
                </td>
                <td>${row.published === false ? 'нет' : 'да'}</td>
                <td style="white-space:nowrap;">
                    <button type="button" class="admin-btn admin-btn-small anime4k-save-video-btn" data-mal="${row.mal_id}">💾 URL</button>
                    <button type="button" class="admin-btn admin-btn-small anime4k-del-btn" data-mal="${row.mal_id}">🗑</button>
                </td>
            </tr>`;
        })
        .join('');

    tbody.querySelectorAll('.anime4k-save-video-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const mal = btn.getAttribute('data-mal');
            const input = tbody.querySelector(`.anime4k-admin-video-input[data-mal="${mal}"]`);
            const url = input ? input.value.trim() : '';
            const upd = await window.creatorAdminPanel.updateCatalog4kVideoUrl(mal, url);
            if (statusEl) statusEl.textContent = upd.message || (upd.success ? 'OK' : 'Ошибка');
            if (upd.success) void loadAnime4kAdminPanel();
        });
    });
    tbody.querySelectorAll('.anime4k-del-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const mal = btn.getAttribute('data-mal');
            if (!confirm(`Удалить MAL ${mal} из ≈4K каталога?`)) return;
            const del = await window.creatorAdminPanel.deleteCatalog4kAnime(mal);
            if (statusEl) statusEl.textContent = del.message || '';
            void loadAnime4kAdminPanel();
        });
    });
}

async function anime4kAdminUploadVideo() {
    const statusEl = document.getElementById('anime4kAdminStatus');
    const fileInput = document.getElementById('anime4kAdminFileInput');
    const malInput = document.getElementById('anime4kAdminMalInput');
    const file = fileInput?.files && fileInput.files[0];
    const mal = parseInt(malInput?.value, 10);
    if (!file) {
        if (statusEl) statusEl.textContent = 'Выберите MP4 файл';
        return;
    }
    if (!mal || Number.isNaN(mal)) {
        if (statusEl) statusEl.textContent = 'Укажите MAL id';
        return;
    }
    if (statusEl) statusEl.textContent = `Загрузка ${(file.size / (1024 * 1024)).toFixed(0)} MB…`;
    const res = await window.creatorAdminPanel.uploadCatalog4kVideo(mal, file);
    if (statusEl) statusEl.textContent = res.message || (res.success ? 'OK' : 'Ошибка');
    if (res.success) {
        if (fileInput) fileInput.value = '';
        void loadAnime4kAdminPanel();
    }
}

async function anime4kAdminFetchAndUpsert() {
    const statusEl = document.getElementById('anime4kAdminStatus');
    const input = document.getElementById('anime4kAdminMalInput');
    const mal = parseInt(input?.value, 10);
    if (!mal || Number.isNaN(mal)) {
        if (statusEl) statusEl.textContent = 'Укажите MAL id';
        return;
    }
    if (statusEl) statusEl.textContent = 'Jikan…';
    try {
        let jikanData = null;
        if (typeof reminkoJikanFetch === 'function') {
            const json = await reminkoJikanFetch(`https://api.jikan.moe/v4/anime/${mal}`);
            jikanData = json?.data || null;
        }
        if (!jikanData) {
            const res = await fetch(`https://api.jikan.moe/v4/anime/${mal}`);
            if (!res.ok) throw new Error('Jikan HTTP ' + res.status);
            jikanData = (await res.json()).data;
        }
        const ups = await window.creatorAdminPanel.upsertCatalog4kAnime(jikanData, {});
        if (statusEl) statusEl.textContent = ups.message || (ups.success ? 'Добавлено' : 'Ошибка');
        if (ups.success) void loadAnime4kAdminPanel();
    } catch (e) {
        if (statusEl) statusEl.textContent = e.message || 'Ошибка Jikan';
    }
}

async function loadGiveawayAdminPanel() {
    const tbody = document.getElementById('giveawayAdminTableBody');
    const preregTbody = document.getElementById('giveawayPreregAdminTableBody');
    const summary = document.getElementById('giveawayAdminSummary');
    const statusEl = document.getElementById('giveawayAdminStatus');
    if (!tbody || !window.creatorAdminPanel) return;

    if (statusEl) statusEl.textContent = 'Загрузка…';
    tbody.innerHTML = '<tr><td colspan="7">Загрузка…</td></tr>';
    if (preregTbody) preregTbody.innerHTML = '<tr><td colspan="6">Загрузка…</td></tr>';

    const [{ rows, error }, preregRes] = await Promise.all([
        window.creatorAdminPanel.getGiveawayCreatorStats(),
        window.creatorAdminPanel.getGiveawayPreregCreatorList()
    ]);

    if (error) {
        if (statusEl) statusEl.textContent = '';
        tbody.innerHTML = `<tr><td colspan="7" style="color:#f87171;">${adminPanelEscapeHtml(error)}</td></tr>`;
        if (summary) summary.innerHTML = '';
    } else {
        const list = rows || [];
        const totalClicks = list.reduce((s, r) => s + (Number(r.unique_clicks) || 0), 0);
        const totalRegs = list.reduce((s, r) => s + (Number(r.registrations) || 0), 0);
        const preregList = preregRes.rows || [];

        if (summary) {
            summary.innerHTML = `
            <div class="admin-giveaway-stat">
                <span class="admin-giveaway-stat-label">Участников</span>
                <strong class="admin-giveaway-stat-value">${list.length}</strong>
            </div>
            <div class="admin-giveaway-stat">
                <span class="admin-giveaway-stat-label">Всего переходов</span>
                <strong class="admin-giveaway-stat-value">${totalClicks}</strong>
            </div>
            <div class="admin-giveaway-stat">
                <span class="admin-giveaway-stat-label">Всего регистраций</span>
                <strong class="admin-giveaway-stat-value">${totalRegs}</strong>
            </div>
            <div class="admin-giveaway-stat">
                <span class="admin-giveaway-stat-label">Предрегистрация</span>
                <strong class="admin-giveaway-stat-value">${preregList.length}</strong>
            </div>
        `;
        }

        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="7">Пока никто не нажал «Участвую».</td></tr>';
        } else {
            const origin = window.location.origin.replace(/\/$/, '');
            tbody.innerHTML = list
                .map((r) => {
                    const joined = r.joined_at
                        ? new Date(r.joined_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
                        : '—';
                    const lastClick = r.last_click_at
                        ? new Date(r.last_click_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
                        : '—';
                    const shareUrl = `${origin}/r/${adminPanelEscapeHtml(r.ref_code || '')}`;
                    return `<tr>
                <td>${adminPanelEscapeHtml(r.username || '—')}</td>
                <td>${adminPanelEscapeHtml(r.email || '—')}</td>
                <td><code>${adminPanelEscapeHtml(r.ref_code || '')}</code><br><a href="${shareUrl}" target="_blank" rel="noopener noreferrer">${adminPanelEscapeHtml(shareUrl)}</a></td>
                <td>${adminPanelEscapeHtml(joined)}</td>
                <td>${Number(r.unique_clicks) || 0}</td>
                <td>${Number(r.registrations) || 0}</td>
                <td>${adminPanelEscapeHtml(lastClick)}</td>
            </tr>`;
                })
                .join('');
        }

        if (statusEl) {
            statusEl.textContent = `Обновлено · ${list.length} участник(ов)`;
        }
    }

    if (preregTbody) {
        if (preregRes.error) {
            preregTbody.innerHTML = `<tr><td colspan="6" style="color:#f87171;">${adminPanelEscapeHtml(preregRes.error)}</td></tr>`;
        } else {
            const preregList = preregRes.rows || [];
            const platformLabel = (p) => {
                if (p === 'tiktok') return 'TikTok';
                if (p === 'instagram') return 'Instagram';
                if (p === 'both') return 'TikTok + Instagram';
                return '—';
            };
            const handleCell = (h) => (h ? `@${adminPanelEscapeHtml(h)}` : '—');

            if (!preregList.length) {
                preregTbody.innerHTML = '<tr><td colspan="6">Пока никто не предзарегистрировался.</td></tr>';
            } else {
                preregTbody.innerHTML = preregList
                    .map((r) => {
                        const when = r.updated_at || r.created_at;
                        const dateStr = when
                            ? new Date(when).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
                            : '—';
                        return `<tr>
                <td>${adminPanelEscapeHtml(r.username || '—')}</td>
                <td>${adminPanelEscapeHtml(r.email || '—')}</td>
                <td>${adminPanelEscapeHtml(platformLabel(r.platform))}</td>
                <td>${handleCell(r.tiktok_handle)}</td>
                <td>${handleCell(r.instagram_handle)}</td>
                <td>${adminPanelEscapeHtml(dateStr)}</td>
            </tr>`;
                    })
                    .join('');
            }
        }
    }
}

function bindDashboardControls() {
    if (window.__reminkoCreatorDashboardBound) return;
    window.__reminkoCreatorDashboardBound = true;

    const period = document.getElementById('visitorAnalyticsPeriod');
    period?.addEventListener('change', () => void loadVisitorAnalyticsPanel());
    document.getElementById('visitorAnalyticsDeviceFilter')?.addEventListener('change', () => void loadVisitorAnalyticsPanel());
    document.getElementById('visitorAnalyticsEventFilter')?.addEventListener('change', () => void loadVisitorAnalyticsPanel());
    document.getElementById('visitorAnalyticsSort')?.addEventListener('change', () => void loadVisitorAnalyticsPanel());
    document.getElementById('visitorAnalyticsRefreshBtn')?.addEventListener('click', () => void loadVisitorAnalyticsPanel());
    document.getElementById('visitorAnalyticsRealtimeToggle')?.addEventListener('change', refreshVisitorRealtimeState);
    document.getElementById('openMinkoAiLogsModalBtn')?.addEventListener('click', () => void openMinkoAiLogsModal());
    document.getElementById('creatorAuditRefreshBtn')?.addEventListener('click', () => void loadCreatorAuditLogsPanel());
    document.getElementById('creatorAuditActionFilter')?.addEventListener('change', () => void loadCreatorAuditLogsPanel());
}

async function loadDashboard() {
    const stats = await window.creatorAdminPanel.getAdvancedStats();
    const statsContainer = document.getElementById('adminStats');
    const quickStats = document.getElementById('quickStats');
    const recentEl = document.getElementById('recentActivity');

    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-card">
                <h3>👥 Пользователи</h3>
                <div class="stat-value">${stats?.users || 0}</div>
                <div class="stat-change positive">+${stats?.newUsersToday || 0} сегодня</div>
            </div>
            <div class="stat-card">
                <h3>💬 Сообщения в чате</h3>
                <div class="stat-value">${stats?.chatMessages || 0}</div>
                <div class="stat-change positive">+${stats?.chatMessagesToday || 0} сегодня</div>
            </div>
            <div class="stat-card">
                <h3>💎 VIP подписки</h3>
                <div class="stat-value">${stats?.vipSubscriptions || 0}</div>
                <div class="stat-change">активные</div>
            </div>
            <div class="stat-card">
                <h3>🚫 Забанены</h3>
                <div class="stat-value">${stats?.bannedUsers || 0}</div>
                <div class="stat-change">пользователей</div>
            </div>
            <div class="stat-card">
                <h3>📊 Активные за 7 дней</h3>
                <div class="stat-value">${stats?.activeUsers || 0}</div>
                <div class="stat-change">уникальные</div>
            </div>
        `;
    }

    if (quickStats) {
        quickStats.innerHTML = `
            <div class="quick-stat-item">
                <div class="quick-stat-label">Новых пользователей за неделю</div>
                <div class="quick-stat-value">${stats?.newUsersWeek || 0}</div>
            </div>
            <div class="quick-stat-item">
                <div class="quick-stat-label">Сообщений в час (среднее)</div>
                <div class="quick-stat-value">${Math.floor((stats?.chatMessagesToday || 0) / 24)}</div>
            </div>
            <div class="quick-stat-item">
                <div class="quick-stat-label">Всего сообщений</div>
                <div class="quick-stat-value">${stats?.chatMessages || 0}</div>
            </div>
        `;
    }

    if (recentEl && window.creatorAdminPanel) {
        const rows = await window.creatorAdminPanel.getRecentDashboardActivity(12);
        if (!rows.length) {
            recentEl.innerHTML =
                '<p class="activity-empty">Пока нет недавних событий. Здесь появятся регистрации, входы и сообщения чата.</p>';
        } else {
            recentEl.innerHTML = rows
                .map((r) => {
                    const dt = r.at
                        ? new Date(r.at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
                        : '—';
                    return `<div class="activity-item activity-item--${r.type}">
                        <div class="activity-item-head">
                            <span class="activity-item-title">${r.title}</span>
                            <time class="activity-item-time" datetime="${r.at || ''}">${dt}</time>
                        </div>
                        ${r.body ? `<div class="activity-item-body">${r.body}</div>` : ''}
                    </div>`;
                })
                .join('');
        }
    }

    await loadVisitorAnalyticsPanel();
    await loadCreatorAuditLogsPanel();
    refreshVisitorRealtimeState();
}

async function loadCreatorAuditLogsPanel() {
    const box = document.getElementById('creatorAuditList');
    if (!box || !window.creatorAdminPanel) return;
    box.innerHTML = '<p class="activity-empty">Загрузка лога аудита…</p>';
    const actionFilter = document.getElementById('creatorAuditActionFilter')?.value || '';
    const { rows, error } = await window.creatorAdminPanel.getCreatorAuditLogs(120, actionFilter);
    if (error) {
        box.innerHTML = `<p class="activity-empty" style="color:#f87171;">${adminPanelEscapeHtml(error)}</p>`;
        return;
    }
    if (!rows.length) {
        box.innerHTML = '<p class="activity-empty">Записей пока нет.</p>';
        return;
    }
    box.innerHTML = rows
        .map((row) => {
            const at = row.created_at
                ? new Date(row.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' })
                : '—';
            const actor = row.actor_name || (row.actor_user_id ? row.actor_user_id.slice(0, 8) + '…' : '—');
            const target = row.target_name || (row.target_user_id ? row.target_user_id.slice(0, 8) + '…' : '—');
            let details = '';
            try {
                details = row.details ? JSON.stringify(row.details) : '';
            } catch (_) {
                details = '';
            }
            return `<div class="activity-item">
                <div class="activity-item-head">
                    <span class="activity-item-title">${adminPanelEscapeHtml(row.action || 'unknown')}</span>
                    <time class="activity-item-time">${adminPanelEscapeHtml(at)}</time>
                </div>
                <div class="activity-item-body">
                    <strong>Кто:</strong> ${adminPanelEscapeHtml(actor)} ·
                    <strong>Цель:</strong> ${adminPanelEscapeHtml(target)}${row.reason ? ` · <strong>Причина:</strong> ${adminPanelEscapeHtml(row.reason)}` : ''}
                </div>
                ${details ? `<div class="activity-item-body" style="margin-top:0.35rem;font-family:ui-monospace,monospace;">${adminPanelEscapeHtml(details.slice(0, 280))}${details.length > 280 ? '…' : ''}</div>` : ''}
            </div>`;
        })
        .join('');
}

async function loadVisitorAnalyticsPanel() {
    const el = document.getElementById('visitorAnalyticsContent');
    if (!el || !window.creatorAdminPanel) return;
    const daysSel = document.getElementById('visitorAnalyticsPeriod');
    const days = daysSel ? parseInt(daysSel.value, 10) || 7 : 7;
    const deviceFilter = document.getElementById('visitorAnalyticsDeviceFilter')?.value || '';
    const eventFilter = document.getElementById('visitorAnalyticsEventFilter')?.value || '';
    const sortMode = document.getElementById('visitorAnalyticsSort')?.value || 'time_desc';
    const liveEnabled = !!document.getElementById('visitorAnalyticsRealtimeToggle')?.checked;

    el.innerHTML = '<p class="admin-inline-hint">Загрузка…</p>';
    const { bundle, recent, error } = await window.creatorAdminPanel.getSiteVisitAnalytics(days);
    if (error) {
        el.innerHTML = `<p class="admin-inline-hint" style="color:#f87171;">${adminPanelEscapeHtml(error)}</p>`;
        return;
    }

    const s = bundle && bundle.summary ? bundle.summary : {};
    const live = bundle && bundle.live ? bundle.live : null;
    const byDay = Array.isArray(bundle && bundle.by_day) ? bundle.by_day : [];
    const recentRows = Array.isArray(recent) ? recent : [];

    function detectDeviceType(row) {
        const ua = String(row?.user_agent || '').toLowerCase();
        const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
        const platform = String(meta.platform || meta.os || '').toLowerCase();
        const has = (s) => ua.includes(s) || platform.includes(s);
        if (has('bot') || has('crawler') || has('spider') || has('yandex')) return 'bot';
        if (has('smart-tv') || has('smarttv') || has('tizen') || has('webos') || has('hbbtv')) return 'tv';
        if (has('ipad') || has('tablet')) return 'tablet';
        if (has('android') && !has('mobile')) return 'tablet';
        if (has('iphone') || has('mobile') || has('windows phone')) return 'mobile';
        return 'desktop';
    }

    function matchesEventFilter(row) {
        if (!eventFilter) return true;
        if (eventFilter === 'pageview') return row.event_kind === 'pageview';
        if (eventFilter === 'action') return row.event_kind === 'action';
        if (eventFilter === 'login') return row.event_kind === 'action' && String(row.event_label || '') === 'login';
        return true;
    }

    let filteredRecent = recentRows
        .map((r) => ({ ...r, _device: detectDeviceType(r) }))
        .filter((r) => (!deviceFilter ? true : r._device === deviceFilter))
        .filter(matchesEventFilter);

    const sortByTimeDesc = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);
    const sortByTimeAsc = (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0);
    const sortByPathAsc = (a, b) => String(a.path || '').localeCompare(String(b.path || ''), 'ru');
    const sortByPathDesc = (a, b) => String(b.path || '').localeCompare(String(a.path || ''), 'ru');
    if (sortMode === 'time_asc') filteredRecent.sort(sortByTimeAsc);
    else if (sortMode === 'path_asc') filteredRecent.sort(sortByPathAsc);
    else if (sortMode === 'path_desc') filteredRecent.sort(sortByPathDesc);
    else filteredRecent.sort(sortByTimeDesc);

    const topPathMap = new Map();
    const deviceCountMap = new Map();
    filteredRecent.forEach((row) => {
        const p = String(row.path || '').trim() || '—';
        topPathMap.set(p, (topPathMap.get(p) || 0) + 1);
        const d = String(row._device || 'desktop');
        deviceCountMap.set(d, (deviceCountMap.get(d) || 0) + 1);
    });
    const topPaths = [...topPathMap.entries()].map(([path, cnt]) => ({ path, cnt }));
    topPaths.sort((a, b) => {
        if (sortMode === 'path_asc') return String(a.path).localeCompare(String(b.path), 'ru');
        if (sortMode === 'path_desc') return String(b.path).localeCompare(String(a.path), 'ru');
        if (sortMode === 'time_asc') return a.cnt - b.cnt;
        return b.cnt - a.cnt;
    });

    let html = '';
    html += `<p class="visitor-analytics-live-status">Обновлено: ${new Date().toLocaleTimeString('ru-RU')} · Live: ${liveEnabled ? 'включен' : 'выключен'}</p>`;
    html += '<div class="visitor-analytics-grid">';
    html += `<div class="visitor-analytics-card"><h4>Уникальные посетители</h4><div class="vac-value">${Number(
        s.unique_visitors || 0
    )}</div></div>`;
    html += `<div class="visitor-analytics-card"><h4>Просмотры страниц</h4><div class="vac-value">${Number(
        s.pageviews || 0
    )}</div></div>`;
    html += `<div class="visitor-analytics-card"><h4>Событий всего</h4><div class="vac-value">${Number(
        s.total_events || 0
    )}</div></div>`;
    html += `<div class="visitor-analytics-card"><h4>Уникальных аккаунтов</h4><div class="vac-value">${Number(
        s.unique_logged_accounts || 0
    )}</div></div>`;
    html += '</div>';

    if (live && Number(live.events || 0) > 0) {
        html += `<div class="visitor-analytics-card" style="margin-bottom:1rem;">
            <h4>Реальное время (последние ${Number(live.window_minutes || 15)} минут)</h4>
            <div class="vac-value" style="font-size:1.1rem;line-height:1.45;">
                Событий: <strong>${Number(live.events || 0)}</strong> ·
                Pageview: <strong>${Number(live.pageviews || 0)}</strong> ·
                Login: <strong>${Number(live.logins || 0)}</strong> ·
                Уникальных гостей: <strong>${Number(live.unique_visitors || 0)}</strong>
            </div>
        </div>`;
    }

    if (filteredRecent.length) {
        const deviceOrder = ['desktop', 'mobile', 'tablet', 'tv', 'bot'];
        const deviceSummary = deviceOrder
            .filter((d) => deviceCountMap.has(d))
            .map((d) => `${d}: ${deviceCountMap.get(d)}`)
            .join(' · ');
        html += `<p class="admin-inline-hint" style="margin:0.25rem 0 1rem;">После фильтров: ${filteredRecent.length} событий${deviceSummary ? ` · ${adminPanelEscapeHtml(deviceSummary)}` : ''}</p>`;
    }

    if (byDay.length) {
        html += '<h3 class="visitor-analytics-subh">По дням (UTC)</h3><div class="visitor-analytics-byday">';
        byDay.forEach((row) => {
            html += `<span><strong>${adminPanelEscapeHtml(String(row.day ?? '—'))}</strong>: ${Number(row.cnt ?? 0)}</span>`;
        });
        html += '</div>';
    }

    if (topPaths.length) {
        html += '<h3 class="visitor-analytics-subh">Популярные страницы (по текущему фильтру)</h3>';
        html +=
            '<div class="visitor-analytics-table-wrap"><table class="visitor-analytics-table"><thead><tr><th>Путь</th><th>Счётчик</th></tr></thead><tbody>';
        topPaths.slice(0, 12).forEach((row) => {
            html += `<tr><td class="vac-mono">${adminPanelEscapeHtml(String(row.path ?? '—'))}</td><td>${Number(
                row.cnt ?? 0
            )}</td></tr>`;
        });
        html += '</tbody></table></div>';
        if (topPaths.length > 12) {
            html += `<p class="admin-inline-hint" style="margin-top:-0.6rem;margin-bottom:0.9rem;">Показано 12 из ${topPaths.length} путей. Используйте фильтры, чтобы сузить список.</p>`;
        }
    }

    html += '<h3 class="visitor-analytics-subh">Лента событий</h3>';
    html +=
        '<div class="visitor-analytics-table-wrap"><table class="visitor-analytics-table"><thead><tr><th>Время</th><th>Устройство</th><th>Тип</th><th>Путь</th><th>Заголовок</th><th>User id</th><th>Гость</th></tr></thead><tbody>';
    if (!filteredRecent.length) {
        html += '<tr><td colspan="7">За выбранный период записей нет.</td></tr>';
    } else {
        filteredRecent.slice(0, 40).forEach((r) => {
            const dt = r.created_at
                ? new Date(r.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' })
                : '—';
            const kind =
                r.event_kind === 'action'
                    ? 'action' + (r.event_label ? ': ' + adminPanelEscapeHtml(String(r.event_label).slice(0, 100)) : '')
                    : adminPanelEscapeHtml(String(r.event_kind || 'pageview'));
            html += `<tr>
                <td>${adminPanelEscapeHtml(dt)}</td>
                <td>${adminPanelEscapeHtml(String(r._device || 'desktop'))}</td>
                <td>${kind}</td>
                <td class="vac-mono">${adminPanelEscapeHtml(String(r.path || '—').slice(0, 120))}</td>
                <td>${adminPanelEscapeHtml(String(r.page_title || '—').slice(0, 60))}</td>
                <td class="vac-mono">${r.user_id ? adminPanelEscapeHtml(String(r.user_id).slice(0, 10)) + '…' : '—'}</td>
                <td class="vac-mono">${r.visitor_id ? adminPanelEscapeHtml(String(r.visitor_id).slice(0, 10)) + '…' : '—'}</td>
            </tr>`;
        });
    }
    html += '</tbody></table></div>';
    if (filteredRecent.length > 40) {
        html += `<p class="admin-inline-hint" style="margin-top:-0.6rem;">Показаны последние 40 событий из ${filteredRecent.length}. Для детализации сузьте фильтр.</p>`;
    }
    el.innerHTML = html;
}

function initUsersSection() {
    if (window.__reminkoUsersUiBound) return;
    window.__reminkoUsersUiBound = true;

    const search = document.getElementById('usersSearchInput');
    const banFilter = document.getElementById('usersBanFilter');
    const cardsBtn = document.getElementById('usersViewCardsBtn');
    const tableBtn = document.getElementById('usersViewTableBtn');
    const triggerReload = () => {
        clearTimeout(__usersDebounce);
        __usersDebounce = setTimeout(() => void loadUsersAdvanced(1), 260);
    };
    search?.addEventListener('input', triggerReload);
    banFilter?.addEventListener('change', triggerReload);
    cardsBtn?.addEventListener('click', () => applyUsersViewMode('cards'));
    tableBtn?.addEventListener('click', () => applyUsersViewMode('table'));
    applyUsersViewMode('cards');
}

async function loadUsersAdvanced(page = 1) {
    currentUsersPage = page;
    const search = document.getElementById('usersSearchInput')?.value || '';
    const banFilter = document.getElementById('usersBanFilter')?.value || '';
    const cards = document.getElementById('usersCardsGrid');
    const tableBody = document.getElementById('usersTableBody');
    if (!cards || !tableBody || !window.creatorAdminPanel) return;

    const filters = {
        search,
        banned: banFilter ? banFilter === 'true' : undefined,
    };

    const result = await window.creatorAdminPanel.getUsersAdvanced(page, usersPerPage, filters);
    if (!result.users.length) {
        cards.innerHTML = '<div class="users-card-empty">Пользователи не найдены</div>';
        tableBody.innerHTML =
            '<tr><td colspan="7" style="text-align:center;padding:2rem;">Пользователи не найдены</td></tr>';
        updateUsersPagination(0, page);
        return;
    }

    cards.innerHTML = result.users
        .map((u) => {
            const statusChip = u.is_banned
                ? '<span class="users-card-chip users-card-chip--bad">Забанен</span>'
                : '<span class="users-card-chip users-card-chip--ok">Активен</span>';
            const vipText = u.vip
                ? `<span style="color:#ffd700;">VIP до ${
                      u.vip.expires_at ? new Date(u.vip.expires_at).toLocaleDateString('ru-RU') : '—'
                  }</span>`
                : 'Нет';
            const usernameCell = `${adminPanelEscapeHtml(u.username || 'Без имени')}${
                u.is_site_creator_account
                    ? ' <span style="color:#e9d5ff;font-size:0.78rem;font-weight:700;">[Создатель]</span>'
                    : ''
            }`;
            return `<article class="users-card">
                <div class="users-card-head">
                    <div>
                        <h4 class="users-card-name">${usernameCell}</h4>
                        <p class="users-card-email">${adminPanelEscapeHtml(u.email || 'Не указан')}</p>
                    </div>
                    ${statusChip}
                </div>
                <div class="users-card-meta">
                    <div><strong>ID:</strong> <span style="font-family:ui-monospace,monospace;">${adminPanelEscapeHtml(
                        String(u.id || '').slice(0, 8)
                    )}…</span></div>
                    <div><strong>VIP:</strong> ${vipText}</div>
                    <div><strong>Чат:</strong> ${Number(u.activity?.chat_messages || 0)}</div>
                    <div><strong>Вход:</strong> ${Number(u.activity?.logins || 0)}</div>
                </div>
                <div class="users-card-actions">
                    ${
                        u.is_banned
                            ? `<button class="users-card-btn" onclick="toggleBan('${u.id}', false)">✅ Разбан</button>`
                            : `<button class="users-card-btn users-card-btn--danger" onclick="toggleBan('${u.id}', true)">🚫 Бан</button>`
                    }
                    <button class="users-card-btn" onclick="muteUserChatAction('${u.id}')">🔇 Мут</button>
                    <button class="users-card-btn" onclick="showEditSubscriptions('${u.id}')">💎 VIP</button>
                    <button class="users-card-btn" onclick="showAiSubscriptionEditor('${u.id}')">🤖 AI</button>
                    <button class="users-card-btn" onclick="showUserActions('${u.id}')">⚙️ Меню</button>
                    <button class="users-card-btn users-card-btn--danger" onclick="confirmFullDeleteUser('${u.id}')">⛔ Удалить</button>
                </div>
            </article>`;
        })
        .join('');
    tableBody.innerHTML = result.users
        .map((u) => {
            const status = u.is_banned
                ? '<span style="color:#ef4444;">Забанен</span>'
                : '<span style="color:#10b981;">Активен</span>';
            const vip = u.vip
                ? `<span style="color:#ffd700;">VIP до ${
                      u.vip.expires_at ? new Date(u.vip.expires_at).toLocaleDateString('ru-RU') : '—'
                  }</span>`
                : 'Нет';
            return `<tr>
                <td style="font-family:monospace;font-size:0.85rem;">${adminPanelEscapeHtml(String(u.id || '').slice(0, 8))}...</td>
                <td>${adminPanelEscapeHtml(u.email || 'Не указан')}</td>
                <td>${adminPanelEscapeHtml(u.username || 'Без имени')}</td>
                <td>${vip}</td>
                <td>${status}</td>
                <td><small>💬 ${u.activity?.chat_messages || 0}</small></td>
                <td><button class="admin-btn" onclick="showUserActions('${u.id}')" style="padding:0.5rem;font-size:0.85rem;">⚙️</button></td>
            </tr>`;
        })
        .join('');
    updateUsersPagination(result.total, page);
}

function updateUsersPagination(total, currentPage) {
    const pagination = document.getElementById('usersPagination');
    if (!pagination) return;
    const totalPages = Math.ceil(total / usersPerPage);
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';
    if (currentPage > 1) {
        html += `<button class="pagination-btn" onclick="loadUsersAdvanced(${currentPage - 1})">← Назад</button>`;
    }
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="loadUsersAdvanced(${i})">${i}</button>`;
    }
    if (currentPage < totalPages) {
        html += `<button class="pagination-btn" onclick="loadUsersAdvanced(${currentPage + 1})">Вперёд →</button>`;
    }
    pagination.innerHTML = html;
}

async function showUserActions(userId) {
    const { data: user } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
    if (!user) return;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Действия с пользователем</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <p><strong>Имя:</strong> ${adminPanelEscapeHtml(user.username || 'Без имени')}</p>
                <p><strong>ID:</strong> <code>${adminPanelEscapeHtml(userId)}</code></p>
                <p><strong>Статус:</strong> ${user.is_banned ? 'Забанен' : 'Активен'}</p>
                <div style="margin-top:1.25rem;display:flex;flex-direction:column;gap:0.55rem;">
                    ${
                        user.is_banned
                            ? `<button class="admin-btn" onclick="toggleBan('${userId}', false)">✅ Разбанить</button>`
                            : `<button class="admin-btn admin-btn-danger" onclick="toggleBan('${userId}', true)">🚫 Забанить</button>`
                    }
                    <button class="admin-btn" onclick="showEditSubscriptions('${userId}')">💎 VIP «Смотреть вместе»</button>
                    <button class="admin-btn" onclick="showAiSubscriptionEditor('${userId}')">🤖 Тариф Minko AI</button>
                    <button class="admin-btn" onclick="showUserActivity('${userId}')">📊 Активность</button>
                    <button class="admin-btn" onclick="sendNotificationToUser('${userId}')">🔔 Уведомление</button>
                    <button class="admin-btn" onclick="muteUserChatAction('${userId}')">🔇 Мут в чате</button>
                    <button class="admin-btn admin-btn-danger" onclick="confirmFullDeleteUser('${userId}')">⛔ Полностью удалить аккаунт</button>
                </div>
            </div>
            <div class="modal-footer">
                <button class="admin-btn admin-btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function confirmFullDeleteUser(userId) {
    const modalData = await openCreatorActionModal({
        title: 'Полное удаление аккаунта',
        submitLabel: 'Удалить навсегда',
        danger: true,
        fields: [
            { id: 'phrase', label: 'Введите УДАЛИТЬ для подтверждения', placeholder: 'УДАЛИТЬ' },
            { id: 'reason', label: 'Причина удаления (аудит)', placeholder: 'Причина...', type: 'textarea' },
        ],
    });
    if (!modalData) return;
    if (String(modalData.phrase || '').trim() !== 'УДАЛИТЬ') {
        showErrorSafe('Подтверждение неверное: нужно ввести УДАЛИТЬ');
        return;
    }
    const result = await window.creatorAdminPanel.deleteUserAccountFully(userId, String(modalData.reason || '').trim());
    if (result.success) {
        if (typeof showSuccess === 'function') showSuccess('Аккаунт удалён полностью');
        document.querySelector('.modal.active')?.remove();
        await loadUsersAdvanced(currentUsersPage);
        await loadCreatorAuditLogsPanel();
    } else {
        showErrorSafe(result.message || 'Ошибка полного удаления аккаунта');
    }
}

async function toggleBan(userId, ban) {
    let reason = '';
    if (ban) {
        const modalData = await openCreatorActionModal({
            title: 'Бан пользователя',
            submitLabel: 'Подтвердить бан',
            danger: true,
            fields: [{ id: 'reason', label: 'Причина бана', placeholder: 'Опишите причину', type: 'textarea' }],
        });
        if (!modalData) return;
        reason = String(modalData.reason || '').trim();
        if (!reason) {
            showErrorSafe('Укажите причину бана');
            return;
        }
    }
    const result = await window.creatorAdminPanel.toggleUserBan(userId, ban, reason || '');
    if (result.success) {
        if (typeof showSuccess === 'function') showSuccess(result.message);
        document.querySelector('.modal.active')?.remove();
        void loadUsersAdvanced(currentUsersPage);
    } else {
        showErrorSafe(result.message || 'Ошибка');
    }
}

async function muteUserChatAction(userId) {
    const modalData = await openCreatorActionModal({
        title: 'Мут пользователя в чате',
        submitLabel: 'Выдать мут',
        fields: [
            { id: 'hours', label: 'Количество часов', placeholder: '24', value: '24', type: 'number' },
            { id: 'reason', label: 'Причина мута', placeholder: 'Нарушение правил', value: 'Нарушение правил', type: 'textarea' },
        ],
    });
    if (!modalData) return;
    const hours = parseInt(String(modalData.hours || '0'), 10);
    const reason = String(modalData.reason || '').trim();
    if (!Number.isFinite(hours) || hours <= 0) {
        showErrorSafe('Количество часов должно быть больше 0');
        return;
    }
    if (!reason) {
        showErrorSafe('Укажите причину мута');
        return;
    }
    const result = await window.creatorAdminPanel.muteUserChat(userId, hours, reason);
    if (result.success) {
        if (typeof showSuccess === 'function') showSuccess(result.message);
        document.querySelector('.modal.active')?.remove();
    } else {
        showErrorSafe(result.message || 'Ошибка');
    }
}

function initModerationSection() {
    if (window.__reminkoModerationBound) return;
    window.__reminkoModerationBound = true;
    const debounced = () => {
        clearTimeout(__chatDebounce);
        __chatDebounce = setTimeout(() => void loadChatMessagesMod(), 260);
    };
    document.getElementById('chatSearchInput')?.addEventListener('input', debounced);
    document.getElementById('chatDateFrom')?.addEventListener('change', debounced);
    document.getElementById('chatDateTo')?.addEventListener('change', debounced);
    document.getElementById('chatAutomodRefreshBtn')?.addEventListener('click', () => void loadChatAutomodPanel());
    document.getElementById('chatAutomodSaveBtn')?.addEventListener('click', () => void saveChatAutomodPanel());
    document.getElementById('chatAutomodRuleSearchInput')?.addEventListener('input', () => applyChatAutomodRulesFilter());
    document.getElementById('chatAutomodResetUserBtn')?.addEventListener('click', () => void resetChatAutomodUserStateAction());
}

async function loadChatAutomodPanel() {
    const listEl = document.getElementById('chatAutomodRulesList');
    const enabledToggle = document.getElementById('chatAutomodEnabledToggle');
    const statusEl = document.getElementById('chatAutomodSaveStatus');
    if (!listEl || !enabledToggle || !window.creatorAdminPanel) return;

    listEl.innerHTML = '<p class="activity-empty">Загрузка правил автомодерации…</p>';
    if (statusEl) statusEl.textContent = '';

    const cfg = await window.creatorAdminPanel.getChatAutomodConfig();
    if (!cfg.ok) {
        listEl.innerHTML = `<p class="activity-empty" style="color:#f87171;">${adminPanelEscapeHtml(cfg.message || 'Ошибка загрузки')}</p>`;
        return;
    }

    __chatAutomodRulesCache = Array.isArray(cfg.rules) ? cfg.rules : [];
    enabledToggle.checked = !!cfg.enabled;

    if (!__chatAutomodRulesCache.length) {
        listEl.innerHTML = '<p class="activity-empty">Правила не найдены.</p>';
        return;
    }

    listEl.innerHTML = __chatAutomodRulesCache
        .map((r) => {
            return `<div class="automod-rule-row" data-rule-id="${Number(r.id)}">
                <div>
                    <div class="automod-rule-key">${adminPanelEscapeHtml(String(r.rule_key || 'rule'))}</div>
                    <div class="automod-rule-note">${adminPanelEscapeHtml(String(r.note || r.pattern || ''))}</div>
                </div>
                <label class="visitor-analytics-period-label" style="font-size:0.78rem;gap:0.35rem;">
                    <input type="checkbox" class="automod-rule-active" ${r.is_active ? 'checked' : ''}>
                    active
                </label>
                <label class="visitor-analytics-period-label" style="font-size:0.78rem;gap:0.35rem;">
                    strike
                    <input class="automod-rule-input automod-rule-strike" type="number" min="1" value="${Number(r.strike_weight || 1)}">
                </label>
                <label class="visitor-analytics-period-label" style="font-size:0.78rem;gap:0.35rem;">
                    mute(мин)
                    <input class="automod-rule-input automod-rule-mute" type="number" min="1" value="${Number(r.mute_minutes || 15)}">
                </label>
            </div>`;
        })
        .join('');
    applyChatAutomodRulesFilter();
    await loadChatAutomodEventsPanel();
}

async function saveChatAutomodPanel() {
    const listEl = document.getElementById('chatAutomodRulesList');
    const enabledToggle = document.getElementById('chatAutomodEnabledToggle');
    const statusEl = document.getElementById('chatAutomodSaveStatus');
    if (!listEl || !enabledToggle || !window.creatorAdminPanel) return;

    const rows = Array.from(listEl.querySelectorAll('.automod-rule-row'));
    const rules = rows.map((row) => ({
        id: Number(row.getAttribute('data-rule-id') || 0),
        is_active: !!row.querySelector('.automod-rule-active')?.checked,
        strike_weight: Number(row.querySelector('.automod-rule-strike')?.value || 1),
        mute_minutes: Number(row.querySelector('.automod-rule-mute')?.value || 15),
    }));

    if (statusEl) statusEl.textContent = 'Сохранение…';
    const res = await window.creatorAdminPanel.saveChatAutomodConfig({
        enabled: !!enabledToggle.checked,
        rules,
    });
    if (res.success) {
        if (typeof showSuccess === 'function') showSuccess(res.message || 'Сохранено');
        if (statusEl) statusEl.textContent = 'Сохранено';
        await loadChatAutomodPanel();
    } else {
        showErrorSafe(res.message || 'Ошибка сохранения автомодерации');
        if (statusEl) statusEl.textContent = 'Ошибка сохранения';
    }
}

function applyChatAutomodRulesFilter() {
    const q = String(document.getElementById('chatAutomodRuleSearchInput')?.value || '')
        .trim()
        .toLowerCase();
    const rows = Array.from(document.querySelectorAll('#chatAutomodRulesList .automod-rule-row'));
    rows.forEach((row) => {
        if (!q) {
            row.style.display = '';
            return;
        }
        const text = String(row.textContent || '').toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

async function resetChatAutomodUserStateAction() {
    const input = document.getElementById('chatAutomodResetUserId');
    const userId = String(input?.value || '').trim();
    if (!userId) {
        showErrorSafe('Введите UUID пользователя для сброса');
        return;
    }
    const modalData = await openCreatorActionModal({
        title: 'Сброс автомодерации пользователя',
        submitLabel: 'Сбросить',
        danger: true,
        fields: [
            { id: 'reason', label: 'Причина сброса (аудит)', placeholder: 'Необязательно', type: 'textarea' },
        ],
    });
    if (!modalData) return;
    const res = await window.creatorAdminPanel.resetChatAutomodUserState(userId, String(modalData.reason || '').trim());
    if (res.success) {
        if (typeof showSuccess === 'function') showSuccess(res.message || 'Сброшено');
        await loadChatAutomodPanel();
    } else {
        showErrorSafe(res.message || 'Ошибка сброса');
    }
}

async function loadChatAutomodEventsPanel() {
    const box = document.getElementById('chatAutomodEventsList');
    if (!box || !window.creatorAdminPanel) return;
    box.innerHTML = '<p class="activity-empty">Загрузка событий автомодерации…</p>';
    const r = await window.creatorAdminPanel.getChatAutomodRecentEvents(40);
    if (!r.ok) {
        box.innerHTML = `<p class="activity-empty" style="color:#f87171;">${adminPanelEscapeHtml(r.message || 'Ошибка загрузки')}</p>`;
        return;
    }
    if (!r.rows.length) {
        box.innerHTML = '<p class="activity-empty">Срабатываний пока нет.</p>';
        return;
    }
    box.innerHTML = r.rows
        .map((row) => {
            const dt = row.created_at
                ? new Date(row.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' })
                : '—';
            const who = row.username ? `${adminPanelEscapeHtml(row.username)} (${adminPanelEscapeHtml(String(row.user_id || '').slice(0, 8))}…)` : adminPanelEscapeHtml(String(row.user_id || '—'));
            const rule = row.rule_key ? ` · rule: ${adminPanelEscapeHtml(row.rule_key)}` : '';
            const preview = row.message_preview ? `<div class="activity-item-body" style="margin-top:0.25rem;">${adminPanelEscapeHtml(String(row.message_preview))}</div>` : '';
            return `<div class="activity-item">
                <div class="activity-item-head">
                    <span class="activity-item-title">${adminPanelEscapeHtml(String(row.action || 'event'))}${rule}</span>
                    <time class="activity-item-time">${dt}</time>
                </div>
                <div class="activity-item-body">Пользователь: ${who}</div>
                ${preview}
            </div>`;
        })
        .join('');
}

async function loadChatMessagesMod() {
    const container = document.getElementById('chatMessagesMod');
    if (!container || !window.creatorAdminPanel) return;
    container.innerHTML = '<div style="text-align:center;padding:2rem;">Загрузка…</div>';

    const search = document.getElementById('chatSearchInput')?.value || '';
    const dateFrom = document.getElementById('chatDateFrom')?.value || '';
    const dateTo = document.getElementById('chatDateTo')?.value || '';

    const messages = await window.creatorAdminPanel.getChatMessages({
        search,
        fromDate: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        toDate: dateTo ? new Date(dateTo).toISOString() : undefined,
        limit: 100,
    });

    if (!messages.length) {
        container.innerHTML =
            '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">Сообщения не найдены</div>';
        return;
    }

    container.innerHTML = messages
        .map((msg) => {
            return `<div class="message-item">
                <div class="message-item-header">
                    <div>
                        <div class="message-item-user">${adminPanelEscapeHtml(msg.user?.username || 'Неизвестный')}</div>
                        <div class="message-item-time">${new Date(msg.created_at).toLocaleString('ru-RU')}</div>
                    </div>
                </div>
                <div style="color:var(--text-color);margin:0.5rem 0;">${adminPanelEscapeHtml(msg.message || '')}</div>
                <div class="message-item-actions">
                    <button class="admin-btn admin-btn-danger" style="padding:0.5rem;font-size:0.85rem;" onclick="deleteChatMessage('${msg.id}')">🗑️ Удалить</button>
                    <button class="admin-btn" style="padding:0.5rem;font-size:0.85rem;" onclick="muteUserChatAction('${msg.user_id}')">🔇 Мут</button>
                </div>
            </div>`;
        })
        .join('');
}

async function deleteChatMessage(messageId) {
    const result = await window.creatorAdminPanel.deleteChatMessage(messageId, '');
    if (result.success) {
        if (typeof showSuccess === 'function') showSuccess(result.message);
        void loadChatMessagesMod();
    } else {
        showErrorSafe(result.message || 'Ошибка удаления');
    }
}

function initNotificationsSection() {
    // Здесь пока достаточно загрузить блок-подсказку и модалки отправки.
}

function showSendNotificationModal(type) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">🔔 Отправить уведомление</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                ${
                    type === 'single'
                        ? `<div class="setting-item"><label>ID пользователя:</label><input type="text" class="setting-input" id="notifUserId" placeholder="UUID пользователя"></div>`
                        : type === 'bulk'
                          ? `<div class="setting-item"><label>ID пользователей (через запятую):</label><textarea class="setting-textarea" id="notifUserIds" placeholder="uuid1, uuid2"></textarea></div>`
                          : ''
                }
                <div class="setting-item">
                    <label>Тип уведомления:</label>
                    <select class="setting-select" id="notifType">
                        <option value="system">Система</option>
                        <option value="admin_message">Сообщение от админа</option>
                        <option value="new_episode">Новая серия</option>
                        <option value="chat_reply">Ответ в чате</option>
                    </select>
                </div>
                <div class="setting-item"><label>Заголовок:</label><input type="text" class="setting-input" id="notifTitle"></div>
                <div class="setting-item"><label>Сообщение:</label><textarea class="setting-textarea" id="notifMessage"></textarea></div>
                <div class="setting-item"><label>Ссылка (необязательно):</label><input type="text" class="setting-input" id="notifLink" placeholder="/page.html"></div>
            </div>
            <div class="modal-footer">
                <button class="admin-btn" onclick="sendNotification('${type}')">Отправить</button>
                <button class="admin-btn admin-btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function sendNotification(type) {
    const title = document.getElementById('notifTitle')?.value || '';
    const message = document.getElementById('notifMessage')?.value || '';
    const notifType = document.getElementById('notifType')?.value || 'system';
    const link = document.getElementById('notifLink')?.value || null;
    if (!title.trim() || !message.trim()) {
        showErrorSafe('Заполните заголовок и сообщение');
        return;
    }

    let result = null;
    if (type === 'single') {
        const userId = document.getElementById('notifUserId')?.value || '';
        if (!userId.trim()) return showErrorSafe('Введите ID пользователя');
        result = await window.creatorAdminPanel.sendNotificationToUser(userId.trim(), title, message, notifType, link);
    } else if (type === 'bulk') {
        const userIdsText = document.getElementById('notifUserIds')?.value || '';
        const userIds = userIdsText.split(',').map((id) => id.trim()).filter(Boolean);
        if (!userIds.length) return showErrorSafe('Введите ID пользователей');
        result = await window.creatorAdminPanel.sendBulkNotifications(userIds, title, message, notifType, link);
    } else if (type === 'all') {
        const { data: profiles } = await supabaseClient.from('profiles').select('id');
        const userIds = (profiles || []).map((p) => p.id);
        result = await window.creatorAdminPanel.sendBulkNotifications(userIds, title, message, notifType, link);
    }

    if (result && result.success) {
        if (typeof showSuccess === 'function') showSuccess(result.message);
        document.querySelector('.modal.active')?.remove();
    } else {
        showErrorSafe(result?.message || 'Ошибка отправки');
    }
}

async function loadNotificationsManagement() {
    const container = document.getElementById('notificationsManagement');
    if (!container) return;
    container.innerHTML =
        '<p style="text-align:center;color:var(--text-secondary);">Выберите тип отправки уведомлений кнопками выше.</p>';
}

function initMinkoAiServerPanel() {
    if (window.__reminkoMinkoSrvBound) return;
    window.__reminkoMinkoSrvBound = true;
    document.getElementById('minkoSrvSaveBtn')?.addEventListener('click', () => void saveMinkoAiServerPanel());
}

function initTestsSection() {
    if (window.__reminkoTestsSectionBound) return;
    window.__reminkoTestsSectionBound = true;

    const switchMobileDemoPanel = (name) => {
        const panelName = name || 'home';
        document.querySelectorAll('[data-mobile-demo-panel]').forEach((panel) => {
            panel.classList.toggle('active', panel.dataset.mobileDemoPanel === panelName);
        });
        document.querySelectorAll('[data-mobile-demo-tab]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.mobileDemoTab === panelName);
        });
    };

    document.querySelectorAll('.admin-tests-subtab').forEach((btn) => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.testTab || 'mobile';
            document.querySelectorAll('.admin-tests-subtab').forEach((item) => {
                const active = item.dataset.testTab === name;
                item.classList.toggle('active', active);
                item.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            document.querySelectorAll('.admin-tests-panel').forEach((panel) => {
                const active = panel.dataset.testPanel === name;
                panel.classList.toggle('active', active);
                panel.hidden = !active;
            });
        });
    });

    document.querySelectorAll('[data-mobile-demo-tab]').forEach((btn) => {
        btn.addEventListener('click', () => switchMobileDemoPanel(btn.dataset.mobileDemoTab));
    });
    document.querySelectorAll('[data-mobile-demo-open]').forEach((btn) => {
        btn.addEventListener('click', () => switchMobileDemoPanel(btn.dataset.mobileDemoOpen));
    });

    const search = document.getElementById('mobileDemoSearchInput');
    const results = document.getElementById('mobileDemoSearchResults');
    search?.addEventListener('input', () => {
        const q = String(search.value || '').toLowerCase().trim();
        results?.querySelectorAll('[data-title]').forEach((row) => {
            const title = String(row.dataset.title || row.textContent || '').toLowerCase();
            row.hidden = !!q && !title.includes(q);
        });
    });
}

async function loadMinkoAiServerPanel() {
    const statusEl = document.getElementById('minkoSrvSaveStatus');
    const en = document.getElementById('minkoSrvEnabled');
    const offExceptCreator = document.getElementById('minkoSrvOfflineExceptCreator');
    const msg = document.getElementById('minkoSrvMessage');
    if (!window.creatorAdminPanel) return;
    if (statusEl) statusEl.textContent = 'Загрузка…';

    const bundle = await window.creatorAdminPanel.getMinkoAiServerBundle();
    if (!bundle.ok) {
        if (statusEl) statusEl.textContent = bundle.message || 'Ошибка';
        return;
    }
    if (en) en.checked = !!bundle.public.chat_enabled;
    if (offExceptCreator) offExceptCreator.checked = !!bundle.public.offline_except_creator;
    if (msg) msg.value = bundle.public.maintenance_message || '';
    if (statusEl) statusEl.textContent = '';
}

async function saveMinkoAiServerPanel() {
    const statusEl = document.getElementById('minkoSrvSaveStatus');
    const en = document.getElementById('minkoSrvEnabled');
    const offExceptCreator = document.getElementById('minkoSrvOfflineExceptCreator');
    const msg = document.getElementById('minkoSrvMessage');
    if (!window.creatorAdminPanel) return;
    const r = await window.creatorAdminPanel.saveMinkoAiServerSettings(
        !!en?.checked,
        msg?.value || '',
        !!offExceptCreator?.checked
    );
    if (statusEl) statusEl.textContent = r.success ? '✓ ' + r.message : '✗ ' + (r.message || 'Ошибка');
    if (r.success && typeof showSuccess === 'function') showSuccess(r.message);
    if (!r.success && typeof showError === 'function') showError(r.message);
    if (r.success) await loadCreatorAuditLogsPanel();
}

const MAINT_ROUTE_OPTIONS = [
    ['home', 'Главная'],
    ['register', 'Регистрация (кнопка в шапке)'],
    ['messages', 'Личные сообщения'],
    ['friends', 'Друзья'],
    ['watch_together', 'Смотреть вместе'],
    ['profile', 'Профиль'],
    ['favorites', 'Избранное (аниме)'],
    ['info', 'Страница «Инфо»'],
    ['history', 'История просмотра'],
    ['favorites-manga', 'Избранное (манга)'],
    ['manga_catalog', 'Каталог манги'],
    ['minko_ai', 'Minko AI'],
    ['admin', 'Панель создателя'],
    ['support', 'Чат поддержки'],
    ['reader', 'Читалка манги'],
];

function initMaintenanceSettingsSection() {
    const box = document.getElementById('maintExtraRoutes');
    const btn = document.getElementById('maintSaveBtn');
    if (!box || box.dataset.wired === '1') return;
    box.dataset.wired = '1';

    MAINT_ROUTE_OPTIONS.forEach(([key, label]) => {
        const id = `maintRoute_${key.replace(/[^a-z0-9_-]/gi, '_')}`;
        const wrap = document.createElement('label');
        wrap.className = 'setting-item';
        wrap.style.cssText = 'display:flex;align-items:center;gap:0.5rem;cursor:pointer;margin:0;';
        wrap.innerHTML = `<input type="checkbox" id="${id}" data-maint-route="${adminPanelEscapeHtml(key)}" /> <span>${adminPanelEscapeHtml(label)}</span>`;
        box.appendChild(wrap);
    });
    btn?.addEventListener('click', () => void saveMaintenanceSettings());
}

async function loadMaintenanceSettings() {
    initMaintenanceSettingsSection();
    const statusEl = document.getElementById('maintSaveStatus');
    const enabledEl = document.getElementById('maintEnabled');
    if (!supabaseClient || !enabledEl) return;
    const { data, error } = await supabaseClient
        .from('site_maintenance_config')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
    if (error) {
        if (statusEl) {
            statusEl.textContent =
                'Не удалось загрузить конфиг. Убедитесь, что в Supabase есть site_maintenance_config.';
        }
        return;
    }
    enabledEl.checked = !!(data && data.maintenance_enabled);
    const extras = new Set((data && data.extra_allowed_routes) || []);
    document.querySelectorAll('[data-maint-route]').forEach((cb) => {
        cb.checked = extras.has(cb.getAttribute('data-maint-route'));
    });
    if (statusEl) statusEl.textContent = '';
}

async function saveMaintenanceSettings() {
    const statusEl = document.getElementById('maintSaveStatus');
    if (!supabaseClient) return showErrorSafe('Нет подключения к Supabase');
    const enabled = !!document.getElementById('maintEnabled')?.checked;
    const routes = [];
    document.querySelectorAll('[data-maint-route]:checked').forEach((cb) => {
        const k = cb.getAttribute('data-maint-route');
        if (k) routes.push(k);
    });
    const { error } = await supabaseClient
        .from('site_maintenance_config')
        .update({ maintenance_enabled: enabled, extra_allowed_routes: routes })
        .eq('id', 1);
    if (error) return showErrorSafe(error.message || 'Не сохранено');
    if (window.creatorAdminPanel && typeof window.creatorAdminPanel.appendCreatorAuditLog === 'function') {
        await window.creatorAdminPanel.appendCreatorAuditLog('maintenance_settings_save', {
            targetType: 'site',
            details: { maintenance_enabled: enabled, routes_count: routes.length },
        });
    }
    if (statusEl) statusEl.textContent = 'Сохранено.';
    if (typeof showSuccess === 'function') showSuccess('Режим обновлён');
    await loadCreatorAuditLogsPanel();
}

async function showUserActivity(userId) {
    const activity = await window.creatorAdminPanel.getUserActivity(userId, 7);
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">📊 Активность пользователя</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                ${
                    activity
                        ? `<p><strong>За последние 7 дней:</strong></p>
                           <ul><li>Сообщений в общем чате: ${activity.chat_messages}</li></ul>`
                        : '<p>Ошибка загрузки статистики</p>'
                }
            </div>
            <div class="modal-footer">
                <button class="admin-btn" onclick="this.closest('.modal').remove()">Закрыть</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function showEditSubscriptions(userId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px;">
            <div class="modal-header">
                <h2 class="modal-title">VIP «Смотреть вместе»</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <p style="font-size:0.86rem;color:var(--text-secondary);line-height:1.5;margin:0 0 1.25rem;">
                    Здесь выдаётся только VIP для совместного просмотра.
                </p>
                <label style="font-size:0.88rem;">Срок после выдачи (дней):</label>
                <input type="number" class="setting-input" id="editVIPDays" placeholder="30" min="1" value="30" style="margin-top:0.35rem;">
                <div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;">
                    <button type="button" class="admin-btn" onclick="grantVIPForUser('${userId}')" style="flex:1;min-width:130px;">Выдать VIP</button>
                    <button type="button" class="admin-btn admin-btn-danger" onclick="revokeVIPForUser('${userId}')" style="flex:1;min-width:130px;">Снять VIP</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

function showAiSubscriptionEditor(userId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px;">
            <div class="modal-header">
                <h2 class="modal-title">Тариф Minko AI</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="setting-item">
                    <label>Тариф:</label>
                    <select class="setting-select" id="editAiType">
                        <option value="free">Free</option>
                        <option value="sleepy">Sleepy</option>
                        <option value="premium">Premium</option>
                    </select>
                </div>
                <div class="setting-item">
                    <label>Срок в днях (для платных):</label>
                    <input type="number" class="setting-input" id="editAiDays" min="1" value="30" />
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="admin-btn" onclick="saveAiSubscriptionForUser('${userId}')">Сохранить</button>
                <button type="button" class="admin-btn admin-btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function saveAiSubscriptionForUser(userId) {
    const type = document.getElementById('editAiType')?.value || 'free';
    const daysRaw = document.getElementById('editAiDays')?.value || '';
    const days = daysRaw ? parseInt(daysRaw, 10) : null;
    const result = await window.creatorAdminPanel.manageAISubscription(userId, type, type === 'free' ? null : days);
    if (result.success) {
        if (typeof showSuccess === 'function') showSuccess(result.message);
        document.querySelector('.modal.active')?.remove();
    } else {
        showErrorSafe(result.message || 'Ошибка сохранения тарифа AI');
    }
}

async function grantVIPForUser(userId) {
    const days = parseInt(document.getElementById('editVIPDays')?.value || '30', 10);
    if (!days || days < 1) return showErrorSafe('Укажите число дней (от 1)');
    const result = await window.creatorAdminPanel.manageVIPSubscription(userId, 'grant', days);
    if (result.success) {
        if (typeof showSuccess === 'function') showSuccess(result.message);
        document.querySelector('.modal.active')?.remove();
        void loadUsersAdvanced(currentUsersPage);
    } else {
        showErrorSafe(result.message || 'Ошибка');
    }
}

async function revokeVIPForUser(userId) {
    const result = await window.creatorAdminPanel.manageVIPSubscription(userId, 'revoke');
    if (result.success) {
        if (typeof showSuccess === 'function') showSuccess(result.message);
        document.querySelector('.modal.active')?.remove();
        void loadUsersAdvanced(currentUsersPage);
    } else {
        showErrorSafe(result.message || 'Ошибка');
    }
}

async function sendNotificationToUser(userId) {
    showSendNotificationModal('single');
    setTimeout(() => {
        const input = document.getElementById('notifUserId');
        if (input) input.value = userId;
    }, 80);
}

async function openMinkoAiLogsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'minkoAiLogsModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:920px;max-height:90vh;display:flex;flex-direction:column;">
            <div class="modal-header">
                <h2 class="modal-title">История Minko AI</h2>
                <button type="button" class="modal-close" id="minkoAiLogsClose">×</button>
            </div>
            <div class="modal-body" style="display:grid;grid-template-columns:minmax(200px,280px) 1fr;gap:12px;min-height:360px;">
                <div id="minkoAiLogsUserList" style="overflow:auto;border-right:1px solid rgba(255,255,255,0.08);padding-right:8px;">
                    <p class="admin-inline-hint">Загрузка…</p>
                </div>
                <div id="minkoAiLogsTranscript" style="overflow:auto;font-size:13px;line-height:1.45;">
                    <p class="admin-inline-hint">Выберите пользователя слева.</p>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#minkoAiLogsClose')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    const { users, error } = await window.creatorAdminPanel.listMinkoAiChatUsers();
    const listEl = modal.querySelector('#minkoAiLogsUserList');
    const transEl = modal.querySelector('#minkoAiLogsTranscript');
    if (error) {
        listEl.innerHTML = `<p class="admin-inline-hint" style="color:#f87171;">${adminPanelEscapeHtml(error)}</p>`;
        return;
    }
    if (!users.length) {
        listEl.innerHTML = '<p class="admin-inline-hint">Пока нет логов для отображения.</p>';
        return;
    }

    listEl.innerHTML = users
        .map(
            (u) => `<button type="button" class="admin-btn" style="display:block;width:100%;text-align:left;margin-bottom:6px;font-size:12px;"
                data-minko-log-user="${adminPanelEscapeHtml(u.user_id)}">
                ${adminPanelEscapeHtml(u.username)}<br><small style="opacity:0.7">${adminPanelEscapeHtml(
                    u.user_id.slice(0, 8)
                )}…</small>
            </button>`
        )
        .join('');

    listEl.querySelectorAll('[data-minko-log-user]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-minko-log-user');
            transEl.innerHTML = '<p class="admin-inline-hint">Загрузка…</p>';
            const { rows, error: e2 } = await window.creatorAdminPanel.getMinkoAiChatLogsForUser(uid);
            if (e2) {
                transEl.innerHTML = `<p style="color:#f87171">${adminPanelEscapeHtml(e2)}</p>`;
                return;
            }
            transEl.innerHTML =
                rows
                    .map((row) => {
                        const role = row.role === 'user' ? '👤 Пользователь' : '🌸 Minko';
                        const t = row.created_at ? new Date(row.created_at).toLocaleString('ru-RU') : '';
                        return `<div style="margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:8px;">
                            <div style="opacity:0.75;font-size:11px;">${adminPanelEscapeHtml(t)} · ${role}</div>
                            <div style="white-space:pre-wrap;word-break:break-word;">${adminPanelEscapeHtml(
                                row.content
                            )}</div>
                        </div>`;
                    })
                    .join('') || '<p class="admin-inline-hint">Пусто</p>';
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!supabaseClient) {
        showErrorSafe('Supabase не инициализирован');
        hideAdminPageLoading();
        return;
    }

    const {
        data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
        hideAdminPageLoading();
        window.location.href = 'index.html';
        return;
    }

    const isCreator = await window.creatorAdminPanel.checkCreatorStatus(user.id);
    if (!isCreator) {
        showErrorSafe('Доступ запрещен. Только для Создателя.');
        hideAdminPageLoading();
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1800);
        return;
    }

    window.creatorAdminPanel.currentUser = user;
    initTabs();
    bindDashboardControls();
    initUsersSection();
    initModerationSection();
    initNotificationsSection();
    initMaintenanceSettingsSection();
    initMinkoAiServerPanel();
    initGiveawaySection();
    initAnime4kSection();
    initTestsSection();

    await loadDashboard();
    hideAdminPageLoading();
});
