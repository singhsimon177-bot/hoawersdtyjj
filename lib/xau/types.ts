import type { Tf } from './constants'

/** Unified 13-key bar parsed from OKX row [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]. */
export type XBar = {
  ts: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  close_ts: number
  quote_vol: number
  is_closed: boolean
  trades: number
  buy_vol: number
  sell_vol: number
  delta: number
}

export type Flow = { buy_vol: number; sell_vol: number; delta: number; trades: number }
export const emptyFlow = (): Flow => ({ buy_vol: 0, sell_vol: 0, delta: 0, trades: 0 })

export type OkxTrade = { instId: string; tradeId: string; px: string; sz: string; side: 'buy' | 'sell'; ts: string; count?: string }

export type Direction = 'LONG' | 'SHORT'
export type EvalDir = Direction | 'NEUTRAL' | 'SYNCING'

export type IndicatorState = {
  ready: boolean
  count: number
  prev_close: number
  ema9: number
  ema20: number
  ema50: number
  atr14: number
  avg_gain: number
  avg_loss: number
  live_ema9: number
  live_ema20: number
  live_ema50: number
  live_atr14: number
  live_rsi14: number
}

export type LockedSignal = {
  signal_id: string
  timeframe: Tf
  display_tf: string
  locked_at_ms: number
  locked_bar_ts: number
  direction: Direction
  entry_price: number
  initial_sl: number
  tp1_price: number
  tp2_price: number
  tp3_price: number
  atr_at_lock: number
  locked_agreement_pct: number
  locked_intra_pct: number
  locked_mtf_pct: number
  locked_aligned_tfs: Tf[]
  locked_tf_snapshot: { tf: Tf; dir: EvalDir; intra_pct: number }[]
}

export type LockState = 'SYNCING' | 'SCANNING' | 'LOCKED_ACTIVE' | 'TP1_PARTIAL' | 'TP2_PARTIAL' | 'EXPIRED_COOLDOWN'
export type Outcome = 'RESOLVED_WIN' | 'RESOLVED_LOSS' | 'EXPIRED_COOLDOWN'

export type ResolvedSignal = {
  signal: LockedSignal
  outcome: Outcome
  reason: 'TP3_FULL_TARGET' | 'TRAIL_STOP_PROFIT' | 'INITIAL_SL_HIT' | 'MAX_HOLD_EXPIRED'
  exit_price: number
  r_multiple: number
  resolved_at_ms: number
}

export type ScalpCard = {
  tf: Tf
  status: string
  lock_state: LockState
  is_locked: boolean
  locked_signal: LockedSignal | null
  tp1_hit: boolean
  tp2_hit: boolean
  dynamic_trail_sl: number
  cooldown_bars_remaining: number
  bars_elapsed: number
  unrealized_pnl_xau: number
  unrealized_r: number
  agreement_drift_pct: number
  live_agreement_pct: number
  live_intra_pct: number
  live_mtf_pct: number
  aligned_tf_count: number
  candidate_dir: EvalDir
  long_pts: number
  short_pts: number
  preview: { entry: number; sl: number; tp1: number; tp2: number; tp3: number } | null
  last_resolved: ResolvedSignal | null
}

export type FeedStatus = 'SYNCING' | 'LIVE' | 'STALE_HALT' | 'RECONNECTING'
export type OiRegime = 'NEW_LONGS' | 'SHORT_SQUEEZE' | 'NEW_SHORTS' | 'LONG_LIQ_FLUSH' | 'NEUTRAL'

export type Confluence = {
  ready: boolean
  pdh: number | null
  pdl: number | null
  pd_date: string | null
  cdh: number | null
  cdl: number | null
  dist_pdh: number | null
  dist_pdl: number | null
  asian_high: number | null
  asian_low: number | null
  pdh_sweep: boolean
  pdl_sweep: boolean
  sweep_alert: boolean
  sweep_testing: boolean
  sweep_detail: string | null
  utc_vwap: number | null
  vwap_distance: number | null
  vwap_upper_1sd: number | null
  vwap_lower_1sd: number | null
  vwap_upper_2sd: number | null
  vwap_lower_2sd: number | null
  cvd: number | null
  cvd_bull_div: boolean
  cvd_bear_div: boolean
  absorption_bull: boolean
  absorption_bear: boolean
  absorption_tf: Tf | null
  oi_regime: OiRegime
  oi_delta_xau: number | null
  oi_price_delta: number | null
  matrix: { tf: Tf; delta5: number; ema20: number; close: number; vote: -1 | 0 | 1 }[]
  confluence_score: number
  terminal_bias: 'STRONG BULLISH' | 'STRONG BEARISH' | 'MIXED / CHOP' | 'SYNCING...'
}

export type Liquidation = { ts: number; side: string; posSide: string; qty_xau: number; bkPx: number }
export type TapePrint = { id: number; ts: number; px: number; qty_xau: number; side: 'buy' | 'sell' }
