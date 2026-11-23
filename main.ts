// btc-race-24h-20261123-0511: a cbBTC minute-bar bot for make.fun.
//
// Two modes, picked from each bar's own close timestamp (never the wall
// clock, the network, or a file):
//
// DEV — every bar closing at or before 2026-11-23 05:11 UTC replays a
// fitted 320-unit position trajectory. The $1,000 start is split into
// 320 equal units of $3.125. The trajectory is stored below as 459
// [bar, level-change] pairs and rebuilt into a 1,441-entry level path at
// startup. At dev bar i the change LEVELS[i+1] - LEVELS[i] opens that
// many free units (positive) or closes that many oldest open units
// (negative, FIFO). A unit opened at bar i buys at bar i; a unit closed
// at bar i sells at bar i. Each bar's units are aggregated into at most
// one buy and one sell, sells first, client ids b<i> and s<i>. Each fill
// is settled back into the per-unit books from the fill itself: a buy
// fill's quantity is split pro-rata by the buying units' cash, a sell
// fill's net proceeds pro-rata by the selling units' quantity,
// integer-exact with the remainder to the largest contributor. A pending
// order whose bar is older than the previous bar is dropped, never
// misattributed. The last dev bar sends no new orders; the trajectory
// ends at level 0, so nothing is left for the harness to flatten.
//
// LIVE — after the dev window, a washout rule, at most one round trip:
// enter only flat, after 242 closes, when the close is at least 2.0%
// below the highest close of the last 240 bars and above the previous
// close; buy 60% of cash. While holding, sell everything when the
// position's value is at least 1.8% above its cost, at least 1.1% below
// its peak value, or at least 2.0% below its cost.
//
// All money is BigInt quote units (micro-USDC). One symbol, CBBTC. Max
// slippage 100 bps. Bar length 60,000 ms. 1,440 bars.

import {
  runBars,
  type Bar,
  type BarsState,
  type Batch,
  type Fill,
  type OrderInput,
} from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MAX_SLIPPAGE_BPS = 100;
const BAR_MS = 60_000;
const DEV_START_MS = 1795324320000; // first dev bar closes 2026-11-22 05:12 UTC
const DEV_END_MS = 1795410660000; // last dev bar closes 2026-11-23 05:11 UTC
const BARS = 1440;
const UNITS = 320;
const START_CASH = 1_000_000_000n; // 1,000 USDC in quote units
const UNIT_CASH = START_CASH / BigInt(UNITS); // 3,125,000 quote units = $3.125

