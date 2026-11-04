import 'server-only'
import { BARS, INSTRUMENT, type Bar, type Candle, type Instrument } from './market-types'

export async function okx<T>(path: string): Promise<T[]> {
  const response = await fetch(`https://www.okx.com/api/v5/${path}`, { cache: 'no-store', signal: AbortSignal.timeout(7000), headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`OKX HTTP ${response.status}`)
  const payload = await response.json()
  if (payload.code !== '0' || !Array.isArray(payload.data) || payload.data.length === 0) throw new Error(payload.msg || 'No verified exchange data')
  return payload.data as T[]
}

export async function getInstrument() {
  const [instrument] = await okx<Instrument>(`public/instruments?instType=SWAP&instId=${INSTRUMENT}`)
  if (instrument.instId !== INSTRUMENT || instrument.state !== 'live' || instrument.ctValCcy !== 'XAU' || !(Number(instrument.tickSz) > 0)) throw new Error('Exact XAU-USDT perpetual instrument is unavailable')
  return instrument
}

// OKX candle rows: [ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm]
export async function getCandles(bar: Bar, limit = 300): Promise<Candle[]> {
  const raw = await okx<string[]>(`market/candles?instId=${INSTRUMENT}&bar=${bar}&limit=${limit}`)
  const unique = new Map<number, Candle>()
  for (const row of raw) {
    const [time, open, high, low, close, , volume] = row.map(Number)
    if (![time, open, high, low, close, volume].every(Number.isFinite) || low <= 0 || volume < 0 || high < Math.max(open, close) || low > Math.min(open, close)) throw new Error('Malformed exchange candle')
    unique.set(time, { time, open, high, low, close, volume, confirmed: row[8] === '1' })
  }
  return [...unique.values()].sort((a, b) => a.time - b.time)
}

export { BARS }
