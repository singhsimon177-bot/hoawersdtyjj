'use client'

import { Check, LockKeyhole, LockKeyholeOpen, Radar, Timer } from 'lucide-react'
import { SCALP_CARD_CONFIG, TF_LABEL } from '@/lib/xau/constants'
import { dirTone, elapsed, num, pct, px, SYNCING, tone, utcTime } from '@/lib/xau/format'
import type { ScalpCard as Card } from '@/lib/xau/types'
import { cn } from '@/lib/utils'

export function stateLabel(card: Card) {
  const d = card.locked_signal?.direction
  switch (card.lock_state) {
    case 'LOCKED_ACTIVE': return `LOCKED ${d}`
    case 'TP1_PARTIAL': return 'TP1 HIT • BE LOCKED'
    case 'TP2_PARTIAL': return 'TP2 HIT • TRAIL LOCKED'
    case 'EXPIRED_COOLDOWN': return 'COOLDOWN • 1 BAR'
    case 'SCANNING': return 'SCANNING'
    default: return SYNCING
  }
}

function StateBadge({ card }: { card: Card }) {
  const d = card.locked_signal?.direction
  const cls = card.is_locked
    ? d === 'LONG' ? 'border-positive/40 bg-positive/10 text-positive' : 'border-negative/40 bg-negative/10 text-negative'
    : card.lock_state === 'SCANNING' ? 'border-primary/30 bg-primary/8 text-primary' : 'border-border bg-muted/40 text-muted-foreground'
  return <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-wide whitespace-nowrap', cls)}>
    {card.is_locked ? <LockKeyhole className="size-2.5" aria-hidden="true" /> : card.lock_state === 'SCANNING' ? <Radar className="size-2.5" aria-hidden="true" /> : <Timer className="size-2.5" aria-hidden="true" />}
    {stateLabel(card)}
  </span>
}

function AgreementMeter({ card, large }: { card: Card; large?: boolean }) {
  const cfg = SCALP_CARD_CONFIG[card.tf]
  const sig = card.locked_signal
  const ready = card.lock_state !== 'SYNCING'
  const live = card.live_agreement_pct
  const fill = card.is_locked ? (sig?.direction === 'LONG' ? 'bg-positive' : 'bg-negative') : card.candidate_dir === 'LONG' ? 'bg-positive/80' : card.candidate_dir === 'SHORT' ? 'bg-negative/80' : 'bg-muted-foreground/50'
  return <div className="flex flex-col gap-1.5">
    <div className="flex items-end justify-between gap-2">
      {sig ? <div className="flex items-end gap-3">
        <div><div className="text-[8px] tracking-wider text-muted-foreground">LOCKED</div><div className={cn('font-mono font-semibold tabular-nums', large ? 'text-2xl' : 'text-base')}>{pct(sig.locked_agreement_pct)}</div></div>
        <div><div className="text-[8px] tracking-wider text-muted-foreground">LIVE</div><div className={cn('font-mono tabular-nums', large ? 'text-lg' : 'text-xs')}>{pct(live)} <span className={cn('text-[10px]', tone(card.agreement_drift_pct))}>{pct(card.agreement_drift_pct, 1, true)}</span></div></div>
      </div> : <div><div className="text-[8px] tracking-wider text-muted-foreground">SIGNAL AGREEMENT</div><div className={cn('font-mono font-semibold tabular-nums', large ? 'text-2xl' : 'text-base', dirTone(card.candidate_dir))}>{ready ? pct(live) : SYNCING}</div></div>}
      <div className="text-right text-[9px] text-muted-foreground"><div>Lock ≥ {cfg.min_agree_pct}%</div><div className={cn('font-mono', dirTone(sig?.direction ?? card.candidate_dir))}>{sig?.direction ?? (ready ? card.candidate_dir : '—')}</div></div>
    </div>
    <div className="relative h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ready ? live : 0} aria-label={`${TF_LABEL[card.tf]} live signal agreement`}>
      <div className={cn('h-full rounded-full transition-[width] duration-300', fill)} style={{ width: `${ready ? Math.min(100, live) : 0}%` }} />
      <span className="absolute top-0 h-full w-px bg-foreground/70" style={{ left: `${cfg.min_agree_pct}%` }} aria-hidden="true" />
    </div>
    <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
      <span>Intra-TF {ready ? `${(sig ? sig.locked_intra_pct : card.live_intra_pct).toFixed(1)}` : '—'}/100</span>
      <span>Cross-TF {ready ? `${sig ? sig.locked_aligned_tfs.length : card.aligned_tf_count}/8 = ${(sig ? sig.locked_mtf_pct : card.live_mtf_pct).toFixed(1)}%` : '—'}</span>
    </div>
  </div>
}

function Level({ label, value, tint, hit, muted }: { label: string; value: number | null | undefined; tint?: string; hit?: boolean; muted?: boolean }) {
  return <div className="flex items-center justify-between gap-2 py-1 text-[10px]">
    <span className="flex items-center gap-1 text-muted-foreground">{hit && <Check className="size-3 text-positive" aria-label="hit" />}{label}</span>
    <span className={cn('font-mono tabular-nums', tint, muted && 'opacity-60')}>{px(value)}</span>
  </div>
}

