import { SCALP_CARD_CONFIG, TFS, TF_MS, type Tf } from './constants'
import type { Confluence, Direction, EvalDir, FeedStatus, IndicatorState, LockedSignal, Outcome, ResolvedSignal, ScalpCard, XBar } from './types'

export type Bbo = { bid: number; ask: number; bid_qty: number; ask_qty: number; spread: number; ts: number }
type RawEval = { ready: false; dir: 'SYNCING'; intra_pct: 0 } | { ready: true; dir: EvalDir; intra_pct: number; long_pts: number; short_pts: number; atr14: number; cur_bar_ts: number }

export const emptyCard = (tf: Tf): ScalpCard => ({
  tf, status: 'SYNCING...', lock_state: 'SYNCING', is_locked: false, locked_signal: null, tp1_hit: false, tp2_hit: false,
  dynamic_trail_sl: 0, cooldown_bars_remaining: 0, bars_elapsed: 0, unrealized_pnl_xau: 0, unrealized_r: 0, agreement_drift_pct: 0,
  live_agreement_pct: 0, live_intra_pct: 0, live_mtf_pct: 0, aligned_tf_count: 0, candidate_dir: 'SYNCING', long_pts: 0, short_pts: 0,
  preview: null, last_resolved: null,
})

export type Consensus = { global_aligned_count: number; global_dir: EvalDir; global_signal_agreement_pct: number; bull_tfs: number; bear_tfs: number; ready_tfs: number }

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d

export function resolveScalpCardLock(card: ScalpCard, outcome: Outcome, reason: ResolvedSignal['reason'], exitPx: number, nowMs: number, history: ResolvedSignal[]) {
  const sig = card.locked_signal
  if (!sig) return
  const slDist = Math.max(Math.abs(sig.entry_price - sig.initial_sl), 1e-9)
  const pnl = sig.direction === 'LONG' ? exitPx - sig.entry_price : sig.entry_price - exitPx
  const resolved: ResolvedSignal = { signal: sig, outcome, reason, exit_price: round(exitPx, 2), r_multiple: round(pnl / slDist, 2), resolved_at_ms: nowMs }
  history.unshift(resolved)
  if (history.length > 50) history.pop()
  card.last_resolved = resolved
  card.is_locked = false
  card.locked_signal = null
  card.tp1_hit = false
  card.tp2_hit = false
  card.cooldown_bars_remaining = 1
  card.lock_state = 'EXPIRED_COOLDOWN'
  card.status = outcome
}

/** Called once per CLOSED bar on tf: releases the 1-bar cooldown back to SCANNING. */
export function onCardBarClose(card: ScalpCard) {
  if (card.cooldown_bars_remaining > 0) {
    card.cooldown_bars_remaining -= 1
    if (card.cooldown_bars_remaining === 0 && !card.is_locked) card.lock_state = 'SCANNING'
  }
}

