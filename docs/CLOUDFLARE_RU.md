# Cloudflare Pages Free: статическое демо

## Опубликованное демо

Адрес: https://arc-ledger-match.pages.dev/.
Deployment: `c63c5031-dfe0-4709-b2fa-e9633627428f`.

При открытии появляются восемь синтетических invoices. Выберите candidate,
добавьте explicit allocation с причиной и скачайте Export report JSON.
Для live-проверки вставьте уже существующий публичный mainnet hash в
Observe public transfers и нажмите Read selected hashes. Не создавайте перевод.

2026-10-09 в независимом Chrome с этого pages.dev origin успешно прочитан hash
`0x691405ed18faaf588878725c5df92a338cad75fdec5b1f38250d9073ae7ad9c4`:
в 09:56:23 UTC через official RPC и в 09:57:45 UTC через dRPC — два отдельных
system Transfer по `0.041679409011850554` USDC, logIndex 3/4, без предупреждений.
Каждый проход занял три RPC-запроса; повтор не удвоил principal. JSON download
совпал с отображёнными данными; generated_at обновился при экспорте.
Это наблюдения провайдеров, а не commercial settlement или finality proof.

На другой браузерной/сетевой связке в тот же день оба RPC возвращали
`Failed to fetch`. Причина там пока не установлена. Успех с того же публичного
origin в независимом браузере не подтверждает доступность из любой сети.
При таком сбое сохраните точный Console/Network error и OPTIONS/POST status:
это может различить CORS, DNS/TLS, локальный фильтр и ответ провайдера.
Не отключайте защиту браузера и не подменяйте ошибку синтетическим live-ответом.

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


## Повторная публикация из проверенного CI

В успешном run для нужного commit доступны `arc-ledger-match-pages.zip` и
`arc-ledger-match-pages.zip.sha256`. ZIP содержит готовые файлы сайта в корне,
без дополнительной папки dist и без исходных пользовательских данных.
Сверьте SHA256 и загрузите ZIP в существующий Pages проект. Сборка после
тестов не повторяется; артефакт соответствует проверенным bytes.
`arc-ledger-match-ui-screenshots` содержит desktop/mobile и проверку reflow
при ширине 720 CSS px, эквивалентной 200% zoom на 1440 px; это не тест реального
мобильного устройства. Артефакты доступны 14 дней.
