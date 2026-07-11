'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { fmtUSD, toNum } from '@/lib/format'
import type { ChallengePlan } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ArrowRight, Check, Star } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function ChallengesPreview() {
  const [plans, setPlans] = useState<ChallengePlan[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.challengePlans().then((res) => {
      if (res.ok) setPlans(res.data.slice(0, 4))
      else        setError(res.error)
    })
  }, [])

  return (
    <section className="relative py-20 lg:py-28 bg-bg-subtle/40" id="challenges">
      <div className="container">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <Badge tone="accent" className="mb-4">Challenges</Badge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Built for <span className="text-accent">serious</span> traders
            </h2>
            <p className="mt-4 text-text-muted text-lg">
              Choose an account size. Transparent rules. Real prices. No tricks.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/challenges">
              View all challenges
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {error && (
          <div className="text-center py-12 text-sm text-text-muted">
            Unable to load challenges right now. <Link href="/challenges" className="text-accent">View plans →</Link>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans === null && !error && Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-6 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-8 w-20" />
              <div className="space-y-2 pt-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
          {plans?.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} delay={i * 0.05} featured={i === 1} />
          ))}
        </div>
      </div>
    </section>
  )
}

function PlanCard({ plan, delay, featured }: { plan: ChallengePlan; delay: number; featured?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge tone="accent" className="bg-bg border-accent shadow-glow">
            <Star className="h-3 w-3 fill-current" />
            Popular
          </Badge>
        </div>
      )}
      <Card className={`relative h-full p-6 lift ${featured ? 'border-accent/40 shadow-glow' : ''}`}>

        <div className="text-xs text-text-muted">{plan.name}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">
            {fmtUSD(plan.account_size, { decimals: 0 })}
          </span>
        </div>
        <div className="mt-1 text-sm text-text-muted">
          One-time fee <span className="text-text font-medium">{fmtUSD(plan.price)}</span>
        </div>

        <div className="mt-5 space-y-2 text-sm">
          <Row label="Profit target" value={`${toNum(plan.p1_profit_target)}% / ${toNum(plan.p2_profit_target)}%`} />
          <Row label="Max drawdown"  value={`${toNum(plan.p1_max_dd)}%`} />
          <Row label="Daily DD"      value={`${toNum(plan.p1_daily_dd)}%`} />
          <Row label="Profit split"  value={`${toNum(plan.funded_profit_split)}%`} highlight />
        </div>

        <Button asChild className="w-full mt-6" variant={featured ? 'primary' : 'secondary'}>
          <Link href={`/challenges?plan=${plan.id}`}>
            Get this challenge
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </Card>
    </motion.div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-text-muted">{label}</span>
      <span className={`tabular font-medium ${highlight ? 'text-success' : 'text-text'}`}>{value}</span>
    </div>
  )
}
