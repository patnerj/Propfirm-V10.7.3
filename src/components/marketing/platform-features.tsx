'use client'

import { motion } from 'framer-motion'
import { Activity, BarChart3, Bell, Cpu, Globe2, Lock, Smartphone, Zap } from 'lucide-react'

const FEATURES = [
  { icon: Activity,   title: 'Real-time execution',  body: 'Live TradingView charts and tick-by-tick price feeds across 19 instruments.' },
  { icon: BarChart3,  title: 'Deep analytics',       body: 'R:R tracker, hourly heatmap, drawdown curve, win streaks, and 30+ KPIs.' },
  { icon: Cpu,        title: 'Auto-managed risk',    body: 'SL/TP, partial closes, daily DD enforcement, news-event lockouts.' },
  { icon: Smartphone, title: 'Trade anywhere',       body: 'PWA-installable. Trade and monitor from desktop, tablet, or phone.' },
  { icon: Bell,       title: 'Real-time alerts',     body: 'Notifications for fills, breaches, payout approvals — instant.' },
  { icon: Zap,        title: 'API access',           body: 'Generate scoped API keys. Run your own algos against our infrastructure.' },
  { icon: Globe2,     title: 'Global markets',       body: 'Forex majors, indices, metals, crypto. Trade what you know.' },
  { icon: Lock,       title: 'Institutional-grade',  body: '2FA, scoped API keys, full audit log, SOC 2 controls.' },
]

export function PlatformFeatures() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Everything in <span className="text-accent">one platform</span>
          </h2>
          <p className="mt-4 text-text-muted text-lg">
            A trading terminal, evaluation engine, and payout system — all built for serious capital.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border-subtle rounded-xl overflow-hidden">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                className="bg-surface p-6 hover:bg-surface-muted transition-colors group"
              >
                <div className="h-11 w-11 rounded-lg bg-accent/15 ring-1 ring-accent/25 text-accent flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-accent/25 transition-all">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-1.5 text-sm text-text-muted">{f.body}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
