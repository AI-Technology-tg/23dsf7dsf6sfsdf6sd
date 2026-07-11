# Автоматизация аниме-каталога

## GitHub Secret

Для ночного обновления каталога нужен секрет репозитория:

- `KODIK_API_TOKEN`

Путь в GitHub:

`Repository → Settings → Secrets and variables → Actions → New repository secret`

Значение токена не хранить в файлах проекта.

## GitHub Actions

Workflow уже добавлен:

- `.github/workflows/anime-automation.yml`

Он запускается:

- каждый день ночью;
- вручную через `Actions → Anime Automation → Run workflow`.

Команда workflow:

```bash
npm run automate:anime:api:enrich
```

Она скачивает свежие данные Kodik, пересобирает каталог, обновляет sitemap и коммитит изменённые JSON-файлы.

## Netlify

Если Netlify привязан к этому GitHub-репозиторию, новый commit от GitHub Actions автоматически запустит deploy.

Проверить в Netlify:

- Site settings → Build & deploy → Continuous Deployment
- репозиторий должен быть подключён;
- publish directory: `.`
- functions directory: `minko-netlify-proxy/netlify/functions`

## Локальная проверка

Без API:

```bash
npm run automate:anime
```

С Kodik API:

```bash
KODIK_API_TOKEN=... npm run automate:anime:api:enrich
```

На Windows PowerShell:

```powershell
$env:KODIK_API_TOKEN="..."
npm run automate:anime:api:enrich
Remove-Item Env:KODIK_API_TOKEN
```
