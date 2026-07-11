'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="py-20 lg:py-28 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-overlay opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/15 blur-3xl" />
      </div>

      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-4xl md:text-6xl font-bold tracking-tightest leading-[1.05]">
            Ready to trade
            <br />
            <span className="text-accent">our capital?</span>
          </h2>
          <p className="mt-6 text-lg text-text-muted max-w-xl mx-auto">
            Free account in 30 seconds. Start the challenge today.
            Get funded within weeks, not months.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="xl" variant="primary">
              <Link href="/register">
                Create free account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/challenges">View challenges</Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-text-faint">
            No credit card required · Free demo account included
          </p>
        </motion.div>
      </div>
    </section>
  )
}