export function updateAll8ScalpTradeCards(args: {
  bars: Record<Tf, XBar[]>
  ind: Record<Tf, IndicatorState>
  bbo: Bbo
  confluence: Confluence
  feedStatus: FeedStatus
  cards: Record<Tf, ScalpCard>
  history: ResolvedSignal[]
  nowMs: number
}): Consensus {
  const { bars: allBars, ind: allInd, bbo, confluence: cf, feedStatus, cards, history, nowMs } = args
  const raw = {} as Record<Tf, RawEval>

  // Pass 1: intra-TF 8-factor order-flow score
  for (const tf of TFS) {
    const bars = allBars[tf]
    const ind = allInd[tf]
    if (bars.length < 50 || !ind.ready || bbo.bid <= 0 || bbo.ask <= 0 || cf.utc_vwap === null) { raw[tf] = { ready: false, dir: 'SYNCING', intra_pct: 0 }; continue }
    const cur = bars[bars.length - 1]
    const close = cur.close
    const delta5 = bars.slice(-5).reduce((s, b) => s + b.delta, 0)
    const curDelta = cur.delta
    const { live_ema9: ema9, live_ema20: ema20, live_ema50: ema50, live_atr14: atr14, live_rsi14: rsi14 } = ind
    const vwap = cf.utc_vwap ?? close
    const vwapU1 = cf.vwap_upper_1sd ?? close
    const vwapL1 = cf.vwap_lower_1sd ?? close
    const vwapU2 = cf.vwap_upper_2sd ?? close
    const vwapL2 = cf.vwap_lower_2sd ?? close
    const buyShare = cur.buy_vol / Math.max(cur.volume, 1e-9)
    const spread = bbo.ask - bbo.bid
    const bboImb = bbo.bid_qty / Math.max(bbo.bid_qty + bbo.ask_qty, 1e-9)
    const cfg = SCALP_CARD_CONFIG[tf]
    let l = 0, s = 0

    // 1. 5-bar Solution-A delta (20)
    if (delta5 > 0) l += curDelta > 0 ? 20 : 12
    else if (delta5 < 0) s += curDelta < 0 ? 20 : 12
    // 2. EMA stack (15)
    if (close > ema9 && ema9 > ema20 && ema20 > ema50) l += 15
    else if (close > ema20) l += 10
    else if (close > ema9) l += 5
    if (close < ema9 && ema9 < ema20 && ema20 < ema50) s += 15
    else if (close < ema20) s += 10
    else if (close < ema9) s += 5
    // 3. 00:00 UTC VWAP & SD anchor (15)
    if ((close >= vwap && close < vwapU2) || (close <= vwapL1 && curDelta > 0)) l += 15
    if ((close <= vwap && close > vwapL2) || (close >= vwapU1 && curDelta < 0)) s += 15
    // 4. Intrabar taker aggression (15)
    if (buyShare >= 0.58) l += 15
    else if (buyShare >= 0.53) l += 10
    if (1 - buyShare >= 0.58) s += 15
    else if (1 - buyShare >= 0.53) s += 10
    // 5. RSI-14 momentum & exhaustion guard (10)
    if ((rsi14 >= 48 && rsi14 <= 72) || (rsi14 < 35 && cf.cvd_bull_div)) l += 10
    if ((rsi14 >= 28 && rsi14 <= 52) || (rsi14 > 65 && cf.cvd_bear_div)) s += 10
    // 6. Sweep / absorption / CVD divergence / room (10)
    const pdh = cf.pdh ?? close + 999
    const pdl = cf.pdl ?? close - 999
    if (cf.pdl_sweep || cf.absorption_bull || cf.cvd_bull_div || pdh - close >= 1.5 * atr14) l += 10
    if (cf.pdh_sweep || cf.absorption_bear || cf.cvd_bear_div || close - pdl >= 1.5 * atr14) s += 10
    // 7. Open-interest regime (10)
    if (cf.oi_regime === 'NEW_LONGS' || cf.oi_regime === 'SHORT_SQUEEZE') l += 10
    else if (cf.oi_regime === 'NEW_SHORTS' || cf.oi_regime === 'LONG_LIQ_FLUSH') s += 10
    // 8. BBO spread & imbalance (5)
    if (spread > 0 && spread <= cfg.max_spread) {
      if (bboImb >= 0.5) l += 5
      if (bboImb <= 0.5) s += 5
    }

    let dir: EvalDir = l >= s ? 'LONG' : 'SHORT'
    const intra = Math.max(l, s)
    if (intra < 45) dir = 'NEUTRAL'
    raw[tf] = { ready: true, dir, intra_pct: round(intra), long_pts: round(l), short_pts: round(s), atr14, cur_bar_ts: cur.ts }
  }

  // Pass 2: cross-TF agreement and immutable lock lifecycle
  for (const tf of TFS) {
    const card = cards[tf]
    const ev = raw[tf]
    if (!ev.ready) {
      if (!card.is_locked) { card.status = 'SYNCING...'; card.lock_state = card.cooldown_bars_remaining > 0 ? 'EXPIRED_COOLDOWN' : 'SYNCING'; card.candidate_dir = 'SYNCING' }
      continue
    }
    const cfg = SCALP_CARD_CONFIG[tf]
    const targetDir: EvalDir = card.is_locked && card.locked_signal ? card.locked_signal.direction : ev.dir
    const aligned = TFS.filter(k => raw[k].ready && raw[k].dir === targetDir && (targetDir === 'LONG' || targetDir === 'SHORT'))
    const mtfPct = round((aligned.length / 8) * 100)
    const activeIntra = targetDir === 'LONG' ? ev.long_pts : targetDir === 'SHORT' ? ev.short_pts : ev.intra_pct
    const liveAgree = round(0.65 * activeIntra + 0.35 * mtfPct)
    Object.assign(card, { live_agreement_pct: liveAgree, live_intra_pct: activeIntra, live_mtf_pct: mtfPct, aligned_tf_count: aligned.length, candidate_dir: ev.dir, long_pts: ev.long_pts, short_pts: ev.short_pts })

    if (card.is_locked && card.locked_signal) {
      const sig = card.locked_signal
      const d = sig.direction
      const execPx = d === 'LONG' ? bbo.bid : bbo.ask
      const slDist = Math.abs(sig.entry_price - sig.initial_sl)
      card.agreement_drift_pct = round(liveAgree - sig.locked_agreement_pct)
      card.bars_elapsed = Math.max(0, Math.floor((ev.cur_bar_ts - sig.locked_bar_ts) / TF_MS[tf]))
      card.unrealized_pnl_xau = round(d === 'LONG' ? execPx - sig.entry_price : sig.entry_price - execPx, 2)
      card.unrealized_r = round(card.unrealized_pnl_xau / Math.max(slDist, 1e-9), 2)
      const slHit = d === 'LONG' ? execPx <= card.dynamic_trail_sl : execPx >= card.dynamic_trail_sl
      const tp3Hit = d === 'LONG' ? execPx >= sig.tp3_price : execPx <= sig.tp3_price
      const tp2Hit = d === 'LONG' ? execPx >= sig.tp2_price : execPx <= sig.tp2_price
      const tp1Hit = d === 'LONG' ? execPx >= sig.tp1_price : execPx <= sig.tp1_price
      if (tp3Hit) resolveScalpCardLock(card, 'RESOLVED_WIN', 'TP3_FULL_TARGET', execPx, nowMs, history)
      else if (slHit) resolveScalpCardLock(card, card.tp1_hit ? 'RESOLVED_WIN' : 'RESOLVED_LOSS', card.tp1_hit ? 'TRAIL_STOP_PROFIT' : 'INITIAL_SL_HIT', execPx, nowMs, history)
      else if (card.bars_elapsed >= cfg.max_hold_bars && !card.tp1_hit) resolveScalpCardLock(card, card.unrealized_pnl_xau > 0 ? 'RESOLVED_WIN' : 'EXPIRED_COOLDOWN', 'MAX_HOLD_EXPIRED', execPx, nowMs, history)
      else if (tp2Hit && !card.tp2_hit) { card.tp1_hit = true; card.tp2_hit = true; card.lock_state = 'TP2_PARTIAL'; card.dynamic_trail_sl = sig.tp1_price }
      else if (tp1Hit && !card.tp1_hit) { card.tp1_hit = true; card.lock_state = 'TP1_PARTIAL'; card.dynamic_trail_sl = sig.entry_price }
      if (card.is_locked) card.status = card.lock_state
      continue
    }

    // Unlocked: preview levels and lock trigger
    const spreadNow = bbo.ask - bbo.bid
    if (ev.dir === 'LONG' || ev.dir === 'SHORT') {
      const sign = ev.dir === 'LONG' ? 1 : -1
      const entry = ev.dir === 'LONG' ? bbo.ask : bbo.bid
      const slDist = cfg.sl_atr * ev.atr14
      card.preview = { entry: round(entry, 2), sl: round(entry - sign * slDist, 2), tp1: round(entry + sign * cfg.tp1_r * slDist, 2), tp2: round(entry + sign * cfg.tp2_r * slDist, 2), tp3: round(entry + sign * cfg.tp3_r * slDist, 2) }
    } else card.preview = null

    if (card.cooldown_bars_remaining > 0) { card.lock_state = 'EXPIRED_COOLDOWN'; card.status = 'COOLDOWN'; continue }
    card.lock_state = 'SCANNING'
    card.status = 'SCANNING'
    const alignmentGate = aligned.length >= 5 || (cf.sweep_alert && ev.intra_pct >= 80) || ev.intra_pct >= 82
    if (feedStatus === 'LIVE' && ev.atr14 > 0 && (ev.dir === 'LONG' || ev.dir === 'SHORT') && liveAgree >= cfg.min_agree_pct && alignmentGate && spreadNow <= cfg.max_spread) {
      const d: Direction = ev.dir
      const entry = d === 'LONG' ? bbo.ask : bbo.bid
      const slDist = cfg.sl_atr * ev.atr14
      const sign = d === 'LONG' ? 1 : -1
      card.is_locked = true
      card.lock_state = 'LOCKED_ACTIVE'
      card.status = 'LOCKED_ACTIVE'
      card.tp1_hit = false
      card.tp2_hit = false
      card.bars_elapsed = 0
      card.unrealized_pnl_xau = 0
      card.unrealized_r = 0
      card.agreement_drift_pct = 0
      card.dynamic_trail_sl = round(entry - sign * slDist, 2)
      card.locked_signal = Object.freeze({
        signal_id: `XAU-${cfg.label}-${ev.cur_bar_ts}`,
        timeframe: tf,
        display_tf: cfg.label,
        locked_at_ms: nowMs,
        locked_bar_ts: ev.cur_bar_ts,
        direction: d,
        entry_price: round(entry, 2),
        initial_sl: round(entry - sign * slDist, 2),
        tp1_price: round(entry + sign * cfg.tp1_r * slDist, 2),
        tp2_price: round(entry + sign * cfg.tp2_r * slDist, 2),
        tp3_price: round(entry + sign * cfg.tp3_r * slDist, 2),
        atr_at_lock: round(ev.atr14, 2),
        locked_agreement_pct: liveAgree,
        locked_intra_pct: ev.intra_pct,
        locked_mtf_pct: mtfPct,
        locked_aligned_tfs: Object.freeze([...aligned]) as Tf[],
        locked_tf_snapshot: Object.freeze(TFS.map(k => Object.freeze({ tf: k, dir: raw[k].dir, intra_pct: raw[k].intra_pct }))) as LockedSignal['locked_tf_snapshot'],
      })
    }
  }

  const readyTfs = TFS.filter(tf => raw[tf].ready)
  const bull = readyTfs.filter(tf => raw[tf].dir === 'LONG').length
  const bear = readyTfs.filter(tf => raw[tf].dir === 'SHORT').length
  return {
    global_aligned_count: Math.max(bull, bear),
    global_dir: readyTfs.length === 0 ? 'SYNCING' : bull === bear ? 'NEUTRAL' : bull > bear ? 'LONG' : 'SHORT',
    global_signal_agreement_pct: round((Math.max(bull, bear) / 8) * 100),
    bull_tfs: bull,
    bear_tfs: bear,
    ready_tfs: readyTfs.length,
  }
}
