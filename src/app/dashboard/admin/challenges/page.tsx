'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { api } from '@/lib/api'
import { useVisibilityPoll } from '@/hooks/use-visibility-poll'
import { fmtUSD, fmtDate, toNum, statusLabel, statusTone, pnlClass } from '@/lib/format'
import type { ChallengeAccount } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { PayoutReviewQueue } from '@/components/admin/payout-review-queue'

interface PendingPayout {
  id:           number
  challenge_id: number
  user_id:      number
  user_login:   string
  amount:       number | string
  trader_amount: number | string
  firm_amount:  number | string
  method:       string
  address:      string
  status:       string
  requested_at: string
}

interface AdminChallengesResp {
  challenges:      ChallengeAccount[]
  pending_payouts: PendingPayout[]
}

export default function AdminChallengesPage() {
  const [data, setData] = useState<AdminChallengesResp | null>(null)
  const [tab, setTab]   = useState<'all' | 'payouts'>('payouts')

  const refresh = useCallback(async () => {
    const res = await api.admin.challenges()
    if (res.ok) setData(res.data as AdminChallengesResp)
  }, [])
  useVisibilityPoll(refresh, 10_000, true)

  const challenges = data?.challenges ?? null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Challenge management</h1>
        <p className="text-sm text-text-muted mt-1">Review payout requests, monitor active evaluations, audit funded accounts.</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 rounded-md bg-surface-muted/60 text-2xs w-fit">
        {(['payouts', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'h-7 px-4 rounded transition-colors font-medium',
              tab === t ? 'bg-bg-subtle text-text shadow-card' : 'text-text-muted hover:text-text',
            )}
          >
            {t === 'payouts'
              ? 'Payouts'
              : `All challenges${challenges ? ` (${challenges.length})` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'payouts' ? (
        <PayoutReviewQueue />
      ) : (
        <ChallengesList challenges={challenges} />
      )}
    </div>
  )
}


function ChallengesList({ challenges }: { challenges: ChallengeAccount[] | null }) {
  if (challenges === null) return <Card className="p-6"><Skeleton className="h-48 w-full" /></Card>
  if (challenges.length === 0) {
    return <Card><CardContent className="p-12 text-center text-sm text-text-muted">
      <Trophy className="h-8 w-8 mx-auto text-text-faint mb-3" />
      No challenges yet
    </CardContent></Card>
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-subtle/40">
              <Th>User</Th>
              <Th>Plan</Th>
              <Th align="center" hideOn="sm">Phase</Th>
              <Th align="right">P&L</Th>
              <Th>Status</Th>
              <Th hideOn="md">Started</Th>
            </tr>
          </thead>
          <tbody>
            {challenges.map((c, i) => {
              const profit = toNum(c.current_balance) - toNum(c.starting_balance)
              return (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18, delay: Math.min(i * 0.01, 0.2) }}
                  className="border-b border-border-subtle/40 last:border-0 hover:bg-surface-muted/30"
                >
                  <Td>
                    <div className="font-medium truncate">{(c as ChallengeAccount & { user_login?: string }).user_login || `User #${c.user_id}`}</div>
                  </Td>
                  <Td>
                    <div className="text-text font-medium">{c.plan_name || `Plan #${c.plan_id}`}</div>
                    <div className="text-2xs text-text-muted tabular">{fmtUSD(c.account_size ?? 0, { decimals: 0 })}</div>
                  </Td>
                  <Td align="center" hideOn="sm"><span className="tabular">{c.phase}</span></Td>
                  <Td align="right"><span className={cn('tabular font-medium', pnlClass(profit))}>{fmtUSD(profit, { sign: true })}</span></Td>
                  <Td><Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge></Td>
                  <Td hideOn="md"><span className="text-2xs text-text-muted">{fmtDate(c.created_at)}</span></Td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Utility cells ─────────────────────────────────────────────────────

function Th({ children, align, hideOn }: { children: React.ReactNode; align?: 'right' | 'center'; hideOn?: 'sm' | 'md' | 'lg' }) {
  return (
    <th className={cn(
      'px-3 py-2.5 text-2xs uppercase tracking-wider text-text-faint font-medium',
      align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
      hideOn === 'sm' && 'hidden sm:table-cell',
      hideOn === 'md' && 'hidden md:table-cell',
      hideOn === 'lg' && 'hidden lg:table-cell',
    )}>{children}</th>
  )
}
function Td({ children, align, hideOn }: { children: React.ReactNode; align?: 'right' | 'center'; hideOn?: 'sm' | 'md' | 'lg' }) {
  return (
    <td className={cn(
      'px-3 py-3',
      align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
      hideOn === 'sm' && 'hidden sm:table-cell',
      hideOn === 'md' && 'hidden md:table-cell',
      hideOn === 'lg' && 'hidden lg:table-cell',
    )}>{children}</td>
  )
}
