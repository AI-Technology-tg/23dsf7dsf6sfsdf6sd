# Локальная автоавтоматизация без GitHub

Этот вариант обновляет каталог на твоём ПК и может деплоить сайт на Netlify без GitHub.

## 1. Проверка вручную

Из корня проекта:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\automation\update-anime-site.ps1" -Enrich
```

Скрипт спросит `KODIK_API_TOKEN` скрытым вводом, обновит Kodik, каталог, похожие аниме, описания и sitemap.

Без дополнительного enrichment:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\automation\update-anime-site.ps1"
```

## 2. Деплой на Netlify

Один раз авторизуй Netlify CLI:

```powershell
npx netlify login
```

Потом можно запускать обновление с деплоем:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\automation\update-anime-site.ps1" -Enrich -Deploy
```

Если Netlify CLI спросит site link, выполни:

```powershell
npx netlify link
```

## 3. Планировщик заданий Windows

Открой:

`Task Scheduler → Create Basic Task`

Рекомендуемые настройки:

- Name: `Re-Minko Anime Update`
- Trigger: Daily
- Time: ночью, например `04:10`
- Action: Start a program

Program/script:

```text
powershell.exe
```

Add arguments:

```text
-ExecutionPolicy Bypass -File "C:\Users\Minko\Desktop\Re -Minko\4h3j5h3g534h5g34jh534\scripts\automation\update-anime-site.ps1" -Enrich -Deploy
```

Start in:

```text
C:\Users\Minko\Desktop\Re -Minko\4h3j5h3g534h5g34jh534
```

## 4. Как хранить токен без GitHub

Для полностью автоматического запуска Планировщик не сможет вводить токен вручную.

Безопасные варианты:

1. Создать системную переменную окружения Windows `KODIK_API_TOKEN`.
2. Или запускать задачу от пользователя, у которого переменная уже задана.

Проверить в PowerShell:

```powershell
$env:KODIK_API_TOKEN
```

Не записывай токен в файлы проекта и не добавляй его в репозиторий.

## 5. Логи

Скрипт пишет логи в:

```text
logs/
```

Если что-то пошло не так, смотри последний файл `anime-auto-update-*.log`.
