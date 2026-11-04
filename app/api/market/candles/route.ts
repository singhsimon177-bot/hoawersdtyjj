import { getCandles } from '@/lib/okx'
import { BARS, type Bar } from '@/lib/market-types'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const bar = new URL(request.url).searchParams.get('bar') || '15m'
  if (!BARS.includes(bar as Bar)) return Response.json({ error: 'Unsupported candle interval' }, { status: 400 })
  try {
    const candles = await getCandles(bar as Bar, 300)
    return Response.json({ candles, bar, receivedAt: Date.now() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Candle feed unavailable' }, { status: 503 }) }
}
