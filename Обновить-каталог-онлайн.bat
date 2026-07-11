@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Re-Minko — обновить каталог
echo.
echo  1. Качаем каталог с Kodik API на этот ПК
echo  2. Потом перетащи ЭТУ папку на Netlify -^> Deploys
echo.
call npm run publish:kodik
echo.
pause