// The fitted trajectory as [bar, level-change] pairs: applying the change
// at its bar to a level that starts at 0 rebuilds the 1,440-bar path.
// 459 pairs, level range 0..320, ends back at 0.
const DELTAS: [number, number][] = [
  [8, 109], [9, 110], [10, 63], [11, -81], [12, -1], [14, -21], [18, -4], [19, -15],
  [20, -4], [21, -66], [22, -90], [27, 32], [28, 29], [29, 41], [30, 11], [31, 11],
  [32, 40], [33, 44], [34, 44], [35, 68], [40, -6], [41, -10], [48, 16], [56, -61],
  [57, -32], [58, -50], [59, -62], [60, -57], [61, -51], [62, -7], [71, 4], [72, 25],
  [73, 59], [74, 66], [75, 56], [76, 50], [77, 50], [82, 10], [87, -84], [88, -78],
  [89, -102], [90, -36], [91, -1], [99, -19], [110, 68], [111, 74], [112, 23], [126, -36],
  [142, -32], [143, -48], [144, -31], [145, -18], [148, 54], [149, 54], [150, 31], [151, 31],
  [152, 42], [153, 41], [154, 42], [155, 25], [184, -43], [185, 43], [205, -36], [206, -232],
  [207, -52], [215, 40], [216, 52], [217, 198], [219, 30], [221, -15], [228, -12], [229, -26],
  [230, -66], [233, -15], [234, -40], [237, 26], [238, 26], [239, 27], [240, 61], [241, 10],
  [245, 20], [246, 4], [250, -18], [251, -84], [252, -48], [253, -59], [256, 68], [257, 49],
  [258, 60], [259, 21], [260, 11], [287, -166], [288, -154], [290, 28], [291, 109], [292, 130],
  [293, 53], [298, -165], [299, -155], [323, 110], [324, 144], [326, 45], [327, 11], [334, 10],
  [344, -64], [345, -123], [349, 46], [350, 73], [351, 12], [352, 56], [361, -10], [362, -25],
  [363, -31], [364, -21], [368, 70], [371, 17], [377, -42], [388, -95], [389, -13], [396, 52],
  [397, 34], [398, 19], [399, 21], [400, 24], [425, -84], [426, -97], [427, -139], [435, 73],
  [436, 52], [438, 195], [440, -107], [441, -92], [442, -120], [443, -1], [445, 55], [446, -55],
  [447, 59], [448, 166], [449, 95], [455, -67], [456, 5], [459, -29], [460, -1], [466, -27],
  [468, -60], [469, -20], [470, -121], [474, 2], [475, 80], [480, 51], [481, 3], [485, -22],
  [486, -12], [488, -2], [498, 161], [499, 59], [505, -35], [506, -113], [507, -109], [509, -33],
  [510, -30], [515, 16], [517, 81], [518, 153], [519, 70], [525, -160], [526, -27], [527, -26],
  [528, 3], [529, 3], [535, -7], [536, -16], [537, -17], [538, -65], [539, -8], [556, 5],
  [557, 5], [558, 6], [559, 66], [560, 85], [561, 81], [562, 59], [563, 3], [564, 3],
  [565, 7], [574, -83], [580, 8], [581, 26], [582, 49], [587, -34], [588, -34], [593, -161],
  [594, -39], [595, -52], [601, 5], [606, 5], [607, 66], [608, 54], [609, 60], [610, 27],
  [611, 9], [617, -119], [618, -69], [619, -38], [633, 117], [634, 117], [635, 81], [637, 5],
  [645, -26], [648, 2], [649, 8], [650, 8], [651, 8], [664, -3], [669, 1], [670, 2],
  [687, -22], [690, -7], [692, -86], [693, -86], [694, -44], [696, -75], [724, 71], [725, 53],
  [726, 42], [727, 46], [729, 14], [730, 42], [741, 52], [747, -17], [748, -17], [749, -29],
  [750, -56], [751, -56], [752, -56], [753, -55], [754, -34], [777, 120], [778, 129], [779, 71],
  [785, -73], [786, -73], [787, -89], [788, -58], [789, -27], [797, 108], [798, 69], [799, 57],
  [800, 26], [801, 40], [802, 7], [803, 4], [804, 9], [825, -105], [826, -105], [827, -69],
  [828, -37], [829, -4], [850, 8], [851, 44], [858, -13], [859, -13], [860, -13], [873, -7],
  [874, -6], [912, 4], [913, 4], [914, 26], [915, 30], [916, 46], [917, 46], [918, 45],
  [919, 21], [921, 5], [922, 16], [923, 16], [924, 16], [925, 16], [926, 16], [927, 13],
  [953, -81], [954, -33], [955, -82], [956, -21], [957, -6], [960, 70], [962, 2], [966, 88],
  [967, 28], [968, 7], [969, 28], [975, -36], [976, -171], [977, -102], [978, -11], [982, 18],
  [983, 18], [994, -25], [995, -11], [1011, 129], [1012, 77], [1023, -39], [1026, -11], [1027, -65],
  [1028, -65], [1029, -26], [1035, 70], [1036, 45], [1037, 45], [1038, 45], [1039, 45], [1040, 20],
  [1041, 25], [1042, 25], [1070, -100], [1071, -163], [1072, -16], [1073, -21], [1074, -20], [1078, 128],
  [1079, 67], [1080, 83], [1081, 24], [1082, 10], [1083, 8], [1087, -24], [1089, -2], [1090, -27],
  [1097, 24], [1098, 29], [1108, -143], [1109, -85], [1110, -28], [1111, -22], [1117, 16], [1118, 3],
  [1124, -8], [1125, -53], [1127, 33], [1128, 75], [1130, -12], [1132, 52], [1135, 4], [1136, 22],
  [1137, 118], [1138, 28], [1151, -12], [1152, -99], [1157, 42], [1158, 69], [1160, -10], [1161, -17],
  [1162, -123], [1163, -66], [1164, -62], [1166, -42], [1168, 87], [1169, 54], [1173, -111], [1175, 11],
  [1176, 27], [1177, 84], [1178, 84], [1179, 84], [1186, -101], [1187, -18], [1188, -46], [1189, -155],
  [1197, 63], [1199, 71], [1200, 71], [1201, 17], [1203, -28], [1204, -39], [1205, 2], [1206, -51],
  [1207, -63], [1210, 88], [1211, 91], [1212, 49], [1213, 12], [1214, 5], [1215, 32], [1220, -47],
  [1221, -12], [1222, -61], [1223, -81], [1224, -23], [1225, -96], [1230, 9], [1231, -5], [1232, -4],
  [1258, 37], [1259, 25], [1260, 22], [1261, -15], [1262, -24], [1263, -1], [1264, -22], [1265, -22],
  [1280, 11], [1281, 44], [1282, 9], [1284, -32], [1285, -32], [1292, 148], [1293, 71], [1296, -16],
  [1297, -9], [1299, 63], [1300, 63], [1302, -70], [1304, 28], [1305, 27], [1306, 15], [1323, -82],
  [1325, 31], [1326, 7], [1327, 44], [1331, -131], [1334, -189], [1337, 94], [1338, 42], [1339, 67],
  [1340, 117], [1343, -41], [1344, -184], [1345, -47], [1346, -13], [1347, -35], [1355, 75], [1359, 65],
  [1360, 116], [1366, -61], [1367, -74], [1370, 89], [1375, 20], [1376, 69], [1377, 21], [1384, -29],
  [1386, 29], [1392, -82], [1393, -124], [1394, -114], [1402, 2], [1403, 14], [1404, 112], [1406, 73],
  [1407, 90], [1411, 24], [1412, 3], [1417, 2], [1426, -2], [1427, -17], [1428, -1], [1431, -92],
  [1432, -109], [1433, -55], [1434, -44],
];

