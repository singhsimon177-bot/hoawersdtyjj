export const INSTRUMENT = 'XAU-USDT-SWAP'
export const SOURCE = 'OKX'
export const BARS = ['1m', '3m', '5m', '15m', '30m', '1H', '2H', '4H'] as const
export type Bar = typeof BARS[number]
export const BAR_MS: Record<Bar, number> = { '1m': 60_000, '3m': 180_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000, '1H': 3_600_000, '2H': 7_200_000, '4H': 14_400_000 }
export const DEFAULT_BAR: Bar = '15m'
export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number; confirmed: boolean }
export type Ticker = { instId: string; last: string; bidPx: string; askPx: string; open24h: string; high24h: string; low24h: string; volCcy24h: string; ts: string }
export type Book = { asks: string[][]; bids: string[][]; ts: string; seqId?: number }
export type Instrument = { instId: string; state: string; tickSz: string; ctVal: string; ctValCcy: string; lotSz: string; instType: string }
export type Snapshot = { ticker: Ticker | null; book: Book | null; mark: { markPx: string; ts: string } | null; funding: { fundingRate: string; fundingTime: string; ts: string } | null; interest: { oiUsd: string; ts: string } | null; receivedAt: number; latency: number; errors: string[] }
export type CandleResponse = { candles: Candle[]; bar: Bar; receivedAt: number }
export type MtfCandles = { bars: Partial<Record<Bar, Candle[]>>; receivedAt: number; errors: Partial<Record<Bar, string>> }
export type Direction = 'LONG' | 'SHORT' | 'NEUTRAL'
export type Factor = { name: string; detail: string; value: number; direction: Direction }
export type Indicators = { ema21: number; ema50: number; rsi: number; atr: number; vwap: number; macd: number; score: number; factors: Factor[] }
// A signal lock is immutable: once confirmed on a closed candle its entry, stop and targets never move.
export type LockState = 'LOCKED' | 'INVALIDATED' | 'TARGET REACHED' | 'EXPIRED'
export type Setup = { id: string; bar: Bar; direction: 'LONG' | 'SHORT'; time: number; lockedAt: number; expires: number; entry: number; stop: number; target1: number; target2: number; zoneLow: number; zoneHigh: number; strength: number; immutable: true }
export type SignalEvent = { time: number; type: 'CONFIRMED' | 'INVALIDATED' | 'EXPIRED' | 'TARGET REACHED'; direction: Direction; entry: number; bar: Bar }
export type Analysis = { bar: Bar; indicators: Indicators | null; setup: Setup | null; confirmations: number; candidate: Direction; lastClose: number | null; history: SignalEvent[]; error: string | null }
export type MtfAlignment = { direction: Direction; longVotes: number; shortVotes: number; neutralVotes: number; agreement: number; lockedBars: Bar[] }
export type MtfState = { analyses: Record<Bar, Analysis>; alignment: MtfAlignment }
export type SourceResult = { name: string; symbol: string; available: boolean; latency: number | null; status: string; samples: number[] }
export const formatPrice = (value: number | string | null | undefined, decimals = 2) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
export const compact = (value: number | string | null | undefined) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(Number(value))
