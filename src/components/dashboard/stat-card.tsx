'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { fmtUSD, pnlClass } from '@/lib/format'
import { cn } from '@/lib/cn'

interface Props {
  label:         string
  value:         string
  sub?:          string
  icon:          React.ComponentType<{ className?: string }>
  tone?:         'accent' | 'success' | 'danger' | 'warn' | 'info'
  delta?:        number
  deltaLabel?:   string
  progressPct?:  number
  progressTone?: 'success' | 'danger' | 'warn' | 'accent' | 'info'
}

const TONES: Record<NonNullable<Props['tone']>, { bg: string; text: string }> = {
  accent:  { bg: 'bg-accent-muted',  text: 'text-accent' },
  success: { bg: 'bg-success-muted', text: 'text-success' },
  danger:  { bg: 'bg-danger-muted',  text: 'text-danger' },
  warn:    { bg: 'bg-warn-muted',    text: 'text-warn' },
  info:    { bg: 'bg-info-muted',    text: 'text-info' },
}

export function StatCard({
  label, value, sub, icon: Icon, tone = 'accent',
  delta, deltaLabel, progressPct, progressTone,
}: Props) {
  const t = TONES[tone]
  return (
    <Card className="p-4 sm:p-5 relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className="text-2xs uppercase tracking-wider text-text-muted font-medium">{label}</div>
        <div className={cn('h-8 w-8 rounded-md flex items-center justify-center shrink-0', t.bg, t.text)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-bold tracking-tight tabular truncate">{value}</div>
      {sub && <div className="text-2xs text-text-muted mt-0.5 tabular">{sub}</div>}

      {delta !== undefined && (
        <div className={cn('mt-2 text-xs tabular flex items-center gap-1', pnlClass(delta))}>
          <span className="font-medium">{fmtUSD(delta, { sign: true })}</span>
          {deltaLabel && <span className="text-text-muted">· {deltaLabel}</span>}
        </div>
      )}

      {progressPct !== undefined && (
        <div className="mt-3">
          <Progress
            value={Math.max(0, Math.min(100, progressPct))}
            tone={progressTone ?? (tone === 'success' || tone === 'danger' || tone === 'warn' || tone === 'accent' || tone === 'info' ? tone : 'accent')}
          />
        </div>
      )}
    </Card>
  )
}
