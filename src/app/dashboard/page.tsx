'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { useVisibilityPoll } from '@/hooks/use-visibility-poll'
import { AccountSwitcher } from '@/components/dashboard/trading/account-switcher'
import { fmtUSD, fmtPct, toNum, pnlClass, statusLabel, statusTone, timeAgo } from '@/lib/format'
import type {
  Account, ChallengeAccount, ChallengeMetrics, Trade, HistoryResp,
  NoChallengeResp, KycInfo,
} from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChallengeProgressCard } from '@/components/dashboard/challenge-progress-card'
import { EquityChart } from '@/components/dashboard/equity-chart'
import { StatCard } from '@/components/dashboard/stat-card'
import { KycStatusCard } from '@/components/dashboard/kyc-status-card'
import {
  TrendingUp, Wallet, Target, ShieldAlert,
  ArrowRight, Trophy, Calendar, MailWarning,
} from 'lucide-react'

function isAccount(x: Account | NoChallengeResp): x is Account {
  return (x as Account).balance !== undefined && !(x as NoChallengeResp).no_challenge
}

export default function DashboardOverview() {
  const user = useAuth((s) => s.user)
  const router = useRouter()

  // Admins belong on the admin overview, not the trader dashboard.
  useEffect(() => {
    if (user?.is_admin) router.replace('/dashboard/admin')
  }, [user?.is_admin, router])
  const [account,    setAccount]    = useState<Account | NoChallengeResp | null>(null)
  const [challenges, setChallenges] = useState<ChallengeAccount[] | null>(null)
  const [metrics,    setMetrics]    = useState<ChallengeMetrics | null>(null)
  const [recent,     setRecent]     = useState<Trade[] | null>(null)
  const [kyc,        setKyc]        = useState<KycInfo | null>(null)
  const [ready,      setReady]      = useState(false)
  // V10.7.5: did the LAST load actually succeed? The empty state must only be
  // shown on a genuine 'no challenge' answer, never because a fetch failed.
  const [loadOk,     setLoadOk]     = useState(false)

  const refreshAll = async () => {
    try {
      const [acc, ch, hist, kycRes] = await Promise.all([
        api.account(),
        api.challengeMy(),
        api.history(),
        api.kycGet(),
      ])
      if (kycRes.ok) setKyc(kycRes.data)
      // V10.7.5 BUG 4 fix: previously this did `setAccount(acc.ok ? acc.data : null)`
      // and `setChallenges([])` on failure. Because `ready` is already true after
      // the first load, ANY transient failure on a later poll (network blip, a 401
      // while the access token is mid-refresh) nulled the state and the dashboard
      // rendered the "no challenge → browse/purchase" empty state — then the next
      // 12s poll restored it. That is the 3–5s flash. Now a failed refresh LEAVES
      // the last-known-good data in place; only a SUCCESSFUL response can change it
      // (including a successful `no_challenge` response, which is a real empty state).
      if (acc.ok) { setAccount(acc.data); setLoadOk(true) }
      if (ch.ok && Array.isArray(ch.data)) {
        setChallenges(ch.data)
        const active = ch.data.find((c) => c.status === 'active') || ch.data[0]
        if (active) {
          const m = await api.challengeMetrics(active.id)
          if (m.ok) setMetrics(m.data)
        } else {
          setMetrics(null)
        }
      }
      const trades = hist.ok ? (hist.data as HistoryResp)?.trades : undefined
      if (hist.ok) setRecent(Array.isArray(trades) ? trades.slice(0, 8) : [])
    } finally {
      setReady(true)
    }
  }

  // useVisibilityPoll runs `refreshAll` immediately on mount, then every 12s
  // while the tab is visible. No separate useEffect needed.
  useVisibilityPoll(refreshAll, 12_000, true)

  // Stripe success return → confirm + clean the URL (order completes via webhook).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('stripe') === 'success') {
      toast.success('Payment received — your challenge is being activated.')
      window.history.replaceState({}, '', '/dashboard')
      refreshAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const acc = account && isAccount(account) ? account : null
  // Only decide "no challenge" once the first load has settled, so we show a
  // professional empty state (never perpetual skeletons).
  const noChallenge = ready && loadOk && !acc && (challenges?.length ?? 0) === 0
  const active = challenges?.find((c) => c.status === 'active') || challenges?.[0] || null
  const phaseLabel = active
    ? (active.status === 'funded' ? 'Funded account'
      : active.status === 'passed' ? 'Evaluation passed'
      : active.status === 'failed' ? 'Challenge failed'
      : `Phase ${active.phase}`)
    : ''

  return (
    <div className="space-y-6">
      {/* Welcome row */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {user?.display_name?.split(' ')[0] || user?.username}
          </h1>
          <p className="text-sm text-text-muted mt-1">Here&apos;s a snapshot of your trading account.</p>
        </div>
        {!noChallenge && (
          <div className="flex items-center gap-2">
            {/* V10.7.5 BUG 2: switcher on the main dashboard too, so a trader can
                compare accounts without entering the trading terminal. Same
                endpoints, same self-hiding behavior for single-account users. */}
            <AccountSwitcher onSwitched={refreshAll} />
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/challenges">View all challenges <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        )}
      </motion.div>

      {/* Email-not-verified banner */}
      {user && !user.email_verified && (
        <Card className="border-warn/40 bg-warn-muted/30">
          <CardContent className="flex items-start gap-3 p-4">
            <MailWarning className="h-5 w-5 text-warn shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm">Verify your email to enable payouts</div>
              <div className="text-xs text-text-muted mt-0.5">
                We sent a verification link to <span className="text-text">{user.email}</span>.
                Didn&apos;t get it? <ResendVerifyButton />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KYC verification status — traders only (admins are exempt) */}
      {kyc && !user?.is_admin && <KycStatusCard kyc={kyc} />}

      {/* No challenge state */}
      {noChallenge ? (
        <NoChallengeCTA />
      ) : (
        <>
          {/* Challenge hero */}
          {acc && active && (
            <Card className="relative overflow-hidden border-border-strong">
              <div className="absolute inset-0 bg-aurora opacity-25 pointer-events-none" />
              <CardContent className="relative p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-2xs uppercase tracking-wider text-text-muted">{phaseLabel}</span>
                      <Badge tone={statusTone(active.status)}>{statusLabel(active.status)}</Badge>
                    </div>
                    <div className="mt-1 text-3xl font-bold tracking-tight tabular">{fmtUSD(acc.equity)}</div>
                    <div className="text-2xs text-text-muted mt-0.5">
                      Equity · balance {fmtUSD(acc.balance)} · {active.trading_days} trading {active.trading_days === 1 ? 'day' : 'days'}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/trading">Open terminal <ArrowRight className="h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
                {metrics && (
                  <div className="mt-5 grid sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between text-2xs mb-1">
                        <span className="text-text-muted">Profit target</span>
                        <span className="tabular font-medium text-success">{fmtPct(metrics.current_profit_pct, 1, true)} / {fmtPct(metrics.profit_target_pct)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-bg-subtle overflow-hidden">
                        <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, Math.max(0, metrics.profit_progress ?? 0))}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-2xs mb-1">
                        <span className="text-text-muted">Max drawdown used</span>
                        <span className="tabular font-medium text-danger">{fmtPct(metrics.current_dd_pct, 1)} / {fmtPct(metrics.max_dd_pct)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-bg-subtle overflow-hidden">
                        <div className="h-full rounded-full bg-danger" style={{ width: `${Math.min(100, Math.max(0, metrics.max_dd_progress ?? 0))}%` }} />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Top stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {acc ? (
              <>
                <StatCard
                  label="Balance"
                  value={fmtUSD(acc.balance)}
                  icon={Wallet}
                  tone="accent"
                />
                <StatCard
                  label="Equity"
                  value={fmtUSD(acc.equity)}
                  icon={TrendingUp}
                  tone={toNum(acc.equity) >= toNum(acc.balance) ? 'success' : 'warn'}
                  delta={toNum(acc.equity) - toNum(acc.balance)}
                  deltaLabel="Open P&L"
                />
                <StatCard
                  label="Profit target"
                  value={metrics ? fmtPct(metrics.current_profit_pct, 1, true) : '—'}
                  sub={metrics ? `of ${fmtPct(metrics.profit_target_pct)}` : ''}
                  icon={Target}
                  tone="success"
                  progressPct={metrics?.profit_progress}
                />
                <StatCard
                  label="Max drawdown"
                  value={metrics ? fmtPct(metrics.current_dd_pct, 1) : '—'}
                  sub={metrics ? `limit ${fmtPct(metrics.max_dd_pct)}` : ''}
                  icon={ShieldAlert}
                  tone={metrics && metrics.max_dd_progress > 75 ? 'danger' : 'warn'}
                  progressPct={metrics?.max_dd_progress}
                  progressTone="danger"
                />
              </>
            ) : !ready ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-5"><Skeleton className="h-16 w-full" /></Card>
              ))
            ) : (
              <Card className="col-span-2 lg:col-span-4 p-6 text-center text-sm text-text-muted">
                No active trading account. Your account metrics will appear once a challenge is active.
              </Card>
            )}
          </div>

          {/* Main row: challenge progress + equity chart */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              {metrics
                ? <ChallengeProgressCard metrics={metrics} />
                : !ready
                  ? <Card className="p-6 h-full"><Skeleton className="h-72 w-full" /></Card>
                  : <Card className="p-6 h-full flex items-center justify-center text-center text-sm text-text-muted">No active challenge metrics yet.</Card>}
            </div>
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Equity curve</CardTitle>
                    <p className="text-xs text-text-muted">Account balance over time</p>
                  </div>
                  {acc && (
                    <Badge tone={pnlClass(toNum(acc.equity) - toNum(acc.balance)).includes('success') ? 'success' : 'neutral'}>
                      {toNum(acc.equity) >= toNum(acc.balance) ? '↑' : '↓'}{' '}
                      {fmtPct(((toNum(acc.equity) - toNum(acc.balance)) / Math.max(1, toNum(acc.balance))) * 100, 2)}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {metrics
                    ? <EquityChart data={metrics.equity_chart} height={280} />
                    : !ready
                      ? <div className="h-72 flex items-center justify-center"><Skeleton className="h-48 w-full mx-6" /></div>
                      : <div className="h-72 flex items-center justify-center text-sm text-text-muted">No equity data to display yet.</div>}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recent trades + Other challenges */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Recent trades</CardTitle>
                  <Link href="/dashboard/history" className="text-2xs text-accent hover:underline">View all →</Link>
                </CardHeader>
                <CardContent className="p-0">
                  <RecentTradesTable trades={recent} />
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-1">
              <OtherChallengesCard challenges={challenges} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────

function ResendVerifyButton() {
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  return (
    <button
      type="button"
      disabled={sending || sent}
      onClick={async () => {
        setSending(true)
        await api.auth.resendVerification()
        setSent(true)
        setSending(false)
      }}
      className="text-accent hover:underline disabled:opacity-60 disabled:no-underline ml-0.5"
    >
      {sent ? 'Sent! Check your inbox.' : sending ? 'Sending…' : 'Resend verification'}
    </button>
  )
}

function NoChallengeCTA() {
  const perks = [
    { icon: Wallet,     title: 'Capital up to $200K', body: 'Trade firm capital across multiple account sizes.' },
    { icon: Target,     title: 'Keep up to 90%',      body: 'Industry-leading profit split on funded accounts.' },
    { icon: TrendingUp, title: 'Two-step evaluation',  body: 'Prove consistency, then get funded.' },
  ]
  return (
    <Card className="relative overflow-hidden border-accent/40">
      <div className="absolute inset-0 bg-aurora opacity-30 pointer-events-none" />
      <CardContent className="relative p-8 sm:p-12 text-center">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-accent to-success text-white items-center justify-center mb-5 shadow-glow">
          <Trophy className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Start your first challenge</h2>
        <p className="text-sm text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
          You don&apos;t have an active challenge yet. Pick an account size, prove your edge, and trade our capital.
        </p>
        <div className="mt-7 grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
          {perks.map((p) => {
            const Icon = p.icon
            return (
              <div key={p.title} className="rounded-xl border border-border-subtle bg-surface/60 p-4">
                <Icon className="h-5 w-5 text-accent" />
                <div className="font-medium text-sm mt-2">{p.title}</div>
                <div className="text-2xs text-text-muted mt-0.5 leading-relaxed">{p.body}</div>
              </div>
            )
          })}
        </div>
        <div className="mt-7">
          <Button asChild size="lg">
            <Link href="/challenges">Browse challenges <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RecentTradesTable({ trades }: { trades: Trade[] | null }) {
  if (trades === null) {
    return (
      <div className="p-5 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }
  if (trades.length === 0) {
    return (
      <div className="p-8 text-center">
        <Calendar className="h-8 w-8 mx-auto text-text-faint mb-3" />
        <div className="text-sm text-text-muted">No closed trades yet</div>
        <div className="text-2xs text-text-faint mt-1">Your trade history will appear here once you start trading.</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-bg-subtle/30">
            <th className="text-left px-4 py-2.5 text-2xs uppercase tracking-wider text-text-faint font-medium">Symbol</th>
            <th className="text-left px-4 py-2.5 text-2xs uppercase tracking-wider text-text-faint font-medium">Side</th>
            <th className="text-right px-4 py-2.5 text-2xs uppercase tracking-wider text-text-faint font-medium hidden sm:table-cell">Lots</th>
            <th className="text-right px-4 py-2.5 text-2xs uppercase tracking-wider text-text-faint font-medium">P&L</th>
            <th className="text-right px-4 py-2.5 text-2xs uppercase tracking-wider text-text-faint font-medium hidden md:table-cell">Closed</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="border-b border-border-subtle/40 last:border-0 hover:bg-surface-muted/30">
              <td className="px-4 py-2.5 font-medium tabular">{t.symbol}</td>
              <td className="px-4 py-2.5">
                <Badge tone={t.type === 'buy' ? 'success' : 'danger'}>{t.type.toUpperCase()}</Badge>
              </td>
              <td className="px-4 py-2.5 text-right tabular text-text-muted hidden sm:table-cell">{toNum(t.lot_size).toFixed(2)}</td>
              <td className={`px-4 py-2.5 text-right tabular font-medium ${pnlClass(t.pnl)}`}>{fmtUSD(t.pnl, { sign: true })}</td>
              <td className="px-4 py-2.5 text-right text-2xs text-text-muted hidden md:table-cell">{timeAgo(t.closed_at_iso || t.closed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OtherChallengesCard({ challenges }: { challenges: ChallengeAccount[] | null }) {
  if (challenges === null) {
    return <Card className="p-6 h-full"><Skeleton className="h-64 w-full" /></Card>
  }
  const list = challenges.slice(0, 5)
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Your challenges</CardTitle>
        <span className="text-2xs text-text-muted tabular">{challenges.length} total</span>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {list.length === 0
          ? <div className="text-center py-6 text-sm text-text-muted">No challenges yet</div>
          : list.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/challenges`}
              className="block rounded-lg border border-border-subtle p-3 hover:border-accent hover:bg-surface-muted/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-medium">{c.plan_name || `Challenge #${c.id}`}</div>
                  <div className="text-2xs text-text-muted tabular">{fmtUSD(c.account_size ?? 0, { decimals: 0 })}</div>
                </div>
                <Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge>
              </div>
              <div className="flex items-center justify-between text-2xs text-text-muted">
                <span>Phase {c.phase}</span>
                <span className="tabular">{fmtUSD(toNum(c.current_balance) - toNum(c.starting_balance), { sign: true })}</span>
              </div>
            </Link>
          ))}
        <Button asChild variant="ghost" size="sm" className="w-full mt-2">
          <Link href="/dashboard/challenges">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </CardContent>
    </Card>
  )
}