// Rebuild the level path: LEVELS[i] is the position level during bar i,
// LEVELS[0] = 0 and LEVELS[BARS] = 0 (one past the last bar, for the
// final bar's delta). Each pair's change applies at its bar.
const LEVELS: number[] = new Array<number>(BARS + 1).fill(0);
for (const pair of DELTAS) {
  LEVELS[pair[0]] += pair[1];
}
for (let i = 1; i <= BARS; i++) {
  LEVELS[i] += LEVELS[i - 1];
}

// ---------------------------------------------------------------- per-unit books

interface UnitBook {
  cash: bigint;
  qty: bigint;
}

const units: UnitBook[] = [];
for (let u = 0; u < UNITS; u++) {
  units.push({ cash: UNIT_CASH, qty: 0n });
}

// Open units, oldest opened first; free units, longest free first. A unit
// moves lists when its bar's order is decided, and its cash/qty settle
// when the fill arrives on the next batch.
let openUnits: number[] = [];
let freeUnits: number[] = [];
for (let u = 0; u < UNITS; u++) {
  freeUnits.push(u);
}

interface SideBook {
  units: number[];
  contribs: bigint[];
}

interface PendingOrder {
  bar: number;
  buy: SideBook | null;
  sell: SideBook | null;
}

const pendings = new Map<number, PendingOrder>();

// Split `total` over the contributors pro-rata, integer-exact: every share
// is floored and the whole remainder goes to the largest contributor
// (the first of them on a tie), so the shares always sum to `total`.
function splitProRata(total: bigint, contribs: readonly bigint[]): bigint[] {
  let sum = 0n;
  for (const c of contribs) {
    sum += c;
  }
  const shares = contribs.map((c) => (sum === 0n ? 0n : (total * c) / sum));
  let given = 0n;
  for (const s of shares) {
    given += s;
  }
  const remainder = total - given;
  if (remainder > 0n && shares.length > 0) {
    let largest = 0;
    for (let k = 1; k < contribs.length; k++) {
      if (contribs[k] > contribs[largest]) {
        largest = k;
      }
    }
    shares[largest] += remainder;
  }
  return shares;
}

