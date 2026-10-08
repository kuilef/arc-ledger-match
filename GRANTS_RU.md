# Arc Microgrants — подготовка заявки

Проверено **8 октября 2026** по [странице Arc House](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq)
и [странице программы на DoraHacks](https://dorahacks.io/hackathon/arc-microgrants/detail).
DoraHacks прочитан в обычном браузере; web-fetch этой страницы вернул ошибку.
Перед подачей перепроверьте обе страницы: организатор может менять условия.

## Что подтверждено

Программа конкурсная: двадцать грантов по **500 USDC**, общий пул **10 000 USDC**.
Отбор идёт по мере поступления работ, решения обещаны до 21 октября. Traction,
компания, презентация и roadmap не требуются.

Срок подачи — **14 октября 2026, 23:59 ET**. В эту дату Нью-Йорк использует
EDT (UTC−4): это **15 октября 03:59 UTC / 06:59 Israel** (Asia/Jerusalem,
UTC+3). DoraHacks в браузере также показывает 15 октября 06:59.

Нужны открываемая live-ссылка на работающий mainnet-проект, публичный репозиторий,
краткое описание роли Arc и публичный профиль разработчика. Только mockup,
testnet или работа без Arc-компонента не подходят. Ранее профинансированная
Circle/Arc работа исключается. Есть проверка юрисдикции и личности получателя
после условного отбора; выплата идёт в USDC на Arc.

Правило допускает одну заявку на проект и несколько **разных** проектов от
команды. Возможность нескольких выплат одному solo-разработчику прямо не
подтверждена. Количество репозиториев не означает количество грантов.

## Статус этой работы

Arc Ledger Match — работающий локальный прототип. Он читает публичные mainnet
receipts (chain 5042), нормализует native/ERC20 USDC evidence, показывает gas
отдельно и распределяет principal по существующим счетам. Фактический read-only
mainnet smoke сохранён в `evidence/live-mainnet.json`. Основная демонстрация
использует синтетический набор, обозначенный в интерфейсе.

**Допуск read-only приложения прямо не подтверждён правилами.** Требование
говорит о deployed and working on Arc mainnet; наш прототип не разворачивает
свой контракт и не создаёт onchain транзакций. Публичного размещения интерфейса
ещё нет. Mainnet receipts доказывают техническую интеграцию чтения, но не
grant eligibility. Допуск, отбор и выплата не гарантированы.

## Черновик описания заявки

> Arc Ledger Match helps freelancers and small teams allocate received USDC
> against invoices they already keep in CSV or JSON. It reports partial payments,
> overpayments, ambiguous candidates and unallocated principal with the source
> and reason behind each conclusion. A user can explicitly split one payment
> across invoices without exceeding its principal.
>
> The prototype reads selected public Arc mainnet receipts, treats the native
> system Transfer stream as principal, avoids double counting ERC20 mirror logs,
> preserves exact 18/6-decimal amounts and reports transaction gas separately.
> Invoice metadata stays in browser memory. It connects no wallet, holds no keys
> and sends no transactions. Public transfer evidence does not prove the
> commercial relationship to an invoice; attribution remains explicit.
>
> Source, tests, synthetic demo data and recorded read-only mainnet observations
> are public. This is an independent allocation tool, with no checkout contracts
> or customer accounts. The current deliverable is local; add the actual public
> demo URL only after hosting and reviewing it. We have not claimed users,
> traction, external audit, program acceptance or funding.

Материалы для заполнения реально показанных полей: repo `https://github.com/kuilef/arc-ledger-match`, профиль
`https://github.com/kuilef`, live URL — только фактический адрес после размещения.
Нельзя вставлять вымышленный live URL, testnet transaction или считать локальную
ссылку публичной.

## Evidence checklist

- [ ] Открыть публичный репозиторий и привязанный зелёный CI точного commit.
- [ ] Повторить инструкции установки и открыть синтетический demo.
- [ ] Показать частичную оплату, переплату, ambiguity, явный split и budget error.
- [ ] Показать mainnet 5042 receipt из сохранённого публичного smoke и новый
      read-only запрос; provenance и отдельные gas fees должны быть видны.
- [ ] Убедиться, что screenshot и JSON для заявки содержат только публичные
      blockchain-данные и синтетические invoices, никаких частных клиентов.
- [ ] Разместить статический `dist/`, проверить рабочую live-ссылку, CORS, CSP и
      поведение главной страницы. Хостинг не включён CI и не выполнен агентом.
- [ ] Честно описать read-only модель и проверить её соответствие требованию
      mainnet deployment до подачи; не заявлять подтверждённый допуск.
- [ ] Повторно проверить срок и правила на официальных страницах.

## Только пользователь

Самостоятельно выберите и разместите публичный demo. Официальный Register ведёт
на `https://dorahacks.io/hackathon/arc-microgrants`. Пройдите показанную проверку
человека и вход, найдите подачу проекта, создайте или выберите BUIDL, если
интерфейс это предлагает. Заполните действительно показанные поля, прочтите
условия, отправьте и сохраните подтверждение привязки к Arc Microgrants.
Созданная BUIDL-страница сама по себе не означает поданную заявку. Возможность
редактирования после подачи, обязательность видео и подключения кошелька именно
при подаче публично не подтверждены. В облачном браузере 8 октября в 21:25 UTC
форма была закрыта Human Verification; CAPTCHA, вход и форма агентом не пройдены.

При необходимости уточните read-only eligibility у организатора. Агент не отправляет заявку и не пишет
организаторам. Подтверждение личности/KYC, payout wallet на Arc и любая операция
с деньгами выполняются пользователем. Прототип не требует onchain расходов;
если правила потребуют контракт или транзакцию, это отдельное решение и отдельная
авторизация. Не добавляйте платежи ради видимости активности.
