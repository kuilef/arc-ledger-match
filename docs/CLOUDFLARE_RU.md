# Cloudflare Pages Free: статическое демо

Публикуйте только содержимое `dist` через Pages Direct Upload в подтверждённом
аккаунте Free. Ожидаемый адрес: `arc-ledger-match.pages.dev`, если имя свободно.
Домен, Worker script, KV, secrets, API token и OAuth grant не нужны.
Деплой не изменяет доказательную семантику: candidate не доказывает оплату,
fixture остаётся unverified, RPC observation не является finality proof.

## Сборка и проверка

```sh
npm ci --ignore-scripts
npm run validate
npm run test:ui
```

UI tests требуют Chromium: `npx --no-install playwright install chromium`.
Команда build копирует _headers в dist. Новый test проверяет наличие restrictive
CSP/nosniff/no-referrer/no-store и разрешённые connect-src.

В Dashboard: Workers & Pages → Create application → Pages → Direct Upload.
Выберите папку dist либо ZIP с **содержимым dist в корне**. Не загружайте
исходники, node_modules, реальные счета или папку dist как дополнительный уровень.
После upload выберите Deploy и сохраните фактически выданный адрес.
[Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## Проверить публичный адрес

Пройдите synthetic scenario из MANUAL_RU.md, сделайте explicit allocation и
скачайте JSON. В DevTools / Network проверьте CSP, nosniff, no-referrer,
no-store у HTML и JS. Заголовки берутся из dist/_headers, а не локального сервера.
Для live smoke используйте только уже существующий публичный Arc mainnet hash.
Проверьте, что запросы уходят выбранному разрешённому RPC.

Invoice metadata обрабатывается в памяти браузера; приложение не отправляет
его на Cloudflare. Hosting provider получает запросы assets и сетевые метаданные,
RPC — выбранные hashes. Export перед закрытием; автоматического хранения нет.

## Необязательный Workers assets вариант

wrangler.json также поддерживает статические Workers assets без backend.
Если уже существует разрешённая Wrangler-авторизация, подготовительный dry run:
`npx --yes wrangler@4.149.0 deploy --dry-run`.
В согласованном dashboard route он не нужен. Не создавайте новый токен/grant.
[Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

Откат Pages — предыдущая проверенная deployment либо удаление только этого
демо-проекта. Платёжные настройки, тариф и custom domains менять не требуется.
