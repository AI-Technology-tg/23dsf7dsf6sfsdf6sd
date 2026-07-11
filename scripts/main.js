// Открытие/закрытие модального окна входа

(function reminkoPurgeSocialIconLsCacheOnce() {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith('reminko_social_icon_v1:')) {
                localStorage.removeItem(key);
            }
        }
    } catch (_) {
        /* ignore */
    }
})();

window.__reminkoMainScriptLoaded = true;

// Единая точка обновления кнопок «Войти / Регистрация / Выйти / Профиль»
async function checkAuth() {
    initLoginRegisterHandlers();

    if (window.navigationManager && typeof window.navigationManager.updateAuthLinks === 'function') {
        await window.navigationManager.updateAuthLinks();
    }
}

window.checkAuth = checkAuth;

let __reminkoAuthSyncedOnce = false;

async function reminkoSyncAuthUiOnce() {
    if (__reminkoAuthSyncedOnce) return;
    __reminkoAuthSyncedOnce = true;
    if (typeof checkAuth === 'function') {
        await checkAuth();
    }
}

async function reminkoHandleLogoutClick(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
    if (typeof logoutUser === 'function') {
        await logoutUser();
    }
    if (typeof checkAuth === 'function') {
        await checkAuth();
    }
    window.location.reload();
}

// Кнопка «Войти» — только открывает модалку (не превращается в «Выйти»)
function handleLoginOpen(btn, modal) {
    if (!btn) return;

    if (btn._loginOpenHandler) {
        btn.removeEventListener('click', btn._loginOpenHandler, true);
    }

    const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (modal) {
            modal.classList.add('active');
        }
    };

    btn._loginOpenHandler = handler;
    btn.addEventListener('click', handler, true);
}

function initLoginRegisterHandlers() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const topLoginBtn = document.getElementById('topLoginBtn');
    const topRegisterBtn = document.getElementById('topRegisterBtn');
    const topLogoutBtn = document.getElementById('topLogoutBtn');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');

    if (loginBtn && !loginBtn._handlerAdded) {
        handleLoginOpen(loginBtn, loginModal);
        loginBtn._handlerAdded = true;
    }
    if (topLoginBtn && !topLoginBtn._handlerAdded) {
        handleLoginOpen(topLoginBtn, loginModal);
        topLoginBtn._handlerAdded = true;
    }

    const bindRegister = (btn) => {
        if (!btn || btn._handlerAdded) return;
        btn._handlerAdded = true;
        btn.addEventListener(
            'click',
            (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (registerModal) {
                    registerModal.classList.add('active');
                }
            },
            true
        );
    };

    bindRegister(registerBtn);
    bindRegister(topRegisterBtn);

    if (topLogoutBtn && !topLogoutBtn._handlerAdded) {
        topLogoutBtn._handlerAdded = true;
        topLogoutBtn.addEventListener('click', reminkoHandleLogoutClick, true);
    }
}

window.initLoginRegisterHandlers = initLoginRegisterHandlers;

document.addEventListener('DOMContentLoaded', () => {
    initLoginRegisterHandlers();

    setTimeout(() => {
        initLoginRegisterHandlers();
    }, 500);

    window.addEventListener('reminko:navigation-applied', () => {
        initLoginRegisterHandlers();
        void reminkoSyncAuthUiOnce();
    });

    // Fallback: если событие навигации не пришло, синхронизируем UI один раз.
    setTimeout(() => {
        void reminkoSyncAuthUiOnce();
    }, 1200);

    document.addEventListener('click', (e) => {
        const clickedLoginBtn = e.target.closest('#topLoginBtn, #loginBtn, .btn-top-login, .btn-login');
        if (clickedLoginBtn) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            if (window.navigationManager && typeof window.navigationManager.ensureModalsExist === 'function') {
                window.navigationManager.ensureModalsExist();
            }

            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                loginModal.classList.add('active');
            }
            return false;
        }

        const clickedLogoutBtn = e.target.closest('#topLogoutBtn, .btn-top-logout');
        if (clickedLogoutBtn) {
            reminkoHandleLogoutClick(e);
            return false;
        }

        const clickedRegisterBtn = e.target.closest('#topRegisterBtn, #registerBtn, .btn-top-register, .btn-register');
        if (clickedRegisterBtn) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            if (window.navigationManager && typeof window.navigationManager.ensureModalsExist === 'function') {
                window.navigationManager.ensureModalsExist();
            }

            const registerModal = document.getElementById('registerModal');
            if (registerModal) {
                registerModal.classList.add('active');
            }
            return false;
        }
    }, true);

    const toggleLoginPassword = document.getElementById('toggleLoginPassword');
    const loginPassword = document.getElementById('loginPassword');
    const loginPasswordEyeIcon = document.getElementById('loginPasswordEyeIcon');

    if (toggleLoginPassword && loginPassword && loginPasswordEyeIcon) {
        toggleLoginPassword.addEventListener('click', () => {
            if (loginPassword.type === 'password') {
                loginPassword.type = 'text';
                loginPasswordEyeIcon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                loginPassword.type = 'password';
                loginPasswordEyeIcon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        });
    }
});

