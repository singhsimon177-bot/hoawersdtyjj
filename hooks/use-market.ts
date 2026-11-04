'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { analyze, analyzeMtf, alignment } from '@/lib/signal-engine'
import { BAR_MS, BARS, INSTRUMENT, type Bar, type Book, type Candle, type MtfCandles, type MtfState, type Snapshot, type Ticker } from '@/lib/market-types'

export async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `Data request failed (${response.status})`)
  return data as T
}

const EMPTY_ANALYSES = Object.fromEntries(BARS.map(bar => [bar, analyze([], bar, 0, 0)])) as MtfState['analyses']
const EMPTY_MTF: MtfState = { analyses: EMPTY_ANALYSES, alignment: alignment(EMPTY_ANALYSES) }

export function useMarket(bar: Bar) {
  const { mutate } = useSWRConfig()
  const [now, setNow] = useState(0)
  const [stream, setStream] = useState<{ ticker?: Ticker; book?: Book }>({})
  const [connected, setConnected] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const market = useSWR<Snapshot>('/api/market', fetcher, { refreshInterval: 3000, dedupingInterval: 1500, errorRetryInterval: 5000 })
  const instrument = useSWR<import('@/lib/market-types').Instrument>('/api/market/instrument', fetcher, { refreshInterval: 300_000, dedupingInterval: 60_000 })
  const mtf = useSWR<MtfCandles>('/api/market/mtf', fetcher, { refreshInterval: 10_000, dedupingInterval: 3000 })
  const candleBuffer = useRef(new Map<Bar, Candle>())

  useEffect(() => { setNow(Date.now()); const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval) }, [])

  useEffect(() => {
    let stopped = false, socket: WebSocket | null = null, retry: ReturnType<typeof setTimeout> | undefined
    let buffer: { ticker?: Ticker; book?: Book } = {}, lastMessage = Date.now(), failures = 0
    const connect = () => {
      if (stopped) return
      socket = new WebSocket('wss://ws.okx.com:8443/ws/v5/public')
      socket.onopen = () => { failures = 0; lastMessage = Date.now(); socket?.send(JSON.stringify({ op: 'subscribe', args: ['tickers', 'books5'].map(channel => ({ channel, instId: INSTRUMENT })) })) }
      socket.onmessage = event => {
        lastMessage = Date.now()
        if (event.data === 'pong') return
        try {
          const message = JSON.parse(event.data)
          if (message.arg?.instId !== INSTRUMENT || !message.data?.length) return
          const value = message.data[0]
          if (message.arg.channel === 'tickers' && Number(value.last) > 0 && Number(value.ts) > 0) buffer.ticker = value
          if (message.arg.channel === 'books5' && value.asks?.length && value.bids?.length && Number(value.ts) > 0) buffer.book = value
          setConnected(true)
        } catch { /* Invalid exchange messages must not enter the feed. */ }
      }
      socket.onerror = () => socket?.close()
      socket.onclose = () => { setConnected(false); if (!stopped) retry = setTimeout(connect, Math.min(30_000, 2000 * 2 ** failures++)) }
    }
    connect()
    const flush = setInterval(() => { if (buffer.ticker || buffer.book) { const next = buffer; buffer = {}; setStream(previous => ({ ...previous, ...next })) } }, 200)
    const heartbeat = setInterval(() => {
      if (Date.now() - lastMessage > 30_000) socket?.close()
      else if (socket?.readyState === WebSocket.OPEN) socket.send('ping')
    }, 15_000)
    return () => { stopped = true; clearTimeout(retry); clearInterval(flush); clearInterval(heartbeat); socket?.close() }
  }, [retryKey])

  // Live candle stream covers every timeframe so the whole MTF matrix updates in real time.
  useEffect(() => {
    let stopped = false, socket: WebSocket | null = null, retry: ReturnType<typeof setTimeout> | undefined
    let lastMessage = Date.now()
    const connect = () => {
      if (stopped) return
      socket = new WebSocket('wss://ws.okx.com:8443/ws/v5/business')
      socket.onopen = () => { lastMessage = Date.now(); socket?.send(JSON.stringify({ op: 'subscribe', args: BARS.map(tf => ({ channel: `candle${tf}`, instId: INSTRUMENT })) })) }
      socket.onmessage = event => {
        lastMessage = Date.now()
        if (event.data === 'pong') return
        try {
          const message = JSON.parse(event.data)
          if (message.arg?.instId !== INSTRUMENT || !message.data?.length) return
          const tf = message.arg.channel?.replace('candle', '') as Bar
          if (!BARS.includes(tf)) return
          for (const row of message.data) {
            const [time, open, high, low, close, , volume] = row.map(Number)
            if (![time, open, high, low, close, volume].every(Number.isFinite) || low <= 0 || volume < 0 || high < Math.max(open, close) || low > Math.min(open, close)) continue
            candleBuffer.current.set(tf, { time, open, high, low, close, volume, confirmed: row[8] === '1' })
          }
        } catch { /* Malformed updates are discarded; REST remains the recovery source. */ }
      }
      socket.onerror = () => socket?.close()
      socket.onclose = () => { if (!stopped) retry = setTimeout(connect, 5000) }
    }
    connect()
    const flush = setInterval(() => {
      if (!candleBuffer.current.size) return
      void mutate<MtfCandles>('/api/market/mtf', previous => {
        if (!previous) return previous
        const bars = { ...previous.bars }
        for (const [tf, candle] of candleBuffer.current) {
          const current = bars[tf]
          if (!current?.length) continue
          if (candle.time < current.at(-1)!.time - BAR_MS[tf]) continue
          const map = new Map(current.map(c => [c.time, c]))
          if (map.get(candle.time)?.confirmed && !candle.confirmed) continue
          map.set(candle.time, candle)
          bars[tf] = [...map.values()].sort((a, b) => a.time - b.time).slice(-300)
        }
        return { ...previous, bars, receivedAt: Date.now() }
      }, { revalidate: false })
      candleBuffer.current.clear()
    }, 500)
    const heartbeat = setInterval(() => { if (Date.now() - lastMessage > 30_000) socket?.close(); else if (socket?.readyState === WebSocket.OPEN) socket.send('ping') }, 15_000)
    return () => { stopped = true; clearTimeout(retry); clearInterval(flush); clearInterval(heartbeat); candleBuffer.current.clear(); socket?.close() }
  }, [mutate, retryKey])

  const restTicker = market.data?.ticker, restBook = market.data?.book
  const ticker = Number(stream.ticker?.ts || 0) > Number(restTicker?.ts || 0) ? stream.ticker : restTicker
  const book = Number(stream.book?.ts || 0) > Number(restBook?.ts || 0) ? stream.book : restBook
  const quoteAge = now && ticker ? Math.max(0, now - Number(ticker.ts)) : null
  const bookAge = now && book ? Math.max(0, now - Number(book.ts)) : null
  const verified = instrument.data?.instId === INSTRUMENT && instrument.data.state === 'live'
  const fresh = !!verified && quoteAge !== null && quoteAge < 10_000 && bookAge !== null && bookAge < 10_000 && Number(ticker?.last) > 0 && Number(book?.asks[0]?.[0]) >= Number(book?.bids[0]?.[0]) && Number(book?.bids[0]?.[0]) > 0
  const tick = Number(instrument.data?.tickSz)
  const mtfCandles = mtf.data?.bars
  const mtfState = useMemo(() => mtfCandles && now ? analyzeMtf(mtfCandles, tick, now) : EMPTY_MTF, [mtfCandles, tick, now])
  const analysis = mtfState.analyses[bar] || EMPTY_ANALYSES[bar]
  const candles = mtfCandles?.[bar] || []
  const candlesStale = !mtf.data || !now || now - mtf.data.receivedAt > 30_000 || !analysis?.lastClose || now - analysis.lastClose > BAR_MS[bar] + 20_000
  const setup = analysis?.setup ?? null
  const current = candles.at(-1)
  const invalidated = !!setup && ((ticker && (setup.direction === 'LONG' ? Number(ticker.last) <= setup.stop : Number(ticker.last) >= setup.stop)) || (current && current.time >= setup.time && (setup.direction === 'LONG' ? current.low <= setup.stop : current.high >= setup.stop)))
  const targetTouched = !!setup && !!current && current.time >= setup.time && (setup.direction === 'LONG' ? current.high >= setup.target2 : current.low <= setup.target2)
  const expired = !!setup && now >= setup.expires
  const spread = book ? Number(book.asks[0]?.[0]) - Number(book.bids[0]?.[0]) : null
  const spreadSafe = spread !== null && spread >= 0 && !!analysis?.indicators && spread <= analysis.indicators.atr * 0.05
  const actionable = fresh && !candlesStale && !analysis?.error && !invalidated && !expired && !targetTouched && spreadSafe
  const refresh = () => { void market.mutate(); void instrument.mutate(); void mtf.mutate(); setRetryKey(k => k + 1) }
  return { now, bar, ticker, book, snapshot: market.data, instrument: instrument.data, candles, mtfState, alignment: mtfState.alignment, analysis, quoteAge, bookAge, connected, fresh, verified, candlesStale, invalidated, targetTouched, expired, spread, spreadSafe, actionable, refresh, loading: market.isLoading, error: market.error?.message || instrument.error?.message || mtf.error?.message, chartError: mtf.data?.errors[bar] }
}

export type MarketState = ReturnType<typeof useMarket>
