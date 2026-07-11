// Обработка смены пароля

document.addEventListener('DOMContentLoaded', async () => {
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const resetPasswordSubmit = document.getElementById('resetPasswordSubmit');
    const resetPasswordError = document.getElementById('resetPasswordError');
    const resetPasswordSuccess = document.getElementById('resetPasswordSuccess');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    
    // Проверка наличия токена в hash фрагменте URL (Supabase использует hash)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    // Проверяем тип - должен быть recovery
    if (type !== 'recovery') {
        if (resetPasswordError) {
            resetPasswordError.textContent = 'Недействительная или отсутствующая ссылка для восстановления пароля';
            resetPasswordError.style.display = 'block';
        }
        if (resetPasswordForm) {
            resetPasswordForm.style.display = 'none';
        }
        return;
    }
    
    // Supabase автоматически обрабатывает токен из hash фрагмента
    // При вызове updateUser пароль будет обновлен с использованием этого токена
    
    // Просмотр пароля
    const toggleNewPassword = document.getElementById('toggleNewPassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    const newPasswordEyeIcon = document.getElementById('newPasswordEyeIcon');
    const confirmPasswordEyeIcon = document.getElementById('confirmPasswordEyeIcon');
    
    if (toggleNewPassword && newPassword && newPasswordEyeIcon) {
        toggleNewPassword.addEventListener('click', () => {
            if (newPassword.type === 'password') {
                newPassword.type = 'text';
                newPasswordEyeIcon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                newPassword.type = 'password';
                newPasswordEyeIcon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        });
    }
    
    if (toggleConfirmPassword && confirmPassword && confirmPasswordEyeIcon) {
        toggleConfirmPassword.addEventListener('click', () => {
            if (confirmPassword.type === 'password') {
                confirmPassword.type = 'text';
                confirmPasswordEyeIcon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                confirmPassword.type = 'password';
                confirmPasswordEyeIcon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        });
    }
    
    // Обработка отправки формы
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newPasswordValue = newPassword?.value;
            const confirmPasswordValue = confirmPassword?.value;
            
            // Валидация
            if (!newPasswordValue || newPasswordValue.length < 6) {
                if (resetPasswordError) {
                    resetPasswordError.textContent = 'Пароль должен содержать минимум 6 символов';
                    resetPasswordError.style.display = 'block';
                }
                return;
            }
            
            if (newPasswordValue !== confirmPasswordValue) {
                if (resetPasswordError) {
                    resetPasswordError.textContent = 'Пароли не совпадают';
                    resetPasswordError.style.display = 'block';
                }
                return;
            }
            
            if (resetPasswordError) {
                resetPasswordError.style.display = 'none';
            }
            
            if (resetPasswordSuccess) {
                resetPasswordSuccess.style.display = 'none';
            }
            
            if (resetPasswordSubmit) {
                resetPasswordSubmit.disabled = true;
                resetPasswordSubmit.textContent = 'Сохранение...';
            }
            
            if (typeof supabaseClient === 'undefined' || !supabaseClient) {
                if (resetPasswordError) {
                    resetPasswordError.textContent = 'Ошибка подключения к базе данных';
                    resetPasswordError.style.display = 'block';
                }
                if (resetPasswordSubmit) {
                    resetPasswordSubmit.disabled = false;
                    resetPasswordSubmit.textContent = 'Сохранить новый пароль';
                }
                return;
            }
            
            try {
                console.log('🔄 [RESET PASSWORD] Обновление пароля...');
                
                // Обновляем пароль
                const { data, error } = await supabaseClient.auth.updateUser({
                    password: newPasswordValue
                });
                
                if (error) {
                    console.error('❌ [RESET PASSWORD] Ошибка:', error);
                    if (resetPasswordError) {
                        resetPasswordError.textContent = error.message || 'Ошибка при изменении пароля';
                        resetPasswordError.style.display = 'block';
                    }
                    if (resetPasswordSubmit) {
                        resetPasswordSubmit.disabled = false;
                        resetPasswordSubmit.textContent = 'Сохранить новый пароль';
                    }
                    return;
                }
                
                console.log('✅ [RESET PASSWORD] Пароль успешно обновлен');
                
                if (resetPasswordSuccess) {
                    resetPasswordSuccess.textContent = 'Пароль успешно изменен! Вы будете перенаправлены на страницу входа...';
                    resetPasswordSuccess.style.display = 'block';
                }
                
                // Перенаправляем на страницу входа через 2 секунды
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
                
            } catch (error) {
                console.error('❌ [RESET PASSWORD] Исключение:', error);
                if (resetPasswordError) {
                    resetPasswordError.textContent = 'Ошибка при изменении пароля';
                    resetPasswordError.style.display = 'block';
                }
                if (resetPasswordSubmit) {
                    resetPasswordSubmit.disabled = false;
                    resetPasswordSubmit.textContent = 'Сохранить новый пароль';
                }
            }
        });
    }
});
