'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { fmtUSD, fmtPct, toNum, pnlClass } from '@/lib/format'
import type { Account } from '@/types/api'
import { cn } from '@/lib/cn'

interface Props {
  account: Account | null
  /** Sum of open-position PnL — passed in so the parent owns the data flow. */
  openPnL?: number
  compact?: boolean
}

export const AccountStrip = memo(function AccountStrip({ account, openPnL, compact }: Props) {
  if (!account) {
    return (
      compact
        ? <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skel h-12 rounded-md shrink-0 w-28" />)}</div>
        : <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel h-12 rounded-md" />)}</div>
    )
  }

  const balance = toNum(account.balance)
  const equity  = toNum(account.equity)
  const used    = toNum(account.margin_used)
  const free    = equity - used
  const level   = used > 0 ? (equity / used) * 100 : null
  const lev     = toNum(account.leverage) || 100
  const pnl     = openPnL ?? (equity - balance)

  const items = [
    { label: 'Balance',  value: fmtUSD(balance),               tone: 'default' as const },
    { label: 'Equity',   value: fmtUSD(equity),                tone: 'default' as const, emphasize: true },
    { label: 'P&L',      value: fmtUSD(pnl, { sign: true }),   tone: pnlClass(pnl) },
    { label: 'Free margin', value: fmtUSD(free),               tone: 'default' as const },
    { label: 'Margin level', value: level !== null ? fmtPct(level, 1) : '—',
        tone: level !== null && level < 100 ? 'text-danger' : level !== null && level < 200 ? 'text-warn' : 'default' as const },
    { label: 'Leverage', value: `1:${lev}`,                    tone: 'default' as const },
  ]
  const visible = compact ? items.slice(0, 4) : items

  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {visible.map((it, i) => (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.2) }}
            className={cn(
              'rounded-md px-2.5 py-2 border shrink-0 w-28',
              it.emphasize
                ? 'bg-accent-muted/60 border-accent/30'
                : 'bg-bg-subtle/60 border-border-subtle',
            )}
          >
            <div className="text-2xs uppercase tracking-wider text-text-muted truncate">{it.label}</div>
            <div className={cn('tabular font-semibold text-xs mt-0.5 truncate', it.tone === 'default' ? '' : it.tone)}>
              {it.value}
            </div>
          </motion.div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {visible.map((it, i) => (
        <motion.div
          key={it.label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.2) }}
          className={cn(
            'rounded-md px-2.5 py-2 sm:px-3 border min-w-0',
            it.emphasize
              ? 'bg-accent-muted/60 border-accent/30'
              : 'bg-bg-subtle/60 border-border-subtle',
          )}
        >
          <div className="text-2xs uppercase tracking-wider text-text-muted truncate">{it.label}</div>
          <div className={cn(
            'tabular font-semibold text-xs sm:text-sm mt-0.5 truncate',
            it.tone === 'default' ? '' : it.tone,
          )}>
            {it.value}
          </div>
        </motion.div>
      ))}
    </div>
  )
})
