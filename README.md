# Cash & Savings — Obsidian Community Plugin  
**RU / EN** • Track cash by denomination, plan savings, and keep operation logs (YAML-backed).

---

## 🇷🇺 Русский

### 📌 Описание
**Cash & Savings** — плагин для Obsidian, который помогает вести учёт наличных по номиналам (купюры и монеты), автоматически считает общий итог, позволяет составлять простой план накоплений и ведёт логи операций.

Данные хранятся прямо в вашем vault в виде **Markdown-заметок** с **YAML frontmatter**, поэтому всё прозрачно, синхронизируется и легко бэкапится.

---

## ✨ Возможности

- **Учёт купюр и монет по номиналам**
  - Подсчёт суммы по каждому номиналу и общего итога
- **Операции**
  - `Deposit` — добавить количества
  - `Withdraw` — убрать количества
  - `Set counts` — задать абсолютные количества
  - Отрицательные остатки **запрещены**
- **План накоплений**
  - `monthly × months` → прогноз итоговой суммы
- **Логи операций**
  - Запись каждого изменения: время, тип операции, дельта по номиналам, комментарий, итог после операции

---

## 🚀 Установка (Manual install)

1) В корне проекта выполните:
```bash
npm install
npm run build

2) Скопируйте только эти файлы:

manifest.json

main.js

styles.css (если есть)

в папку:
<Ваш Vault>/.obsidian/plugins/cash-savings/

Пример:
YourVault/.obsidian/plugins/cash-savings/manifest.json

Перезапустите Obsidian
или нажмите: Settings → Community plugins → Reload plugins.

Включите плагин:
Settings → Community plugins → Cash & Savings

⚠️ Не копируйте node_modules/ и папку src/ в vault — Obsidian использует только main.js, manifest.json, styles.css.

🧭 Запуск Dashboard (панели)

Откройте командную палитру Obsidian:

Windows/Linux: Ctrl + P

macOS: Cmd + P

Запустите команду:

Cash & Savings: Open Dashboard

Откроется панель Cash & Savings.

Первый запуск

Если файла кошелька ещё нет, плагин автоматически создаст:

Finance/Wallet.md

Finance/Logs/ (папка логов)

⚙️ Настройки и расположение данных

По умолчанию:

Wallet: Finance/Wallet.md

Logs: Finance/Logs

Currency: RUB

Можно изменить в:
Settings → Cash & Savings

🔁 Операции (как работает логика)

Deposit: прибавляет введённые количества к текущим counts.

Withdraw: вычитает введённые количества из текущих counts.

Set counts: полностью задаёт абсолютные количества по каждому номиналу.

Если операция уводит какой-то номинал в минус → операция отклоняется.

🗂 Формат данных (YAML examples)
Wallet YAML example
---
type: cash_wallet
schema_version: 1
currency: RUB
denoms:
  banknotes: [5000, 2000, 1000, 500, 200, 100, 50, 10, 5]
  coins: [10, 5, 2, 1]
counts:
  banknotes:
    "5000": 2
    "2000": 1
    "1000": 0
    "500": 0
    "200": 0
    "100": 3
    "50": 0
    "10": 1
    "5": 0
  coins:
    "10": 4
    "5": 0
    "2": 3
    "1": 10
plan:
  monthly: 15000
  months: 6
goal:
  target: 200000
  deadline: 2026-12-31
---

Log YAML example
---
id: 2026-02-21T12:00:00.000Z-a1b2c3d4
type: cash_log
schema_version: 1
wallet_path: Finance/Wallet.md
ts: 2026-02-21T12:00:00.000Z
kind: deposit
delta:
  banknotes:
    "5000": 1
    "100": -2
  coins:
    "1": 10
total_before: 7340
total_after: 12240
comment: пополнение
---

Troubleshooting (частые проблемы)
Плагин не загружается

Откройте DevTools: Ctrl + Shift + I → вкладка Console

Посмотрите сообщение об ошибке

Чаще всего помогает:

пересобрать: npm run build

заново скопировать main.js в папку плагина

перезапустить Obsidian

После перезапуска Obsidian вкладка Dashboard “пропала”

Просто снова запустите:
Cash & Savings: Open Dashboard через Ctrl/Cmd + P.

🗺 Roadmap (идеи на будущее)

Графики (динамика баланса, пополнения по времени)

Экспорт логов в CSV

Поддержка нескольких кошельков

Умный прогноз достижения цели по истории логов

📄 License

Добавьте лицензию (например, MIT) в LICENSE.

🇬🇧 English
📌 Overview

Cash & Savings is an Obsidian plugin that helps you track cash by denomination (banknotes & coins), calculate totals automatically, maintain a simple savings plan, and keep operation logs.

All data is stored inside your vault as Markdown notes with YAML frontmatter, which makes it transparent, sync-friendly, and easy to back up.

✨ Features

Cash tracking by denomination

Per-denomination breakdown + grand total

Operations

Deposit — add counts

Withdraw — subtract counts

Set counts — set absolute counts

Negative balances are not allowed

Savings plan

monthly × months → projected total

Operation logs

Records each change: timestamp, operation type, delta, comment, total after

🚀 Manual Install

In the project root:
Troubleshooting (частые проблемы)
Плагин не загружается

Откройте DevTools: Ctrl + Shift + I → вкладка Console

Посмотрите сообщение об ошибке

Чаще всего помогает:

пересобрать: npm run build

заново скопировать main.js в папку плагина

перезапустить Obsidian

После перезапуска Obsidian вкладка Dashboard “пропала”

Просто снова запустите:
Cash & Savings: Open Dashboard через Ctrl/Cmd + P.

🗺 Roadmap (идеи на будущее)

Графики (динамика баланса, пополнения по времени)

Экспорт логов в CSV

Поддержка нескольких кошельков

Умный прогноз достижения цели по истории логов

📄 License

Добавьте лицензию (например, MIT) в LICENSE.

🇬🇧 English
📌 Overview

Cash & Savings is an Obsidian plugin that helps you track cash by denomination (banknotes & coins), calculate totals automatically, maintain a simple savings plan, and keep operation logs.

All data is stored inside your vault as Markdown notes with YAML frontmatter, which makes it transparent, sync-friendly, and easy to back up.

✨ Features

Cash tracking by denomination

Per-denomination breakdown + grand total

Operations

Deposit — add counts

Withdraw — subtract counts

Set counts — set absolute counts

Negative balances are not allowed

Savings plan

monthly × months → projected total

Operation logs

Records each change: timestamp, operation type, delta, comment, total after

🚀 Manual Install

In the project root:
npm install
npm run build

Copy only these files:

manifest.json

main.js

styles.css (if present)

into:
<Your Vault>/.obsidian/plugins/cash-savings/

Restart Obsidian
or click: Settings → Community plugins → Reload plugins.

Enable the plugin:
Settings → Community plugins → Cash & Savings

⚠️ Do NOT copy node_modules/ or src/ into your vault — Obsidian only needs main.js, manifest.json, styles.css.

🧭 Launching the Dashboard

Open Command Palette:

Windows/Linux: Ctrl + P

macOS: Cmd + P

Run:

Cash & Savings: Open Dashboard

The Cash & Savings dashboard will open.

First launch

If the wallet note doesn’t exist yet, the plugin will create:

Finance/Wallet.md

Finance/Logs/ (logs folder)

⚙️ Settings & Data Locations

Defaults:

Wallet: Finance/Wallet.md

Logs: Finance/Logs

Currency: RUB

You can change them in:
Settings → Cash & Savings

🔁 Operations (How it works)

Deposit: adds entered counts to current counts.

Withdraw: subtracts entered counts from current counts.

Set counts: sets absolute counts for each denomination.

If any denomination becomes negative → the operation is rejected.

🗂 Data Format (YAML examples)

See the Wallet YAML example and Log YAML example above (same structure).

🧯 Troubleshooting
Plugin fails to load

Open DevTools: Ctrl + Shift + I → Console

Check the error message

Common fixes:

rebuild: npm run build

recopy main.js into the plugin folder

restart Obsidian

Dashboard tab disappears after restarting Obsidian

Just run:
Cash & Savings: Open Dashboard again via Ctrl/Cmd + P.

🗺 Roadmap

Charts (balance over time, deposits over time)

Export logs to CSV

Multi-wallet support

Smarter goal forecasting based on log history
