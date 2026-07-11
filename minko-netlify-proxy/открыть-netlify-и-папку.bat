@echo off
chcp 65001 >nul
start https://app.netlify.com/drop
explorer "%~dp0"
echo.
echo 1) Перетащите ЭТУ папку (netlify-minko) в окно браузера Netlify.
echo 2) Затем: Site settings → Environment variables — вставьте ключи из файла .env
echo 3) Trigger deploy → Clear cache and deploy
echo.
pause