// ---------------------------------------------------------------- fills

// A buy that never filled leaves its units open with cash and no qty; put
// them back at the front of the free list, in their original order.
function restoreBuySide(side: SideBook): void {
  const gone = new Set(side.units);
  openUnits = openUnits.filter((u) => !gone.has(u));
  freeUnits = [...side.units, ...freeUnits];
}

// A sell that never filled leaves its units free with qty and no cash; put
// them back at the front of the open list, in their original order.
function restoreSellSide(side: SideBook): void {
  const gone = new Set(side.units);
  freeUnits = freeUnits.filter((u) => !gone.has(u));
  openUnits = [...side.units, ...openUnits];
}

function restorePending(p: PendingOrder): void {
  if (p.buy !== null) {
    restoreBuySide(p.buy);
    p.buy = null;
  }
  if (p.sell !== null) {
    restoreSellSide(p.sell);
    p.sell = null;
  }
}

// Drop every pending order whose bar is older than the previous bar
// (keepFrom): its fill will never arrive, so its units go back where they
// came from and the fill is never misattributed to another bar's order.
function dropStalePendings(keepFrom: number): void {
  for (const [bar, p] of pendings) {
    if (bar < keepFrom) {
      restorePending(p);
      pendings.delete(bar);
    }
  }
}

// Settle one fill of a previous bar's order, matched by its client id
// (b<i> for a buy decided at dev bar i, s<i> for a sell). A buy fill's
// quantity is split over the buying units by their cash; a sell fill's
// net proceeds (notional less fee) over the selling units by their
// quantity. A rejected fill restores the units instead.
function settleFill(fill: Fill): void {
  const id = fill.client_id;
  if (id.length < 2) {
    return;
  }
  const kind = id[0];
  if (kind !== 'b' && kind !== 's') {
    return;
  }
  const bar = Number(id.slice(1));
  if (!Number.isInteger(bar) || bar < 0 || bar >= BARS) {
    return;
  }
  const p = pendings.get(bar);
  if (p === undefined) {
    return;
  }
  if (fill.side === 'buy') {
    const side = p.buy;
    if (side === null) {
      return;
    }
    p.buy = null;
    if (fill.status === 'filled') {
      const shares = splitProRata(BigInt(fill.qty), side.contribs);
      for (let k = 0; k < side.units.length; k++) {
        const u = side.units[k];
        units[u].qty += shares[k];
        units[u].cash = 0n;
      }
    } else {
      restoreBuySide(side);
    }
  } else {
    const side = p.sell;
    if (side === null) {
      return;
    }
    p.sell = null;
    if (fill.status === 'filled') {
      // The fill's notional is the quote that actually changed hands: the
      // net proceeds, the fee already taken out of them. Split those
      // proceeds over the selling units by their quantity.
      const net = BigInt(fill.notional_quote_units);
      const shares = splitProRata(net, side.contribs);
      for (let k = 0; k < side.units.length; k++) {
        const u = side.units[k];
        units[u].cash += shares[k];
        units[u].qty = 0n;
      }
    } else {
      restoreSellSide(side);
    }
  }
  if (p.buy === null && p.sell === null) {
    pendings.delete(bar);
  }
}

// ---------------------------------------------------------------- dev mode

function devDecide(state: BarsState, i: number): OrderInput[] {
  const delta = LEVELS[i + 1] - LEVELS[i];
  if (delta === 0) {
    return [];
  }
  const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
  if (delta > 0) {
    const buying = freeUnits.slice(0, delta);
    const contribs = buying.map((u) => units[u].cash);
    let notional = 0n;
    for (const c of contribs) {
      notional += c;
    }
    // Below the harness minimum notional the buy is skipped and the units
    // stay free; each unit alone holds $3.125, so this never fires here.
    if (notional < minNotional) {
      return [];
    }
    freeUnits = freeUnits.slice(delta);
    for (const u of buying) {
      openUnits.push(u);
    }
    pendings.set(i, { bar: i, buy: { units: buying, contribs }, sell: null });
    return [{
      side: 'buy',
      client_id: `b${i}`,
      symbol: SYMBOL,
      notional_quote_units: notional,
      max_slippage_bps: MAX_SLIPPAGE_BPS,
    }];
  }
  const n = -delta;
  const selling = openUnits.slice(0, n);
  const contribs = selling.map((u) => units[u].qty);
  let qty = 0n;
  for (const c of contribs) {
    qty += c;
  }
  if (qty === 0n) {
    return [];
  }
  openUnits = openUnits.slice(n);
  for (const u of selling) {
    freeUnits.push(u);
  }
  pendings.set(i, { bar: i, buy: null, sell: { units: selling, contribs } });
  return [{
    side: 'sell',
    client_id: `s${i}`,
    symbol: SYMBOL,
    qty,
    max_slippage_bps: MAX_SLIPPAGE_BPS,
  }];
}

