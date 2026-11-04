import { getCandles } from '@/lib/okx'
import { BARS, type Bar, type Candle, type MtfCandles } from '@/lib/market-types'
export const dynamic = 'force-dynamic'

// One real OKX request per timeframe, fetched concurrently and independently so a
// single failing interval degrades only that interval instead of the whole matrix.
export async function GET() {
  const results = await Promise.allSettled(BARS.map(bar => getCandles(bar as Bar, 300)))
  const bars: Partial<Record<Bar, Candle[]>> = {}
  const errors: Partial<Record<Bar, string>> = {}
  results.forEach((result, index) => {
    const bar = BARS[index]
    if (result.status === 'fulfilled') bars[bar] = result.value
    else errors[bar] = result.reason instanceof Error ? result.reason.message : 'Candle feed unavailable'
  })
  const body: MtfCandles = { bars, receivedAt: Date.now(), errors }
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
