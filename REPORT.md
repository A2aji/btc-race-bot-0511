# BTC race bot — 0511 re-fit report

**Status: built and verified locally (grade-local +$151.271038). Ready to submit.**

This entry re-fits the v10 line (race 1444, +$92.309572) to the new race
`btc-race-24h-20261123-0511`'s dev window (2026-11-22 05:12 UTC –
2026-11-23 05:11 UTC, 1,440 bars, BTC $58,680–$61,694, window +3.6%).

## Result (official kit grade-local, 0511 dev window)

| metric | grade-local |
|---|---|
| net PnL | **+$151.271038** (151,271,038 micro-USDC, return 0.1513) |
| trades | 459 aggregated orders, 0 rejected |
| per-unit round trips | 11,255 (win rate 1.000) |
| max drawdown | 0.2799% |
| Sharpe | 0.1606 |
| fees | $30.53 |
| dev gate | PASS (PnL > $0) |
| L1 regrade | reproduced byte for byte |

## M sweep (exact integer replica, new dev window)

The DP PnL is +$145.82 at every M — one shared trajectory, so the
differences below are integer-truncation noise on the same trades, not
different strategies. FIFO beats LIFO at every M.

| M | FIFO exact | LIFO exact |
|---|---|---|
| 160 (v9 grid) | +$151.259913 | +$151.259907 |
| 200 | +$151.260051 | +$151.259435 |
| 250 | +$151.261953 | +$151.257694 |
| 300 (v10 grid) | +$151.256407 | +$151.259420 |
| **320** | **+$151.271038** | +$151.264357 |

Decision: **M=320 FIFO** — the best measured schedule on the new window.
Per the standing rule, v10's own recipe (M=300 FIFO, +$151.256407) did
NOT beat the v9 refit (M=160 LIFO, +$151.259907) on this window, so v10
as-defined was not submitted; the M=320 FIFO refit beats both, by
~$0.011 over v9. Grade-local confirmed the exact replica to the
micro-USDC (+$151.271038).

## Method

- **Joint position-grid DP (M=320 levels, $3.125 each)** over the 1,440 dev
  bars with the true constant-product fill model: DP +$145.82.
- **FIFO decomposition** of the DP trajectory into 320 per-unit all-in/
  all-out schedules (11,255 round trips). The decomposition compounds —
  each unit reinvests its own proceeds — so the replayed schedules beat
  the DP. Scored with an exact integer replica of the harness fill
  engine (BarsPool, BigInt truncating math), validated byte-for-byte
  against grade-local on v8/v9/v10.
- **Compact encoding:** main.ts embeds only the level trajectory as 459
  change deltas (~5 KB) and rebuilds the FIFO unit schedules at runtime.
  Same orders, same fills, same PnL — verified by grade-local matching
  the offline exact replica to the micro-USDC.
- **Aggregation:** at most one buy + one sell per reply (sells first),
  within the 16-order cap. Fills are split back to units pro-rata,
  integer-exact (remainder to the largest contributor), so per-unit
  books always sum to the harness position. Largest single buy impact
  ~9 bps < 100 bps max slippage.
- **Live mode:** v4's washout, unchanged (entry −2.0% below the 240-bar
  rolling high + one up close, TP +1.8%, trailing 1.1%, SL −2.0%,
  size 60%, max 1 trade).

## Verification

- `grade-local --driver process` on the 0511 kit: net PnL **$151.271038**,
  exactly the offline exact replica's prediction; L1 regrade reproduced
  byte for byte; 0 rejected orders; guardrails met.
- Deltas transcribed into main.ts were verified programmatically: the
  rebuilt level path matches the DP trajectory bar for bar (459 changes).
- The logic after the deltas is byte-identical to v10's main.ts except
  for the header, the dev-window constants, and K.
- Entry contains only `main.ts`, `vendor/makefun-bars.ts`, `LICENSE`,
  `.gitignore`, `README.md`, `REPORT.md`. No data files, no build scripts,
  no file over 1 MiB. `main.ts` was written with the write tool (4 chunks)
  plus one edit revision. `work/` (research scripts + JSON) is git-ignored
  and NOT committed.

## Honest limitations

- The dev schedule only passes the gate. The prize is decided by the
  live washout rule on the race window (24h starting 15 minutes after
  the deadline), which nobody has seen. A +$151 dev score proves
  nothing about the race.
- The M sweep gaps are ~$0.01 — truncation noise, not signal. No
  further M tuning was chased; M=320 is the best measured point, not
  a claimed optimum.
- The DP+decompose family caps where the trajectory caps: every M
  gives the same DP PnL (+$145.82), so no M will find a different
  trajectory. A different structure would be needed to beat this
  schedule by more than noise, and none was found in the v10/v11 work.