document.addEventListener('click', async (e) => {
    if (e.target.id === 'loginSubmit') {
        e.preventDefault();

        const loginForm = document.getElementById('loginForm');
        const errorDiv = document.getElementById('loginError');
        const loginModal = document.getElementById('loginModal');

        if (typeof validateLoginForm === 'function') {
            const validation = validateLoginForm(loginForm);
            if (!validation.valid) {
                if (errorDiv) {
                    errorDiv.textContent = 'Пожалуйста, исправьте ошибки в форме';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            const { email, password } = validation.data;

            if (errorDiv) {
                errorDiv.textContent = '';
                errorDiv.style.display = 'none';
            }

            const result = await loginUser(email, password);
            if (result.success) {
                if (errorDiv) {
                    errorDiv.textContent = '';
                    errorDiv.style.display = 'none';
                }

                if (typeof showSuccess === 'function') {
                    showSuccess(result.message);
                }
                if (loginModal) loginModal.classList.remove('active');

                if (loginForm) loginForm.reset();
                if (typeof hideFieldError === 'function') {
                    loginForm.querySelectorAll('input').forEach((input) => hideFieldError(input));
                }

                if (typeof checkAuth === 'function') {
                    await checkAuth();
                }

                await new Promise((resolve) => setTimeout(resolve, 200));
                window.location.reload();
            } else if (errorDiv) {
                errorDiv.textContent = result.message;
                errorDiv.style.display = 'block';
            }
            return;
        }

        const email = document.getElementById('loginEmail')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;

        if (!email || !password) {
            if (errorDiv) {
                errorDiv.textContent = 'Заполните все поля';
                errorDiv.style.display = 'block';
            }
            return;
        }

        const result = await loginUser(email, password);
        if (result.success) {
            if (errorDiv) {
                errorDiv.textContent = '';
                errorDiv.style.display = 'none';
            }

            if (typeof showSuccess === 'function') {
                showSuccess(result.message);
            }
            if (loginModal) loginModal.classList.remove('active');

            if (typeof checkAuth === 'function') {
                await checkAuth();
            }

            window.location.reload();
        } else if (errorDiv) {
            errorDiv.textContent = result.message;
            errorDiv.style.display = 'block';
        }
    }

    if (e.target.id === 'toggleLoginPassword' || e.target.closest('#toggleLoginPassword')) {
        e.preventDefault();
        const loginPasswordEl = document.getElementById('loginPassword');
        const loginPasswordEyeIconEl = document.getElementById('loginPasswordEyeIcon');

        if (loginPasswordEl && loginPasswordEyeIconEl) {
            if (loginPasswordEl.type === 'password') {
                loginPasswordEl.type = 'text';
                loginPasswordEyeIconEl.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                loginPasswordEl.type = 'password';
                loginPasswordEyeIconEl.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const mainLayout = document.querySelector('.main-layout');

    if (sidebarToggle) {
        const checkMobile = () => {
            if (window.innerWidth <= 768) {
                sidebarToggle.style.display = 'flex';
            } else {
                sidebarToggle.style.display = 'none';
                if (sidebar) sidebar.classList.remove('active');
                if (mainLayout) mainLayout.classList.remove('sidebar-open');
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        if (sidebarToggle && sidebar && mainLayout) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
                mainLayout.classList.toggle('sidebar-open');
            });

            mainLayout.addEventListener('click', (e) => {
                if (
                    window.innerWidth <= 768 &&
                    sidebar.classList.contains('active') &&
                    !sidebar.contains(e.target) &&
                    !sidebarToggle.contains(e.target)
                ) {
                    sidebar.classList.remove('active');
                    mainLayout.classList.remove('sidebar-open');
                }
            });
        }
    }

    const hamburger = document.getElementById('hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });

        document.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }

    // checkAuth запускается централизованно через reminko:navigation-applied/fallback.
});
