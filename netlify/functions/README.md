# Netlify Functions Notice

Эта папка не используется основным деплоем Re-Minko.

Активный путь задан в корневом `netlify.toml`:

```toml
[build]
  functions = "minko-netlify-proxy/netlify/functions"
```

Править runtime-functions нужно в:

- `minko-netlify-proxy/netlify/functions/minko-chat.js`
- `minko-netlify-proxy/netlify/functions/minko-avatar-grok.js`
- `minko-netlify-proxy/netlify/functions/kodik-proxy.js`
- `minko-netlify-proxy/netlify/functions/remanga-proxy.js`

Файлы в этой папке оставлены как старые копии/справка. Не добавляйте сюда новые изменения, пока `netlify.toml` не будет явно переключён на этот путь.
