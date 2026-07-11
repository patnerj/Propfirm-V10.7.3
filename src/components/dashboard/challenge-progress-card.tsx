'use client'

import type { ChallengeMetrics } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { fmtUSD, fmtPct, statusLabel, statusTone, toNum } from '@/lib/format'
import { Target, ShieldAlert, Calendar, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface Props { metrics: ChallengeMetrics }

export function ChallengeProgressCard({ metrics: m }: Props) {
  const phase  = m.phase
  const isFunded = m.status === 'funded'
  const planSize = toNum(m.plan?.account_size ?? m.challenge.account_size ?? 0)

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-2xs uppercase tracking-wider text-text-muted">Active challenge</div>
            <CardTitle className="mt-1 text-base truncate">
              {m.plan?.name ?? `Challenge #${m.challenge.id}`}
            </CardTitle>
            <div className="text-2xs text-text-muted mt-0.5 tabular">{fmtUSD(planSize, { decimals: 0 })} · Phase {phase}</div>
          </div>
          <Badge tone={statusTone(m.status)}>{statusLabel(m.status)}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {m.breach_reason && (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-danger-muted border border-danger/30 text-2xs">
            <AlertCircle className="h-3.5 w-3.5 text-danger shrink-0 mt-0.5" />
            <span className="text-danger">{m.breach_reason}</span>
          </div>
        )}

        {/* Profit target */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs">
              <Target className="h-3.5 w-3.5 text-success" />
              <span className="text-text-muted">Profit target</span>
            </div>
            <div className="text-2xs text-text-muted tabular">
              <span className="text-success font-medium">{fmtPct(m.current_profit_pct, 2, true)}</span>
              {' '}/ {fmtPct(m.profit_target_pct)}
            </div>
          </div>
          <Progress value={Math.max(0, Math.min(100, m.profit_progress))} tone="success" />
          <div className="text-2xs text-text-muted mt-1 tabular">
            {fmtUSD(m.current_profit, { sign: true })} of {fmtUSD(m.profit_target_val)}
          </div>
        </div>

        {/* Daily DD */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs">
              <ShieldAlert className="h-3.5 w-3.5 text-warn" />
              <span className="text-text-muted">Daily drawdown</span>
            </div>
            <div className="text-2xs text-text-muted tabular">
              <span className="font-medium text-text">{fmtPct(m.daily_dd_used_pct, 2)}</span>
              {' '}/ {fmtPct(m.daily_dd_pct)}
            </div>
          </div>
          <Progress
            value={Math.max(0, Math.min(100, m.daily_dd_progress))}
            tone={m.daily_dd_progress > 70 ? 'danger' : 'warn'}
          />
        </div>

        {/* Max DD */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs">
              <ShieldAlert className="h-3.5 w-3.5 text-danger" />
              <span className="text-text-muted">Max drawdown</span>
            </div>
            <div className="text-2xs text-text-muted tabular">
              <span className="font-medium text-text">{fmtPct(m.current_dd_pct, 2)}</span>
              {' '}/ {fmtPct(m.max_dd_pct)}
            </div>
          </div>
          <Progress
            value={Math.max(0, Math.min(100, m.max_dd_progress))}
            tone={m.max_dd_progress > 70 ? 'danger' : 'warn'}
          />
          <div className="text-2xs text-text-muted mt-1 tabular">
            {fmtUSD(m.dd_remaining)} remaining before breach
          </div>
        </div>

        {/* Trading days */}
        {!isFunded && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5 text-info" />
                <span className="text-text-muted">Trading days</span>
              </div>
              <div className="text-2xs text-text-muted tabular">
                <span className="font-medium text-text">{m.trading_days_done}</span>
                {' '}/ {m.min_trading_days} min
              </div>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, m.days_progress))}
              tone="info"
            />
            {m.days_remaining > 0 && (
              <div className="text-2xs text-text-muted mt-1">
                {m.days_remaining} day{m.days_remaining === 1 ? '' : 's'} remaining
              </div>
            )}
          </div>
        )}

        {isFunded && (
          <Button asChild variant="success" size="sm" className="w-full mt-2">
            <Link href="/dashboard/payouts">Request payout →</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
