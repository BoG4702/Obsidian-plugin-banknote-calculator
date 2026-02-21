# Cash & Savings (Obsidian Community Plugin)

Cash & Savings считает наличные по номиналам, показывает общий итог, хранит план накоплений и создаёт логи операций.

## Manual install

1. В корне проекта выполните:
```bash
npm install
npm run build
```
2. Скопируйте файлы `manifest.json`, `main.js`, `styles.css` в:
`<Ваш Vault>/.obsidian/plugins/cash-savings/`
3. Перезапустите Obsidian или нажмите `Reload plugins`.
4. Включите плагин `Cash & Savings` в `Settings -> Community plugins`.

## Wallet location

- По умолчанию кошелёк хранится в `Finance/Wallet.md`.
- Папка логов по умолчанию: `Finance/Logs`.
- Оба пути и валюта настраиваются в `Settings -> Cash & Savings`.

## Operations

- `Deposit`: прибавляет введённые количества к текущим `counts`.
- `Withdraw`: вычитает введённые количества из текущих `counts`.
- `Set counts`: полностью задаёт абсолютные количества по каждому номиналу.
- Отрицательные остатки запрещены: операция с уходом в минус отклоняется.

## Wallet YAML example

```yaml
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
```

## Log YAML example

```yaml
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
```
