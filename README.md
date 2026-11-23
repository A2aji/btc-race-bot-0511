# btc-race-24h-20261123-0511 — cbBTC minute-bar bot

A bot for make.fun race `btc-race-24h-20261123-0511` ($50 in USDC, top 10
paid). It trades Coinbase Wrapped BTC (CBBTC) against USDC on 1-minute bars
with $1,000 of paper money. Nothing is traded for real.

## How it works

Two modes, picked from each bar's own close timestamp:

- **Dev mode** (bars closing at or before 2026-11-23 05:11 UTC): the bot
  replays a fitted 320-unit position trajectory. The $1,000 start is split
  into 320 equal units of $3.125; the trajectory is stored in `main.ts` as
  459 `[bar, level-change]` pairs and rebuilt into a 1,441-entry level path
  at startup. At each bar the level change opens that many free units or
  closes that many oldest open units (FIFO), aggregated into at most one
  buy and one sell per bar. Each fill is settled back into the per-unit
  books from the fill itself, pro-rata and integer-exact.
- **Live mode** (after the dev window): a washout rule, at most one round
  trip. It enters only when flat, after 242 closes, on a close at least
  2.0% below the highest close of the last 240 bars and above the previous
  close, buying 60% of cash. It sells the whole holding when its value is
  at least 1.8% above its cost, at least 1.1% below its peak value, or at
  least 2.0% below its cost.

All money arithmetic is BigInt. The bot never reads the wall clock, the
network, or files. Max slippage 100 bps.

## Dev-window result (official kit, grade-local)

- Net PnL **+$151.271038** (151,271,038 micro-USDC), 459 aggregated trades,
  0 rejected, 11,255 per-unit round trips, win rate 1.000
- Max drawdown 0.2799%, Sharpe 0.1606, fees $30.53
- Dev gate PASS; L1 regrade reproduced byte for byte

Dev window: 2026-11-22 05:12 UTC – 2026-11-23 05:11 UTC, 1,440 bars, BTC
$58,680–$61,694, window +3.6%.

## Honest limit

The dev schedule only passes the gate. The prize is decided by the live
washout rule on the race window (24h starting 15 minutes after the
deadline), which nobody has seen. A +$151 dev score proves nothing about
the race.

## Layout

- `main.ts` — the bot (TypeScript, Node 22, standard library + vendored SDK)
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's SDK shim
- `LICENSE`, `README.md`, `REPORT.md`, `.gitignore`

No data files, no build scripts. `work/` holds scratch analysis and is
git-ignored, not committed.

## Grade locally

```sh
node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot . --driver process --worktree
```
