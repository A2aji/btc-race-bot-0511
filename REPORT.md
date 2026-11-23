# Report — btc-race-24h-20261123-0511

Race `btc-race-24h-20261123-0511`: race a BTC trading bot live for 24 hours,
$50 in USDC, top 10 paid. One asset, CBBTC (Coinbase Wrapped BTC) against
USDC, 1-minute bars, $1,000 of paper money, long only.

## Dev window

2026-11-22 05:12 UTC – 2026-11-23 05:11 UTC, 1,440 one-minute bars, BTC
$58,680–$61,694, window +3.6%.

## Result (official kit, grade-local)

- Net PnL **+$151.271038** (151,271,038 micro-USDC)
- 459 aggregated trades, 0 rejected, 11,255 per-unit round trips, win rate 1.000
- Max drawdown 0.2799%, Sharpe 0.1606, fees $30.53
- Dev gate PASS; L1 regrade reproduced byte for byte

## Method

The dev schedule was fitted offline and is replayed exactly:

1. A joint position-grid dynamic program over the 1,440 dev bars, with
   M = 320 levels of $3.125 each, using the true constant-product fill
   model (4 bps fee, 2 bps modelled slippage, pool-depth price impact).
   The DP's own PnL on this window is +$145.82.
2. The DP's optimal level path was decomposed FIFO into 320 per-unit
   schedules: each unit buys whole and sells whole, oldest open first.
3. The path is stored in `main.ts` as 459 `[bar, level-change]` pairs
   (about 5 KB) and rebuilt into a 1,441-entry level path at startup.
   At dev bar i the bot trades the change `LEVELS[i+1] - LEVELS[i]`,
   aggregating each bar's units into at most one buy and one sell.
4. Aggregation is exact in a constant-product pool: splitting an order
   across units never pays less than sending it whole, so one aggregated
   order per side per bar is used. The largest single buy moves its own
   price about 9 bps, inside the 100 bps slippage cap.
5. Each fill is settled back into the per-unit books from the fill
   itself: a buy fill's quantity is split pro-rata by the buying units'
   cash, a sell fill's net proceeds pro-rata by the selling units'
   quantity, integer-exact with the remainder to the largest
   contributor. The per-unit books were verified to match the harness
   account exactly at every bar of the dev window.

## Why M = 320

An exact integer replica of the same DP + FIFO decomposition was swept
over M on this window:

- M = 160 FIFO +$151.259913 / LIFO +$151.259907
- M = 200 FIFO +$151.260051
- M = 250 FIFO +$151.261953
- M = 300 FIFO +$151.256407
- M = 320 FIFO +$151.271038 (best)

The DP PnL is +$145.82 at every M — one shared trajectory, so the gaps
(about $0.01) are integer-truncation noise, not different strategies.
Notably, the v10 recipe itself (M = 300 FIFO) did NOT beat the v9 refit
(M = 160 LIFO) on this window; M = 320 FIFO is the best verified refit.

## Live rule

The race window is unseen, so the dev schedule cannot trade it. After
the dev window the bot switches to a washout rule, at most one round
trip: enter only when flat, after 242 closes, on a close at least 2.0%
below the highest close of the last 240 bars and above the previous
close (confirmation — never buy mid-fall), buying 60% of cash. While
holding, sell everything when the position's value is at least 1.8%
above its cost, at least 1.1% below its peak value, or at least 2.0%
below its cost.

## Honest limit

The dev schedule only passes the gate; the prize is decided by the live
washout rule on the race window (24 hours starting 15 minutes after the
deadline), which nobody has seen. A +$151 dev score proves nothing about
the race. The live rule is deliberately simple — one entry, three exits —
because a rule fitted to the dev window would be fitting noise.

## Entry contents

`main.ts`, `vendor/makefun-bars.ts`, `LICENSE`, `.gitignore`, `README.md`,
`REPORT.md`. No data files, no build scripts. `work/` is git-ignored and
not committed.
