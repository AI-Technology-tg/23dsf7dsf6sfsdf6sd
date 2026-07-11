# Re-Minko Maintenance Plan

Цель этого документа - наводить порядок в проекте без риска "починили одно, сломали другое".
Любые изменения должны быть маленькими, проверяемыми и обратимыми.

## Текущее устройство проекта

Re-Minko - статический MPA-сайт без bundler:

- HTML-страницы подключают CSS/JS вручную через `script` и `link`.
- Общие модули живут в `scripts/` и часто экспортируют функции через `window.*`.
- Supabase используется для Auth, Postgres, RLS и Realtime.
- Netlify Functions используются для Minko AI, Kodik proxy, ReManga proxy и Grok avatar.
- Kodik/ReManga каталоги собираются заранее в `data/`.
- Mini Game Minko - отдельная Canvas-игра без сборки.

Главная рабочая папка:

- `4h3j5h3g534h5g34jh534/`

## Зоны проекта

### Общий каркас

- `index.html`
- `scripts/config.js`
- `scripts/supabase-config.js`
- `scripts/navigation.js`
- `scripts/apply-navigation.js`
- `scripts/main.js`
- `scripts/loading.js`
- `styles/main.css`
- `styles/sidebar-layout.css`

Особенность: порядок подключения скриптов критичен.

### Авторизация и профиль

- `scripts/auth.js`
- `scripts/oauth-auth.js`
- `scripts/register.js`
- `scripts/password-reset.js`
- `profile.html`
- `scripts/profile.js`
- `scripts/profile-edit.js`

Проверять после изменений: вход, выход, регистрация, восстановление пароля, кнопки в навигации, профиль текущего пользователя.

### Каталоги аниме и манги

- `catalog/anime.html`
- `catalog/manga.html`
- `anime/view.html`
- `manga/view.html`
- `manga/reader.html`
- `scripts/catalog.js`
- `scripts/manga-catalog.js`
- `scripts/kodik-*`
- `scripts/remanga-*`
- `data/kodik-anime-catalog.json`
- `data/remanga-manga-catalog.json`

Большие JSON не читать и не редактировать вручную. Их нужно пересобирать скриптами.

### Социальные функции

- `friends.html`
- `messages.html`
- `scripts/friends.js`
- `scripts/direct-messages.js`

Риск: часть логики находится inline внутри HTML.

Форум удалён из проекта: `forum.html`, `scripts/forum.js`, `styles/forum-page.css` и `scripts/chat-moderation.js` больше не являются частью runtime.

### Watch Together

- `watch-together.html`
- `scripts/watch-together.js`
- `scripts/watch-together-kodik.js`
- `scripts/watch-together-screencast.js`
- `scripts/watch-together-voice.js`
- `styles/watch-together-page.css`

Это одна из самых хрупких зон: Supabase, Kodik, WebRTC, чат, голос и VIP-логика связаны вместе.

### Minko AI

- `minko-ai.html`
- `scripts/minko-ai.js`
- `scripts/minko-research.js`
- `minko-netlify-proxy/netlify/functions/minko-chat.js`
- `minko-netlify-proxy/netlify/functions/minko-avatar-grok.js`
- `styles/minko-ai.css`

Проверять после изменений: статус онлайн, отправка сообщения, remote off, VIP/лимиты, avatar generation.

### Supabase и схема

- `database.sql`
- `sql/pending/`
- `supabase/`
- `.cursor/rules/database-migration-workflow.mdc`

Важно: не менять `database.sql` напрямую как первый шаг.

Workflow изменений БД:

1. Создать SQL в `sql/pending/YYYYMMDD_short_name.sql`.
2. Применить через MCP Supabase `apply_migration`.
3. Закоммитить pending-файл.
4. Перенести изменения в `database.sql`.
5. Удалить pending-файл.

Новые таблицы обязательно добавлять в `_allowed`, иначе они могут быть удалены при прогоне схемы.

### Netlify Functions

Активные functions подключены через `netlify.toml`:

- `minko-netlify-proxy/netlify/functions/minko-chat.js`
- `minko-netlify-proxy/netlify/functions/kodik-proxy.js`
- `minko-netlify-proxy/netlify/functions/remanga-proxy.js`
- `minko-netlify-proxy/netlify/functions/minko-avatar-grok.js`

Риск: в корне также есть `netlify/functions/` с похожими файлами. Перед правками всегда проверять, какая папка реально используется.

### Mini Game Minko

- `Mini Game Minko/index.html`
- `Mini Game Minko/style.css`
- `Mini Game Minko/game.js`
- медиа в `Mini Game Minko/`