export function ScalpCardView({ card, nowMs, active, onSelect, large }: { card: Card; nowMs: number; active?: boolean; onSelect?: () => void; large?: boolean }) {
  const cfg = SCALP_CARD_CONFIG[card.tf]
  const sig = card.locked_signal
  const pv = card.preview
  const body = <>
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-6 min-w-8 items-center justify-center rounded border px-1.5 font-mono text-[11px] font-semibold', active ? 'border-primary/50 bg-primary/12 text-primary' : 'border-border text-foreground')}>{cfg.label}</span>
        <StateBadge card={card} />
      </div>
      {sig ? <span className="flex items-center gap-1 text-[9px] text-muted-foreground" title={sig.signal_id}><LockKeyhole className="size-3 text-primary" aria-hidden="true" /><span className="font-mono">{elapsed(nowMs - sig.locked_at_ms)}</span></span> : <LockKeyholeOpen className="size-3 text-muted-foreground" aria-label="Unlocked" />}
    </div>
    {sig && <div className="truncate font-mono text-[9px] text-primary/80" title={`Locked ${utcTime(sig.locked_at_ms)} UTC`}>{sig.signal_id} · {utcTime(sig.locked_at_ms)} UTC</div>}
    <AgreementMeter card={card} large={large} />
    <div className="border-t border-border pt-1.5">
      {sig ? <>
        <Level label="Entry (frozen)" value={sig.entry_price} tint="text-primary" />
        <Level label="Initial SL" value={sig.initial_sl} tint="text-negative" />
        <Level label="Dynamic trail SL" value={card.dynamic_trail_sl} tint="text-negative/80" />
        <Level label={`TP1 (${cfg.tp1_r.toFixed(1)}R)`} value={sig.tp1_price} tint="text-positive" hit={card.tp1_hit} />
        <Level label={`TP2 (${cfg.tp2_r.toFixed(1)}R)`} value={sig.tp2_price} tint="text-positive" hit={card.tp2_hit} />
        <Level label={`TP3 (${cfg.tp3_r.toFixed(1)}R)`} value={sig.tp3_price} tint="text-positive" />
      </> : <>
        <div className="py-1 text-[8px] tracking-wider text-muted-foreground">PREVIEW · NOT LOCKED</div>
        <Level label="Entry" value={pv?.entry} muted />
        <Level label="Stop" value={pv?.sl} muted />
        <Level label={`TP1 (${cfg.tp1_r.toFixed(1)}R)`} value={pv?.tp1} muted />
        <Level label={`TP2 (${cfg.tp2_r.toFixed(1)}R)`} value={pv?.tp2} muted />
        <Level label={`TP3 (${cfg.tp3_r.toFixed(1)}R)`} value={pv?.tp3} muted />
      </>}
    </div>
    <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-2 font-mono text-[10px]">
      <div><div className="font-sans text-[8px] text-muted-foreground">PNL $/XAU</div><div className={tone(sig ? card.unrealized_pnl_xau : null)}>{sig ? num(card.unrealized_pnl_xau, 2, true) : '—'}</div></div>
      <div><div className="font-sans text-[8px] text-muted-foreground">R-MULTIPLE</div><div className={tone(sig ? card.unrealized_r : null)}>{sig ? `${num(card.unrealized_r, 2, true)}R` : '—'}</div></div>
      <div className="text-right"><div className="font-sans text-[8px] text-muted-foreground">HOLD</div><div>{sig ? `${card.bars_elapsed}/${cfg.max_hold_bars}` : `—/${cfg.max_hold_bars}`}</div></div>
    </div>
    {card.last_resolved && !sig && <div className="rounded border border-border bg-muted/30 px-2 py-1 font-mono text-[9px] text-muted-foreground">
      Last: <span className={card.last_resolved.outcome === 'RESOLVED_WIN' ? 'text-positive' : card.last_resolved.outcome === 'RESOLVED_LOSS' ? 'text-negative' : ''}>{card.last_resolved.outcome.replace('RESOLVED_', '')}</span> {card.last_resolved.reason.replaceAll('_', ' ').toLowerCase()} · {num(card.last_resolved.r_multiple, 2, true)}R
    </div>}
  </>
  const className = cn('flex flex-col gap-2.5 rounded-md border bg-card p-3 text-left transition-colors', active ? 'border-primary/50' : 'border-border hover:border-primary/30', sig?.direction === 'LONG' && 'shadow-[inset_2px_0_0_var(--positive)]', sig?.direction === 'SHORT' && 'shadow-[inset_2px_0_0_var(--negative)]')
  if (!onSelect) return <div className={className}>{body}</div>
  return <button type="button" onClick={onSelect} aria-pressed={active} aria-label={`Focus ${cfg.label} scalp trade card`} className={className}>{body}</button>
}