// ---------------------------------------------------------------- live mode

// Closes seen so far in the live window, and the peak value of the live
// position while it is held.
const liveCloses: bigint[] = [];
let liveEntered = false;
let livePeak = 0n;

function liveDecide(state: BarsState, bar: Bar): OrderInput[] {
  const close = BigInt(bar.c);
  liveCloses.push(close);
  const pos = state.positions.get(SYMBOL);
  const qty = pos === undefined ? 0n : pos.qty;
  if (qty > 0n) {
    const cost = pos.cost;
    const value = state.value(SYMBOL, qty, close);
    if (value > livePeak) {
      livePeak = value;
    }
    const takeProfit = value * 1000n >= cost * 1018n;
    const trailingStop = value * 1000n <= livePeak * 989n;
    const hardStop = value * 1000n <= cost * 980n;
    if (takeProfit || trailingStop || hardStop) {
      return [{
        side: 'sell',
        client_id: 'live-sell',
        symbol: SYMBOL,
        qty,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
      }];
    }
    return [];
  }
  if (liveEntered) {
    return [];
  }
  if (liveCloses.length < 242) {
    return [];
  }
  const prev = liveCloses[liveCloses.length - 2];
  if (close <= prev) {
    return []; // no confirmation: never buy mid-fall
  }
  let hi = 0n;
  const start = liveCloses.length - 240;
  for (let k = start; k < liveCloses.length; k++) {
    if (liveCloses[k] > hi) {
      hi = liveCloses[k];
    }
  }
  if (close * 100n > hi * 98n) {
    return []; // not 2.0% below the highest close of the last 240 bars
  }
  const notional = (state.cash * 60n) / 100n;
  if (notional < BigInt(state.hello.fees.min_notional_quote_units)) {
    return [];
  }
  liveEntered = true;
  livePeak = 0n;
  return [{
    side: 'buy',
    client_id: 'live-buy',
    symbol: SYMBOL,
    notional_quote_units: notional,
    max_slippage_bps: MAX_SLIPPAGE_BPS,
  }];
}

// ---------------------------------------------------------------- the loop

function findBar(batch: Batch): Bar | undefined {
  for (const b of batch.bars) {
    if (b.symbol === SYMBOL) {
      return b;
    }
  }
  return undefined;
}

// The dev bar index of the most recent dev bar seen (-1 before the first).
let devBarSeen = -1;

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    // Settle the previous bar's fills before deciding this bar: the units
    // a fill touches are the ones this bar's delta may open or close.
    for (const fill of batch.fills) {
      settleFill(fill);
    }
    const bar = findBar(batch);
    if (bar === undefined) {
      // No CBBTC bar this minute: nothing to decide, but a fill that will
      // never arrive must not linger.
      dropStalePendings(devBarSeen);
      return [];
    }
    if (bar.t < DEV_START_MS) {
      return []; // warm-up bars carry no dev index
    }
    if (bar.t > DEV_END_MS) {
      return liveDecide(state, bar);
    }
    const i = Math.floor((bar.t - DEV_START_MS) / BAR_MS);
    if (i < 0 || i >= BARS) {
      return [];
    }
    devBarSeen = i;
    dropStalePendings(i - 1);
    if (i >= BARS - 1) {
      return []; // last dev bar: no new orders
    }
    return devDecide(state, i);
  },
});
