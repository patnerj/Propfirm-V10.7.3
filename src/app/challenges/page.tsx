'use client'

import { Fragment, Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { fmtUSD, toNum } from '@/lib/format'
import type { ChallengePlan } from '@/types/api'
import { MarketingHeader } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/footer'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PurchaseDialog } from '@/components/challenges/purchase-dialog'
import { Check, Star, X, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export default function ChallengesPage() {
  return (
    <Suspense fallback={<ChallengesPageSkeleton />}>
      <ChallengesPageInner />
    </Suspense>
  )
}

function ChallengesPageSkeleton() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="pt-32 pb-12">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="h-6 w-24 mx-auto skel rounded-md" />
              <div className="h-14 w-3/4 mx-auto skel rounded-md" />
              <div className="h-5 w-1/2 mx-auto skel rounded-md" />
            </div>
            <div className="mt-12 flex justify-center">
              <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-surface border border-border">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-20" />)}
              </div>
            </div>
          </div>
        </section>
        <section className="pb-24">
          <div className="container">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-7 space-y-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-12 w-40" />
                  <Skeleton className="h-16 w-full" />
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((__, j) => <Skeleton key={j} className="h-3 w-full" />)}
                  </div>
                  <Skeleton className="h-12 w-full" />
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}

function ChallengesPageInner() {
  const params  = useSearchParams()
  const preSelect = Number(params.get('plan') ?? 0) || null

  const [plans, setPlans] = useState<ChallengePlan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeSize, setActiveSize] = useState<number | 'all'>('all')
  const [openPlan, setOpenPlan] = useState<ChallengePlan | null>(null)

  useEffect(() => {
    api.challengePlans().then((res) => {
      if (res.ok) setPlans(res.data)
      else        setError(res.error)
    })
  }, [])

  // Stripe cancel return → inform the trader and clean the URL.
  useEffect(() => {
    if (params.get('stripe') === 'cancelled') {
      toast.info('Checkout cancelled — no payment was taken.')
      if (typeof window !== 'undefined') window.history.replaceState({}, '', '/challenges')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // group plans by account size (a single firm may have multiple phase configs per size)
  const sizes = useMemo(() => {
    if (!plans) return []
    const set = new Set(plans.map((p) => toNum(p.account_size)))
    return [...set].sort((a, b) => a - b)
  }, [plans])

  useEffect(() => {
    if (preSelect && plans) {
      const p = plans.find((pl) => pl.id === preSelect)
      if (p) setOpenPlan(p)
    }
  }, [preSelect, plans])

  const visiblePlans = useMemo(() => {
    if (!plans) return []
    if (activeSize === 'all') return plans
    return plans.filter((p) => toNum(p.account_size) === activeSize)
  }, [plans, activeSize])

  // Choose a column count by plan count so a card never strands awkwardly:
  // 1→centered, 2→2-up, 3→3-up, 4→2×2 (4-up on wide), 5+→3-up rows.
  const gridClass = useMemo(() => {
    const n = visiblePlans.length
    if (n <= 1) return 'grid grid-cols-1 max-w-md mx-auto'
    if (n === 2) return 'grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
    if (n === 3) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto'
    if (n === 4) return 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto'
    return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto'
  }, [visiblePlans.length])

  // Designated "popular" plan: the middle of the visible set (stable, centred).
  const popularId = useMemo(() => {
    if (visiblePlans.length === 0) return null
    return visiblePlans[Math.floor((visiblePlans.length - 1) / 2)].id
  }, [visiblePlans])

  return (
    <>
      <MarketingHeader />
      <main>
        {/* Hero */}
        <section className="pt-32 pb-12 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-aurora opacity-60" />
            <div className="absolute inset-0 bg-grid-overlay opacity-40" />
          </div>
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <Badge tone="accent" className="mb-4">Challenges</Badge>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tightest leading-[1.05]">
                Pick an <span className="text-accent">account size</span>
              </h1>
              <p className="mt-5 text-lg text-text-muted max-w-xl mx-auto">
                Transparent rules. Real prices. Same drawdown across phase 1, phase 2, and funded.
              </p>
            </div>

            {/* Size selector */}
            <div className="mt-12 flex justify-center">
              <div className="inline-flex flex-wrap justify-center gap-1 p-1 rounded-lg bg-surface border border-border">
                {sizes.length === 0
                  ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-20" />)
                  : (
                    <>
                      <button
                        onClick={() => setActiveSize('all')}
                        className={cn(
                          'px-4 h-9 rounded-md text-sm font-medium transition-all focus-ring',
                          activeSize === 'all'
                            ? 'bg-accent text-white shadow-glow'
                            : 'text-text-muted hover:text-text hover:bg-surface-muted',
                        )}
                      >
                        All sizes
                      </button>
                      {sizes.map((s) => (
                        <button
                          key={s}
                          onClick={() => setActiveSize(s)}
                          className={cn(
                            'px-4 h-9 rounded-md text-sm font-medium transition-all focus-ring',
                            activeSize === s
                              ? 'bg-accent text-white shadow-glow'
                              : 'text-text-muted hover:text-text hover:bg-surface-muted',
                          )}
                        >
                          {fmtUSD(s, { decimals: 0 })}
                        </button>
                      ))}
                    </>
                  )}
              </div>
            </div>
          </div>
        </section>

        {/* Plans */}
        <section className="pb-24">
          <div className="container">
            {error && (
              <div className="text-center py-20 text-text-muted">
                Unable to load challenges. Please try again later.
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeSize ?? 'loading'}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={cn(plans === null ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto' : gridClass, 'gap-5 items-stretch lg:pt-3')}
              >
                {plans === null && !error
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i} className="p-7 space-y-4">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-12 w-40" />
                        <Skeleton className="h-16 w-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-4/5" />
                          <Skeleton className="h-3 w-3/4" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                        <Skeleton className="h-12 w-full" />
                      </Card>
                    ))
                  : visiblePlans.map((plan) => (
                      <DetailedPlanCard
                        key={plan.id}
                        plan={plan}
                        featured={plan.id === popularId && visiblePlans.length > 1}
                        onSelect={() => setOpenPlan(plan)}
                      />
                    ))}
              </motion.div>
            </AnimatePresence>

            {/* Empty state — plans loaded but none for the selected size, or none at all */}
            {plans !== null && !error && plans.length === 0 && (
              <div className="text-center py-20">
                <div className="inline-flex h-12 w-12 rounded-full bg-warn-muted text-warn items-center justify-center mb-4">
                  <X className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">No challenges available</h3>
                <p className="mt-2 text-sm text-text-muted">
                  Our team is preparing new evaluation plans. Please check back soon.
                </p>
              </div>
            )}
            {plans !== null && plans.length > 0 && visiblePlans.length === 0 && (
              <div className="text-center py-20 text-sm text-text-muted">
                No plans match this account size. Try a different size above.
              </div>
            )}

            {/* Comparison table */}
            {visiblePlans.length > 0 && (
              <div className="mt-16">
                <ComparisonTable plans={visiblePlans} featuredId={visiblePlans.length > 1 ? popularId : null} />
              </div>
            )}
          </div>
        </section>
      </main>
      <MarketingFooter />

      {openPlan && (
        <PurchaseDialog plan={openPlan} open={!!openPlan} onClose={() => setOpenPlan(null)} />
      )}
    </>
  )
}

function DetailedPlanCard({
  plan, featured, onSelect,
}: { plan: ChallengePlan; featured?: boolean; onSelect: () => void }) {
  return (
    <Card
      className={cn(
        'relative p-7 lift h-full flex flex-col transition-all duration-300 hover:-translate-y-1',
        featured
          ? 'border-accent/50 shadow-glow mt-4 lg:mt-0 overflow-visible ring-1 ring-accent/20'
          : 'hover:border-border hover:shadow-card-lg',
      )}
    >
      {featured && (
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-[inherit] bg-gradient-to-r from-accent/0 via-accent to-accent/0" />
      )}
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge tone="accent" className="bg-bg border-accent shadow-glow">
            <Star className="h-3 w-3 fill-current" />
            Most popular
          </Badge>
        </div>
      )}

      <div className="text-xs uppercase tracking-wider text-text-muted">{plan.name}</div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-5xl font-bold tracking-tightest">{fmtUSD(plan.account_size, { decimals: 0 })}</span>
      </div>
      <div className="mt-2 text-text-muted text-sm">
        Account size · <span className="text-text">{plan.phases}-phase</span> evaluation
      </div>

      <div className="mt-6 p-4 rounded-lg bg-bg-subtle border border-border-subtle">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-muted">Challenge fee</span>
          <span className="text-2xl font-bold tabular">{fmtUSD(plan.price)}</span>
        </div>
        <div className="mt-1 text-2xs text-text-faint">One-time · refunded with first payout</div>
      </div>

      <ul className="mt-6 space-y-2.5 text-sm">
        <Feature label={`${toNum(plan.p1_profit_target)}% phase 1 target`} />
        <Feature label={`${toNum(plan.p2_profit_target)}% phase 2 target`} />
        <Feature label={`${toNum(plan.p1_daily_dd)}% daily drawdown`} />
        <Feature label={`${toNum(plan.p1_max_dd)}% max drawdown`} />
        <Feature label={`${toNum(plan.funded_profit_split)}% profit split when funded`} highlight />
        <Feature label={`1:${plan.max_leverage} leverage`} />
        {plan.news_trading
          ? <Feature label="News trading allowed" />
          : <Feature label="News trading restricted" disabled />}
        {plan.weekend_holding
          ? <Feature label="Weekend holding allowed" />
          : <Feature label="No weekend holding" disabled />}
      </ul>

      <div className="mt-auto pt-7">
        <Button
          onClick={onSelect}
          className="w-full"
          variant={featured ? 'primary' : 'secondary'}
          size="lg"
        >
          Start this challenge
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}

function Feature({ label, highlight, disabled }: { label: string; highlight?: boolean; disabled?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      {disabled ? (
        <X className="h-4 w-4 text-text-faint shrink-0 mt-0.5" />
      ) : (
        <div className={cn('h-4 w-4 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          highlight ? 'bg-success text-white' : 'bg-success-muted text-success')}>
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </div>
      )}
      <span className={cn(
        'text-sm',
        disabled ? 'text-text-faint line-through' : highlight ? 'text-text font-medium' : 'text-text-muted',
      )}>
        {label}
      </span>
    </li>
  )
}

function ComparisonTable({ plans, featuredId }: { plans: ChallengePlan[]; featuredId?: number | null }) {
  type Row = { label: string; key: keyof ChallengePlan; format?: (v: number | string) => string }
  const groups: { title: string; rows: Row[] }[] = [
    { title: 'General', rows: [
      { label: 'Account size',  key: 'account_size', format: (v) => fmtUSD(v, { decimals: 0 }) },
      { label: 'Challenge fee', key: 'price',         format: (v) => fmtUSD(v) },
    ] },
    { title: 'Phase 1', rows: [
      { label: 'Profit target', key: 'p1_profit_target', format: (v) => `${toNum(v)}%` },
      { label: 'Daily drawdown', key: 'p1_daily_dd',     format: (v) => `${toNum(v)}%` },
      { label: 'Max drawdown',   key: 'p1_max_dd',       format: (v) => `${toNum(v)}%` },
      { label: 'Min trading days', key: 'p1_min_days',   format: (v) => `${v}` },
    ] },
    { title: 'Phase 2', rows: [
      { label: 'Profit target', key: 'p2_profit_target', format: (v) => `${toNum(v)}%` },
      { label: 'Daily drawdown', key: 'p2_daily_dd',     format: (v) => `${toNum(v)}%` },
      { label: 'Max drawdown',   key: 'p2_max_dd',       format: (v) => `${toNum(v)}%` },
    ] },
    { title: 'Funded & limits', rows: [
      { label: 'Profit split',  key: 'funded_profit_split', format: (v) => `${toNum(v)}%` },
      { label: 'Max leverage',  key: 'max_leverage',        format: (v) => `1:${v}` },
      { label: 'Max lot size',  key: 'max_lot_size',        format: (v) => `${toNum(v)}` },
    ] },
  ]
  const colCount = plans.length + 1

  return (
    <Card className="overflow-hidden">
      <div className="p-6 border-b border-border-subtle">
        <h3 className="text-lg font-semibold tracking-tight">Side-by-side comparison</h3>
        <p className="text-sm text-text-muted mt-1">Every rule, grouped by stage. Scroll horizontally on smaller screens.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-surface text-left px-5 py-3 text-2xs uppercase tracking-wider text-text-faint font-semibold border-b border-border-subtle min-w-[9rem]">
                Rule
              </th>
              {plans.map((p) => {
                const feat = p.id === featuredId
                return (
                  <th key={p.id} className={cn(
                    'px-5 py-3 text-right text-2xs uppercase tracking-wider font-semibold border-b border-border-subtle whitespace-nowrap',
                    feat ? 'text-accent bg-accent-muted/40' : 'text-text-muted',
                  )}>
                    {p.name}
                    {feat && <span className="ml-1.5 inline-flex items-center"><Star className="h-2.5 w-2.5 fill-current" /></span>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.title}>
                <tr>
                  <td colSpan={colCount} className="sticky left-0 bg-bg-subtle/60 px-5 py-2 text-2xs uppercase tracking-[0.12em] text-text-muted font-semibold border-b border-border-subtle">
                    {g.title}
                  </td>
                </tr>
                {g.rows.map((row) => (
                  <tr key={row.label} className="group">
                    <td className="sticky left-0 z-10 bg-surface group-hover:bg-surface-muted/60 px-5 py-2.5 text-text-muted border-b border-border-subtle/50 whitespace-nowrap">
                      {row.label}
                    </td>
                    {plans.map((p) => {
                      const feat = p.id === featuredId
                      return (
                        <td key={p.id} className={cn(
                          'px-5 py-2.5 text-right tabular text-text border-b border-border-subtle/50 whitespace-nowrap',
                          feat && 'bg-accent-muted/20 font-medium',
                        )}>
                          {row.format ? row.format(p[row.key] as number | string) : String(p[row.key])}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
