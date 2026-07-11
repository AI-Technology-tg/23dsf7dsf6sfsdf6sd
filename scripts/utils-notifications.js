// Глобальные функции уведомлений (тосты внутри страницы, без alert / системных всплывашек ОС)

function _notifOpts(linkOrOpts) {
    if (linkOrOpts && typeof linkOrOpts === 'object' && !Array.isArray(linkOrOpts)) {
        return linkOrOpts;
    }
    const link = linkOrOpts && typeof linkOrOpts === 'string' && linkOrOpts.trim() ? linkOrOpts.trim() : '';
    return link ? { link } : {};
}

/** Минимальный тост, если notificationService ещё не загружен (никогда не alert) */
function _reminkoFallbackToast(message, type) {
    try {
        let el = document.getElementById('reminko-fallback-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'reminko-fallback-toast';
            el.setAttribute('role', 'status');
            el.style.cssText =
                'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100020;' +
                'max-width:min(420px,92vw);padding:12px 16px;border-radius:14px;font:600 13px Nunito,system-ui,sans-serif;' +
                'box-shadow:0 12px 40px rgba(0,0,0,.45);transition:opacity .25s ease;opacity:0;text-align:center;line-height:1.4;';
            document.body.appendChild(el);
        }
        const bg = {
            success: 'linear-gradient(135deg,#065f46,#047857)',
            error: 'linear-gradient(135deg,#7f1d1d,#b91c1c)',
            warning: 'linear-gradient(135deg,#713f12,#b45309)',
            info: 'linear-gradient(135deg,#1e3a5f,#1d4ed8)'
        };
        el.style.background = bg[type] || bg.info;
        el.style.color = '#fff';
        el.textContent = message;
        requestAnimationFrame(() => {
            el.style.opacity = '1';
        });
        clearTimeout(el._hide);
        el._hide = setTimeout(() => {
            el.style.opacity = '0';
        }, 4000);
    } catch (e) {
        console.warn('[toast]', message);
    }
}

function _showNotif(message, type, linkOrOpts) {
    const opts = _notifOpts(linkOrOpts);
    if (typeof window.notificationService !== 'undefined' && window.notificationService) {
        window.notificationService.showNotification(message, type, opts);
    } else {
        _reminkoFallbackToast(message, type);
    }
}

// Показ уведомления об успехе (второй аргумент — ссылка или { link, withSound: true })
function showSuccess(message, linkOrOpts) {
    if (!message || message === 'undefined' || message === 'null') {
        return; // Не показываем undefined/null сообщения
    }
    console.log('✅ [SUCCESS]', message);
    _showNotif(message, 'success', linkOrOpts);
}

// Показ информационного уведомления
function showInfo(message, linkOrOpts) {
    console.log('ℹ️ [INFO]', message);
    _showNotif(message, 'info', linkOrOpts);
}

// Показ предупреждения
function showWarning(message, linkOrOpts) {
    if (!message || message === 'undefined' || message === 'null') {
        return;
    }
    console.log('⚠️ [WARNING]', message);
    _showNotif(message, 'warning', linkOrOpts);
}

// Показ ошибки
function showError(message, linkOrOpts) {
    if (!message || message === 'undefined' || message === 'null') {
        return;
    }
    console.error('❌ [ERROR]', message);
    const opts = _notifOpts(linkOrOpts);
    if (typeof window.notificationService !== 'undefined' && window.notificationService) {
        window.notificationService.showNotification(message, 'error', { ...opts, withSound: true });
    } else {
        _reminkoFallbackToast(message, 'error');
    }
}

// Экспорт в глобальную область
window.showSuccess = showSuccess;
window.showInfo = showInfo;
window.showWarning = showWarning;
window.showError = showError;
