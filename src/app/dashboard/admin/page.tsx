'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  Users as UsersIcon, Trophy, TrendingUp, DollarSign, AlertCircle,
  CreditCard, Activity, ArrowRight, Rocket,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useVisibilityPoll } from '@/hooks/use-visibility-poll'
import { fmtUSD, fmtNum, toNum, pnlClass, timeAgo } from '@/lib/format'
import type { AdminStats, PaymentOrder, ChallengeAccount } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [revenue, setRevenue] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    const res = await api.admin.stats()
    if (res.ok) { setStats(res.data); setError(null) }
    else setError(res.error)
  }
  useVisibilityPoll(refresh, 15_000, true)

  // Issue #3 — total revenue KPI. Reuses the existing analytics revenue endpoint
  // (30s-cached), so this shares the same source as the Analytics page and the
  // dashboard trend chart rather than adding a new query or backend table.
  useEffect(() => {
    api.admin.analyticsRevenue().then((r) => { if (r.ok) setRevenue(toNum(r.data.total)) })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin overview</h1>
        <p className="text-sm text-text-muted mt-1">
          Platform-wide metrics. Auto-refreshes every 15 seconds.
        </p>
      </div>

      <OnboardingCard />

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-md bg-danger-muted border border-danger/30 text-sm">
          <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
          <span className="text-danger">{error}</span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {!stats ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-16 w-full" /></Card>
          ))
        ) : (
          <>
            <Tile icon={DollarSign}       label="Total revenue"     value={revenue === null ? '—' : fmtUSD(revenue)} tone="success" />
            <Tile icon={UsersIcon}        label="Users"             value={fmtNum(stats.users)}             tone="accent" />
            <Tile icon={Trophy}           label="Active challenges" value={fmtNum(stats.active_challenges)} tone="info" />
            <Tile icon={TrendingUp}       label="Funded accounts"   value={fmtNum(stats.funded_accounts)}   tone="success" />
            <Tile icon={Activity}         label="Open positions"    value={fmtNum(stats.open_positions)}    tone="accent" />
            <Tile icon={DollarSign}       label="Total trades"      value={fmtNum(stats.total_trades)}      tone="info" />
            <Tile
              icon={TrendingUp}
              label="Realised P&L (all)"
              value={fmtUSD(stats.total_pnl, { sign: true })}
              tone={toNum(stats.total_pnl) >= 0 ? 'success' : 'danger'}
              valueClass={pnlClass(stats.total_pnl)}
            />
            <Tile icon={CreditCard} label="Pending payments" value={fmtNum(stats.pending_payments)}  tone={stats.pending_payments > 0 ? 'warn' : 'accent'} />
          </>
        )}
      </div>

      {/* Quick actions — modern action row, relocated out of the KPI grid */}
      <QuickActions />

      {/* Revenue + growth trend — command-center view (reuses analytics endpoints) */}
      <DashboardTrends />

      {/* Side-by-side recent panels */}
      {/* Recent activity previews */}
      <div className="grid lg:grid-cols-2 gap-4">
        <RecentPayments />
        <RecentChallenges />
      </div>
    </div>
  )
}

