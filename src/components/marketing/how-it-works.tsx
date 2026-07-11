'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Rocket, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const STEPS = [
  {
    n: '01',
    icon: Rocket,
    title: 'Take the challenge',
    body: 'Pick an account size from $10K to $200K. Hit the profit target while respecting drawdown limits across two phases.',
    items: ['Phase 1: 8% profit target', 'Phase 2: 5% profit target', 'Max 10% total drawdown'],
  },
  {
    n: '02',
    icon: CheckCircle2,
    title: 'Get funded',
    body: 'Pass both phases and receive a funded account. Trade real markets with our capital — no personal risk.',
    items: ['Real-time MT5 access', 'Same risk parameters', 'Trade what you want'],
  },
  {
    n: '03',
    icon: Trophy,
    title: 'Get paid',
    body: 'Withdraw your share of profits every 14 days. Up to 85% profit split depending on your plan.',
    items: ['80% baseline split', 'Up to 85% on Elite', 'Paid in 24 hours'],
  },
]

export function HowItWorks() {
  return (
    <section className="relative py-20 lg:py-28" id="how-it-works">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <Badge tone="accent" className="mb-4">The process</Badge>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Three steps to <span className="text-accent">funded</span>
          </h2>
          <p className="mt-4 text-text-muted text-lg">
            A clear, transparent evaluation. No hidden rules, no surprise breaches.
            Just real trading on real terms.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="relative group"
              >
                <div className="relative h-full p-6 rounded-xl bg-surface border border-border lift overflow-hidden">
                  {/* big background number */}
                  <div className="absolute -top-2 -right-2 text-7xl font-bold tracking-tighter text-surface-strong/40 select-none">
                    {step.n}
                  </div>

                  <div className="relative">
                    <div className="h-11 w-11 rounded-lg bg-accent-muted text-accent flex items-center justify-center mb-5">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-2 text-sm text-text-muted leading-relaxed">{step.body}</p>

                    <ul className="mt-5 space-y-2">
                      {step.items.map((it) => (
                        <li key={it} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                          <span className="text-text-muted">{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
