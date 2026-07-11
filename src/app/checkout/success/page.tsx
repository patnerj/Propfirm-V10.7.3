'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<Shell><Loader2 className="h-6 w-6 animate-spin text-accent" /></Shell>}>
      <CheckoutSuccessInner />
    </Suspense>
  )
}

function CheckoutSuccessInner() {
  const router = useRouter()
  const params = useSearchParams()
  const status = params.get('status') // 'success' | 'cancel' | null
  const [phase, setPhase] = useState<'loading' | 'success' | 'cancel' | 'error'>('loading')

  useEffect(() => {
    // Invalidate all the caches so the dashboard reflects the new challenge immediately
    invalidateFxsim('/challenge/my')
    invalidateFxsim('/payment/my-orders')
    invalidateFxsim('/account')

    if (status === 'cancel') { setPhase('cancel'); return }

    // Otherwise, treat as success — re-query the user's challenges to confirm
    // a new one was created (or payment recorded).
    ;(async () => {
      const res = await api.challengeMy()
      if (res.ok) setPhase('success')
      else        setPhase('error')
    })()
  }, [status])

  if (phase === 'loading') {
    return <Shell><Loader2 className="h-6 w-6 animate-spin text-accent" /><p className="mt-3 text-sm text-text-muted">Confirming your payment…</p></Shell>
  }

  if (phase === 'cancel') {
    return (
      <Shell>
        <div className="h-12 w-12 rounded-full bg-warn-muted text-warn flex items-center justify-center">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Checkout cancelled</h1>
        <p className="mt-2 text-sm text-text-muted">No charge was made. You can try again whenever you&apos;re ready.</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild><Link href="/challenges">Back to challenges <ArrowRight className="h-4 w-4" /></Link></Button>
          <Button asChild variant="ghost"><Link href="/dashboard">Go to dashboard</Link></Button>
        </div>
      </Shell>
    )
  }

  if (phase === 'error') {
    return (
      <Shell>
        <div className="h-12 w-12 rounded-full bg-danger-muted text-danger flex items-center justify-center">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">We couldn&apos;t confirm your payment</h1>
        <p className="mt-2 text-sm text-text-muted">If you completed checkout, your challenge may take up to a minute to appear in your dashboard.</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild><Link href="/dashboard">Go to dashboard <ArrowRight className="h-4 w-4" /></Link></Button>
          <Button asChild variant="ghost"><Link href="/dashboard/payouts">View order status</Link></Button>
        </div>
      </Shell>
    )
  }

  // success
  return (
    <Shell>
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="h-14 w-14 rounded-full bg-success-muted text-success flex items-center justify-center"
      >
        <CheckCircle2 className="h-7 w-7" />
      </motion.div>
      <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight">Payment confirmed</h1>
      <p className="mt-2 text-sm text-text-muted max-w-md mx-auto">
        Your challenge is being activated. You&apos;ll receive an email when it&apos;s ready — usually within a few seconds.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
        <Button asChild size="lg">
          <Link href="/dashboard">Open dashboard <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-bg relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-aurora opacity-50" />
      <div className="absolute inset-0 -z-10 bg-grid-overlay opacity-30" />
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8 flex flex-col items-center">{children}</CardContent>
      </Card>
    </main>
  )
}
