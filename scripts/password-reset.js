// Восстановление пароля

document.addEventListener('DOMContentLoaded', () => {
    // Отправка запроса на восстановление пароля через делегирование
    document.addEventListener('click', async (e) => {
        if (e.target.id !== 'passwordResetSubmit') return;
        
        e.preventDefault();
        
        const passwordResetForm = document.getElementById('passwordResetModal')?.querySelector('.login-form');
        const passwordResetError = document.getElementById('passwordResetError');
        const passwordResetSuccess = document.getElementById('passwordResetSuccess');
        
        // Валидация формы
        if (typeof validatePasswordResetForm === 'function' && passwordResetForm) {
            const validation = validatePasswordResetForm(passwordResetForm);
            if (!validation.valid) {
                if (passwordResetError) {
                    passwordResetError.textContent = 'Пожалуйста, исправьте ошибки в форме';
                    passwordResetError.style.display = 'block';
                }
                return;
            }
            
            const email = validation.data.email;
            
            if (passwordResetError) {
                passwordResetError.style.display = 'none';
            }
            
            if (passwordResetSuccess) {
                passwordResetSuccess.style.display = 'none';
            }
            
            if (typeof supabaseClient === 'undefined' || !supabaseClient) {
                if (passwordResetError) {
                    passwordResetError.textContent = 'Ошибка подключения к базе данных';
                    passwordResetError.style.display = 'block';
                }
                return;
            }
            
            try {
                if (typeof logger !== 'undefined') logger.log('🔄 [PASSWORD RESET] Отправка запроса на восстановление пароля...');
                
            // Динамический URL для восстановления пароля (работает на любом домене, включая GitHub Pages)
            // Получаем базовый путь (убираем имя файла, оставляем только путь к директории)
            const basePath = window.location.pathname.replace(/\/[^/]*$/, '') || '';
            const resetUrl = window.location.origin + basePath + '/reset-password.html';
            
            const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: resetUrl
            });
                
                if (error) {
                    if (typeof logger !== 'undefined') logger.error('❌ [PASSWORD RESET] Ошибка:', error);
                    if (passwordResetError) {
                        passwordResetError.textContent = error.message || 'Ошибка отправки письма. Проверьте правильность email.';
                        passwordResetError.style.display = 'block';
                    }
                } else {
                    if (passwordResetError) {
                        passwordResetError.style.display = 'none';
                    }
                    if (passwordResetSuccess) {
                        passwordResetSuccess.style.display = 'block';
                    }
                }
            } catch (error) {
                if (typeof logger !== 'undefined') logger.error('❌ [PASSWORD RESET] Исключение:', error);
                if (passwordResetError) {
                    passwordResetError.textContent = 'Произошла ошибка. Попробуйте позже.';
                    passwordResetError.style.display = 'block';
                }
            }
            return;
        }
        
        // Fallback для старых версий
        const passwordResetEmail = document.getElementById('passwordResetEmail');
        const email = passwordResetEmail?.value.trim();
        
        if (!email) {
            if (passwordResetError) {
                passwordResetError.textContent = 'Введите email';
                passwordResetError.style.display = 'block';
            }
            return;
        }
        
        // Проверка формата email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (passwordResetError) {
                passwordResetError.textContent = 'Некорректный формат email';
                passwordResetError.style.display = 'block';
            }
            return;
        }
        
        if (passwordResetError) {
            passwordResetError.style.display = 'none';
        }
        
        if (passwordResetSuccess) {
            passwordResetSuccess.style.display = 'none';
        }
        
        if (typeof supabaseClient === 'undefined' || !supabaseClient) {
            if (passwordResetError) {
                passwordResetError.textContent = 'Ошибка подключения к базе данных';
                passwordResetError.style.display = 'block';
            }
            return;
        }
        
        try {
            if (typeof logger !== 'undefined') logger.log('🔄 [PASSWORD RESET] Отправка запроса на восстановление пароля...');
            
            // Динамический URL для восстановления пароля (работает на любом домене, включая GitHub Pages)
            // Получаем базовый путь (убираем имя файла, оставляем только путь к директории)
            const basePath = window.location.pathname.replace(/\/[^/]*$/, '') || '';
            const resetUrl = window.location.origin + basePath + '/reset-password.html';
            
            const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: resetUrl
            });
            
            if (error) {
                if (typeof logger !== 'undefined') logger.error('❌ [PASSWORD RESET] Ошибка:', error);
                if (passwordResetError) {
                    passwordResetError.textContent = error.message || 'Ошибка отправки письма. Проверьте правильность email.';
                    passwordResetError.style.display = 'block';
                }
                return;
            }
            
            console.log('✅ [PASSWORD RESET] Письмо отправлено');
            if (passwordResetSuccess) {
                passwordResetSuccess.style.display = 'block';
            }
            if (passwordResetError) {
                passwordResetError.style.display = 'none';
            }
            
        } catch (error) {
            console.error('❌ [PASSWORD RESET] Исключение:', error);
            if (passwordResetError) {
                passwordResetError.textContent = 'Ошибка при отправке письма';
                passwordResetError.style.display = 'block';
            }
        }
    });
});
