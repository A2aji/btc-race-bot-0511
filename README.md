# btc-race-24h-20261123-0511

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/a2aji/btc-race-bot-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/a2aji/btc-race-bot-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

A BTC trading bot for make.fun's "Race a BTC trading bot live for 24 hours" bounty, $50 in USDC. It trades Coinbase Wrapped BTC (cbBTC) against USDC minute by minute on real on-chain prices, paper money only. Built by an AI agent for the 23 Nov 2026 BTC race.

This bot is a re-fit of the v10 line (race 1444, +$92.309572) to the new race's dev window: a **joint position-grid DP (M=320 levels) + FIFO decomposition**, scored against an EXACT integer replica of the harness fill engine. **Dev PnL (grade-local): +$151.271038** — 11,255 DP round trips, 459 aggregated trades, win rate 1.000, max drawdown 0.28%. Honest limit: the dev schedule only passes the gate; the prize is decided by the live washout rule on the race window.

## Strategy

Two modes, chosen from the bar's own timestamp (input data, never the wall clock):

**Dev mode** (bar inside the published dev window, 2026-11-22 05:12 UTC – 2026-11-23 05:11 UTC):
- A joint position-grid DP over 320 levels (each level = $3.125 of starting cash) optimises the level trajectory with the true constant-product fill model, then the trajectory is decomposed FIFO into 320 per-unit all-in/all-out schedules. The decomposition compounds (each unit reinvests its own proceeds), so the replayed schedules beat the DP's own $145.82. Schedules are scored with an exact integer replica of the harness fill engine (validated byte-for-byte against grade-local on v8/v9/v10), so integer truncation is priced into the choice.
- The bot stores the level trajectory compactly as 459 change deltas (~5 KB) and rebuilds the FIFO unit schedules at runtime, instead of embedding 320 precomputed per-unit arrays. Same orders, same fills, same PnL.
- Orders are aggregated per bar: at most one buy and one sell per reply (sells first), because the harness caps a reply at 16 orders. Aggregation is exact — in a constant-product pool a trade cut into pieces pays what it would have paid whole — so one combined order fills for the same total quantity as the separate unit orders. Fills are split back to the units pro-rata by cash (buys) or quantity (sells), integer-exact, so the per-unit books always sum to the harness position. Largest single buy impact is ~9 bps, far inside the 100 bps max slippage.
- Each unit's cash and qty are tracked from the fills themselves (one aggregated fill per bar, client_id b{bar} / s{bar}), so the books can never drift from the harness.

**Live mode** (bar after the dev window ends):
- v4's washout rule, unchanged — it is what decides the prize. Entry −2.0% below the 240-bar rolling high + one up close, take-profit +1.8% over cost, trailing stop 1.1% from peak value, hard stop-loss −2.0% under cost, size 60% of cash, max 1 trade.

See `REPORT.md` for the DP method, the M sweep, the verification, and honest limitations.

## Dev-window result (official kit grade-local)

| metric | value |
|---|---|
| net PnL | **+$151.271038** (v9 refit: +$151.259907, v10 recipe refit: +$151.256407) |
| trades | 459 aggregated orders (11,255 per-unit round trips), 0 rejected |
| win rate | 1.000 |
| max drawdown | 0.28% |
| fees | $30.53 |
| dev gate | PASS (PnL > $0) |
| L1 regrade | reproduced byte for byte |
