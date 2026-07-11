# ReManga proxy для читалки

ReManga блокирует Netlify Functions через DDoS-Guard. Бесплатный рабочий вариант для теста: запускать proxy на ПК и открыть его наружу через Cloudflare Tunnel.

## 1. Запустить proxy

```powershell
cd "C:\Users\Minko\Desktop\Re-Minko-GitHub-Clean"
node scripts/proxy/remanga-local-proxy.js
```

Проверка локально:

```powershell
$raw = 'https://api.remanga.org/api/titles/chapters/?branch_id=16150&ordering=index&page=1&count=1'
$url = 'http://localhost:8787/?url=' + [uri]::EscapeDataString($raw)
Invoke-WebRequest -Uri $url -UseBasicParsing
```

## 2. Открыть proxy через Cloudflare Tunnel

Установить `cloudflared`, затем:

```powershell
cloudflared tunnel --url http://localhost:8787
```

Cloudflare покажет временный адрес вида:

```text
https://example-name.trycloudflare.com
```

## 3. Подключить proxy на сайте для проверки

Открыть сайт, затем в консоли браузера выполнить:

```javascript
reminkoSetRemangaProxyUrl('https://example-name.trycloudflare.com')
location.reload()
```

Проверить текущий proxy:

```javascript
reminkoGetRemangaProxyUrl()
```

Отключить override:

```javascript
reminkoSetRemangaProxyUrl('')
location.reload()
```

## Важно

Временный `trycloudflare.com` URL меняется после перезапуска tunnel. Для постоянной публичной читалки нужен либо постоянный Cloudflare Tunnel на своём домене, либо VPS до $5/мес.