function QuickActions() {
  const actions = [
    { href: '/dashboard/admin/payments',   label: 'Review payments',  desc: 'Approve or reject orders', icon: CreditCard },
    { href: '/dashboard/admin/challenges', label: 'Manage challenges', desc: 'Payouts & lifecycle',       icon: Trophy },
    { href: '/dashboard/admin/users',      label: 'User management',   desc: 'Traders & access',         icon: UsersIcon },
    { href: '/dashboard/admin/analytics',  label: 'View analytics',    desc: 'Revenue & growth',         icon: TrendingUp },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {actions.map((a) => {
        const Icon = a.icon
        return (
          <Link key={a.href} href={a.href} className="group">
            <Card className="p-4 h-full transition-colors hover:border-accent/50 hover:bg-accent/5">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-1">{a.label}<ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" /></div>
                  <div className="text-2xs text-text-muted truncate">{a.desc}</div>
                </div>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

function PreviewCard({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link href={href}>View all <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

const STATUS_TONE: Record<string, string> = {
  pending: 'text-warn bg-warn/10', submitted: 'text-info bg-info/10',
  active: 'text-accent bg-accent/10', passed: 'text-success bg-success/10',
  funded: 'text-success bg-success/10', failed: 'text-danger bg-danger/10',
}
function StatusPill({ status }: { status: string }) {
  return <span className={cn('text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded', STATUS_TONE[status] || 'text-text-muted bg-surface-muted')}>{status}</span>
}

function RecentPayments() {
  const [rows, setRows] = useState<PaymentOrder[] | null>(null)
  useEffect(() => {
    api.admin.paymentsList().then((r) => {
      if (r.ok) setRows(r.data.filter((p) => p.status === 'pending' || p.status === 'submitted')
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5))
    })
  }, [])
  return (
    <PreviewCard title="Pending payments" href="/dashboard/admin/payments">
      {rows === null ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted py-6 text-center">No payments awaiting review.</p>
      ) : (
        <div className="divide-y divide-border-subtle -my-1">
          {rows.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">{fmtUSD(p.amount)}</div>
                <div className="text-2xs text-text-muted">{p.gateway} · {timeAgo(p.created_at)}</div>
              </div>
              <StatusPill status={p.status} />
            </div>
          ))}
        </div>
      )}
    </PreviewCard>
  )
}

function RecentChallenges() {
  const [rows, setRows] = useState<ChallengeAccount[] | null>(null)
  useEffect(() => {
    api.admin.challenges().then((r) => {
      if (r.ok) setRows([...r.data.challenges]
        .sort((a, b) => (b.phase_started_at || '').localeCompare(a.phase_started_at || '')).slice(0, 5))
    })
  }, [])
  return (
    <PreviewCard title="Recent challenges" href="/dashboard/admin/challenges">
      {rows === null ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted py-6 text-center">No challenges yet.</p>
      ) : (
        <div className="divide-y divide-border-subtle -my-1">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">{fmtUSD(c.current_balance)} <span className="text-2xs text-text-muted font-normal">balance</span></div>
                <div className="text-2xs text-text-muted">{c.status === 'funded' ? 'Funded' : `Phase ${c.phase}`} · {c.trading_days} trading day{c.trading_days === 1 ? '' : 's'}</div>
              </div>
              <StatusPill status={c.status} />
            </div>
          ))}
        </div>
      )}
    </PreviewCard>
  )
}

