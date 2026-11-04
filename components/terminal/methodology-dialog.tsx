'use client'

import { Layers, LockKeyhole, Radio, ShieldCheck, Waves } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const sections = [
  { icon: Waves, title: '01 · Solution A order flow', body: 'Mechanism 1 estimates every historical 1m bar with a 70% close-location / 30% body hybrid (tick rule on flat bars). Mechanism 4 overlays today’s tick-exact 1m flow from the okx_xau_flow_YYYY_MM_DD ring-buffer. Mechanism 3 replaces fully covered 1m bars with ~1,000 real taker prints from /market/trades + /market/history-trades. Mechanism 2 then rolls those 1m deltas into every 3m–4H bar of the last 25 hours, so absorption wicks keep their true net delta.' },
  { icon: Radio, title: '02 · Zero-polling dual WebSocket', body: 'K-lines stream on /ws/v5/business; BBO tick-by-tick, trades, liquidations, mark, index, funding and open interest stream on /ws/v5/public. Both open before REST hydration and buffer frames until Solution A completes. Trades are keyed by bar-open time on every timeframe, so prints that arrive before a new candle never leak into the wrong bar. Gaps heal with before=/after= cursors; a dead-man’s switch pings after 5s of silence and halts on a missed pong.' },
  { icon: Layers, title: '03 · 8-factor Signal Agreement', body: 'Each timeframe scores LONG and SHORT out of 100: 5-bar delta (20), EMA 9/20/50 stack (15), 00:00 UTC VWAP bands (15), taker aggression (15), RSI-14 (10), sweep / absorption / CVD divergence / room to PDH-PDL (10), open-interest regime (10) and BBO spread & imbalance (5). The card agreement is 65% intra-timeframe score plus 35% cross-timeframe alignment (aligned TFs ÷ 8).' },
  { icon: LockKeyhole, title: '04 · Immutable Scalp Signal Lock', body: 'When agreement clears the per-timeframe threshold with 5 of 8 timeframes aligned (or a strong intra score / sweep), entry is taken at the executable BBO and SL / TP1 / TP2 / TP3 are frozen from ATR-14. Live agreement keeps updating as drift, but the locked levels never change. TP1 moves the trail to breakeven, TP2 to TP1. A lock only resolves on TP3, a stop / trail breach at the executable BBO, or max-hold expiry, followed by a one-bar cooldown.' },
]

export function MethodologyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85svh] overflow-y-auto border border-border bg-card p-6 sm:max-w-2xl">
      <DialogHeader>
        <span className="eyebrow">TRANSPARENT BY DESIGN</span>
        <DialogTitle className="mt-2 text-2xl">Pure OKX order flow. Eight immutable locks.</DialogTitle>
        <DialogDescription className="mt-1 text-xs leading-relaxed">Every number on this terminal is computed in your browser from public OKX V5 data for XAU-USDT-SWAP. No API keys, no synthetic values, and no extra REST calls to refresh the Scalp Trade Cards.</DialogDescription>
      </DialogHeader>
      <Alert className="my-1 border-primary/25 bg-primary/5 p-3"><ShieldCheck className="text-primary" /><AlertTitle className="text-xs text-primary">Agreement is not probability</AlertTitle><AlertDescription className="mt-1 text-xs leading-relaxed">Signal Agreement measures how many rule-based factors line up. It is not a win rate, has not been independently validated, and does not place orders.</AlertDescription></Alert>
      <div className="flex flex-col gap-5 text-xs leading-relaxed text-muted-foreground">
        {sections.map(s => <section key={s.title}><h3 className="mb-2 flex items-center gap-2 font-medium text-foreground"><s.icon className="size-4 text-primary" />{s.title}</h3><p>{s.body}</p></section>)}
      </div>
    </DialogContent>
  </Dialog>
}