`game.js` большой. Работать по секциям, не рефакторить целиком.

## Главные риски

1. Критичный порядок подключения JS в HTML.
2. Много глобальных функций и объектов через `window.*`.
3. Inline JS внутри больших HTML-страниц.
4. Дублирующиеся или устаревшие Netlify Functions.
5. `database.sql` содержит опасный блок удаления таблиц вне `_allowed`.
6. Большие JSON и медиа нельзя редактировать как обычный код.
7. `config.local.js` может содержать секреты и не должен попадать в git.

## Безопасный порядок наведения порядка

### Этап 0. Только документация

Разрешено:

- добавлять карты проекта;
- описывать чеклисты;
- фиксировать риски;
- не менять runtime-код.

Цель: понять систему, ничего не сломав.

### Этап 1. Низкорисковые несостыковки

Разрешено:

- поправить документацию, которая противоречит коду;
- добавить отсутствующие npm scripts, если они уже используются bat/README;
- пометить устаревшие дубли комментариями;
- добавить README к важным папкам.

Нельзя:

- удалять файлы;
- менять схему БД;
- переименовывать глобальные функции.

### Этап 2. Вынести inline JS без изменения логики

Правило: сначала перенос "как есть", без улучшений.

Кандидаты:

1. `messages.html`
2. `watch-together.html`
3. `friends.html`

После каждого переноса нужно проверить соответствующий раздел вручную.

### Этап 3. Устранить дубли

Делать только после того, как стало понятно, какая копия активная.

Кандидаты:

- root `netlify/functions/` vs `minko-netlify-proxy/netlify/functions/`;
- auth/login fallback в `main.js` и `navigation.js`;
- повторяющиеся helpers в HTML inline-скриптах.

### Этап 4. БД и RLS

Только через pending workflow.

Сначала сверить:

- `_allowed`;
- политики `watch_history`;
- политики `notifications`;
- таблицы и RPC, которые реально вызывает фронт.

### Этап 5. Структурный рефакторинг

Только после стабилизации предыдущих этапов.

Возможные направления:

- разделить общие utilities;
- унифицировать Supabase access helpers;
- сделать единый bootstrap для страниц;
- постепенно уменьшать зависимость от `window.*`.

## Мини-чеклисты ручной проверки

### Общий smoke test

- Открывается главная.
- Нет вечного loading screen.
- Навигация отрисована.
- Sidebar ссылки работают.
- Вход/регистрация открывают модалки.
- Ошибок в консоли нет или они ожидаемые.

### Auth

- Вход по email/password.
- Выход.
- Обновление кнопок в topbar/sidebar.
- Профиль открывается.
- После reload сессия сохраняется.

### Каталог аниме

- Открывается `catalog/anime.html`.
- Загружается список.
- Поиск работает.
- Фильтры работают.
- Открывается `anime/view.html`.
- Kodik player/resolve не ломается.

### Манга

- Открывается `catalog/manga.html`.
- Поиск/фильтры работают.
- Открывается `manga/view.html`.
- Reader открывает главы.

### Социальные разделы

- Друзья загружаются.
- Заявка в друзья отправляется.
- ЛС открываются.
- Сообщение отправляется.

### Watch Together

- VIP-проверка работает.
- Комната создаётся.
- Участник подключается.
- Чат комнаты работает.
- Выбор аниме работает.
- Screen share стартует и останавливается.
- Выход закрывает/очищает состояние.

### Minko AI

- Статус подключения обновляется.
- Сообщение отправляется.
- Ответ приходит.
- Remote off показывает понятное сообщение.
- Квота avatar generation отображается.

### Admin / Creator

- Создатель определяется.
- Dashboard загружается.
- Maintenance toggle не ломает доступ к разрешённым страницам.
- Audit log пишется.

## Правила для будущих правок

- Один PR/коммит/задача - одна зона проекта.
- Не смешивать refactor и feature.
- Не менять БД вместе с большим фронтенд-рефакторингом.
- Не удалять дубли, пока не доказано, что они не используются.
- Перед правкой HTML проверять порядок `<script>`.
- После правки страницы проверять её вручную по чеклисту.
- Для больших файлов использовать поиск и чтение секций, а не читать всё подряд.

## Первый рекомендуемый маршрут

1. Сверить и исправить документацию/README без runtime-изменений.
2. Проверить Netlify function duplicates и отметить активную папку.
3. Добавить/исправить отсутствующие npm scripts для существующих bat/README.
4. Вынести inline JS из `messages.html` в отдельный файл без изменения логики.

Такой маршрут снижает риск поломки и постепенно делает проект управляемым.