function Tile({
  icon: Icon, label, value, tone, valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone: 'accent' | 'success' | 'danger' | 'warn' | 'info'
  valueClass?: string
}) {
  const TONES = {
    accent:  'bg-accent-muted text-accent',
    success: 'bg-success-muted text-success',
    danger:  'bg-danger-muted text-danger',
    warn:    'bg-warn-muted text-warn',
    info:    'bg-info-muted text-info',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="text-2xs uppercase tracking-wider text-text-muted font-medium">{label}</div>
          <div className={cn('h-8 w-8 rounded-md flex items-center justify-center shrink-0', TONES[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className={cn('text-xl sm:text-2xl font-bold tracking-tight tabular truncate', valueClass)}>
          {value}
        </div>
      </Card>
    </motion.div>
  )
}


/** First-run guidance: shown until the operator finishes the setup wizard. */
function OnboardingCard() {
  const [show, setShow] = useState<boolean | null>(null)
  useEffect(() => {
    api.admin.whitelabelGet().then((r) => {
      setShow(r.ok ? (r.data as Record<string, string>).setup_completed !== '1' : false)
    })
  }, [])
  if (!show) return null
  return (
    <Card className="border-accent/40 bg-accent/5">
      <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <Rocket className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Finish setting up your platform</div>
            <div className="text-2xs text-text-muted mt-0.5 leading-relaxed">
              The guided setup walks you through branding, payments, email, your price feed, and your first challenge — about 10 minutes, no documentation needed.
            </div>
          </div>
        </div>
        <Link href="/dashboard/admin/setup" className="shrink-0">
          <Button size="sm">Open setup <ArrowRight className="h-4 w-4" /></Button>
        </Link>
      </CardContent>
    </Card>
  )
}

/** Command-center trend row: revenue + growth, reusing the analytics endpoints. */
function DashboardTrends() {
  const [rev, setRev] = useState<{ month: string; total: number }[] | null>(null)
  const [growth, setGrowth] = useState<{ month: string; users: number; challenges: number; funded: number }[] | null>(null)

  useEffect(() => {
    api.admin.analyticsRevenue().then((r) => {
      if (r.ok) setRev((r.data.monthly ?? []).map((d) => ({ month: d.month, total: toNum(d.total) })))
    })
    api.admin.analyticsGrowth().then((r) => {
      if (!r.ok) return
      // Merge the three monthly series into one row per month for the chart.
      const by: Record<string, { month: string; users: number; challenges: number; funded: number }> = {}
      const get = (m: string) => (by[m] ??= { month: m, users: 0, challenges: 0, funded: 0 })
      for (const x of r.data.new_users ?? [])      get(x.month).users = x.count
      for (const x of r.data.new_challenges ?? []) get(x.month).challenges = x.count
      for (const x of r.data.funded_monthly ?? []) get(x.month).funded = x.count
      setGrowth(Object.values(by).sort((a, b) => a.month.localeCompare(b.month)))
    })
  }, [])

  const monthTick = (v: string) => {
    const m = /^(\d{4})-(\d{2})$/.exec(v)
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString(undefined, { month: 'short' }) : v
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle>Revenue trend</CardTitle></CardHeader>
        <CardContent>
          {!rev ? <Skeleton className="h-48 w-full" /> : rev.length === 0 ? (
            <p className="text-sm text-text-muted py-12 text-center">No revenue yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={rev} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c6ef5" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7c6ef5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="rgba(156,163,175,0.6)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={monthTick} padding={{ left: 8, right: 8 }} />
                <YAxis stroke="rgba(156,163,175,0.6)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={48}
                       tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} allowDecimals={false} domain={[0, (max: number) => Math.ceil((max * 1.15) / 1000) * 1000]} />
                <Tooltip formatter={(v: number) => [fmtUSD(v), 'Revenue']} labelFormatter={monthTick}
                         contentStyle={{ background: '#0f1729', border: '1px solid #243049', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="total" stroke="#7c6ef5" strokeWidth={2} fill="url(#dashRev)" dot={{ r: 3, fill: '#7c6ef5' }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Growth trend</CardTitle></CardHeader>
        <CardContent>
          {!growth ? <Skeleton className="h-48 w-full" /> : growth.length === 0 ? (
            <p className="text-sm text-text-muted py-12 text-center">No growth data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growth} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                  <XAxis dataKey="month" stroke="rgba(156,163,175,0.6)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={monthTick} padding={{ left: 8, right: 8 }} />
                  <YAxis stroke="rgba(156,163,175,0.6)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={32} allowDecimals={false} domain={[0, (max: number) => Math.max(20, Math.ceil((max * 1.15) / 5) * 5)]} />
                  <Tooltip labelFormatter={monthTick} contentStyle={{ background: '#0f1729', border: '1px solid #243049', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="users" stroke="#7c6ef5" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Users" />
                  <Line type="monotone" dataKey="challenges" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Challenges" />
                  <Line type="monotone" dataKey="funded" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Funded" />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 text-[11px] text-text-muted mt-1">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7c6ef5]" />Users</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0ea5e9]" />Challenges</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#10B981]" />Funded</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
