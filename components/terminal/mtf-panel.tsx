'use client'

import { ArrowDownRight, ArrowUpRight, Layers3, LockKeyhole, Minus, Timer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Panel } from './panel'
import { BARS, formatPrice, type Bar, type Direction } from '@/lib/market-types'
import type { MarketState } from '@/hooks/use-market'
import { cn } from '@/lib/utils'

const tone = (direction: Direction) => direction === 'LONG' ? 'text-positive' : direction === 'SHORT' ? 'text-negative' : 'text-muted-foreground'

export function MtfPanel({ market: m, onSelect }: { market: MarketState; onSelect: (bar: Bar) => void }) {
  const { analyses, alignment } = m.mtfState
  const rows = BARS.map(bar => ({ bar, analysis: analyses[bar] })).filter(row => row.analysis)
  return <Panel title="Multi-timeframe signal matrix" icon={<Layers3 className="size-3.5" />} className="mtf-panel" action={<div className="flex items-center gap-2 text-[9px] font-normal normal-case tracking-normal"><span className={cn('flex items-center gap-1', tone(alignment.direction))}><LockKeyhole className="size-2.5" />{alignment.agreement}% ALIGNED {alignment.direction}</span><Badge variant="outline" className="h-4 rounded border-border px-1 font-mono text-[8px] text-muted-foreground">{alignment.lockedBars.length}/{BARS.length} LOCKED</Badge></div>}>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2.5 font-mono text-[10px]"><span className="text-muted-foreground">Long <span className="text-positive">{alignment.longVotes}</span> · Short <span className="text-negative">{alignment.shortVotes}</span> · Neutral <span className="text-muted-foreground">{alignment.neutralVotes}</span></span><span className="ml-auto text-muted-foreground">Select a timeframe to switch the terminal</span></div>
    <div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-xs"><thead><tr className="border-b border-border text-[9px] text-muted-foreground">{['TF', 'Direction', 'Signal lock', 'Ideal entry', 'Stop loss', 'Target 1', 'Target 2', 'Agreement'].map(h => <th key={h} className="px-3 py-3 font-normal whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{rows.map(({ bar, analysis }) => {
      const setup = analysis.setup
      const direction = setup?.direction ?? analysis.candidate
      const active = m.bar === bar
      const state = !setup ? analysis.error ? 'WAIT' : analysis.confirmations > 0 ? `${analysis.confirmations}/3 BUILDING` : 'NO SETUP' : 'LOCKED'
      return <tr key={bar} onClick={() => onSelect(bar)} className={cn('cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40', active && 'bg-primary/6')}>
        <td className="px-3 py-3"><span className={cn('inline-flex items-center gap-1.5 font-mono text-[11px] font-medium', active ? 'text-primary' : 'text-foreground')}>{bar}{active && <span className="size-1 rounded-full bg-primary" />}</span></td>
        <td className={cn('px-3 py-3 font-mono text-[11px]', tone(direction))}><span className="inline-flex items-center gap-1">{direction === 'LONG' ? <ArrowUpRight className="size-3" /> : direction === 'SHORT' ? <ArrowDownRight className="size-3" /> : <Minus className="size-3" />}{direction}</span></td>
        <td className="px-3 py-3"><span className={cn('inline-flex items-center gap-1 text-[10px]', setup ? 'text-primary' : 'text-muted-foreground')}>{setup ? <LockKeyhole className="size-2.5" /> : <Timer className="size-2.5" />}{state}</span></td>
        <td className="px-3 py-3 font-mono text-[11px] text-primary">{formatPrice(setup?.entry, 1)}</td>
        <td className="px-3 py-3 font-mono text-[11px] text-negative">{formatPrice(setup?.stop, 1)}</td>
        <td className="px-3 py-3 font-mono text-[11px] text-positive">{formatPrice(setup?.target1, 1)}</td>
        <td className="px-3 py-3 font-mono text-[11px] text-positive">{formatPrice(setup?.target2, 1)}</td>
        <td className="px-3 py-3"><span className="inline-flex items-center gap-2"><span className="font-mono text-[11px]">{setup?.strength ?? (analysis.indicators ? Math.abs(analysis.indicators.score) : '—')}%</span><span className="hidden h-1 w-12 overflow-hidden rounded-sm bg-muted sm:block"><span className={cn('block h-full', direction === 'LONG' ? 'bg-positive' : direction === 'SHORT' ? 'bg-negative' : 'bg-muted-foreground')} style={{ width: `${setup?.strength ?? (analysis.indicators ? Math.abs(analysis.indicators.score) : 0)}%` }} /></span></span></td>
      </tr>
    })}{!rows.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading multi-timeframe candles from OKX…</td></tr>}</tbody></table></div>
    <p className="border-t border-border px-4 py-3 text-[10px] leading-relaxed text-muted-foreground">Each row is computed independently from that timeframe&apos;s own closed candles. A locked row means the confirmation rules were met and the levels are immutable until the setup resolves. Alignment counts directional votes across all eight timeframes. It is agreement, not a probability of profit.</p>
  </Panel>
}
