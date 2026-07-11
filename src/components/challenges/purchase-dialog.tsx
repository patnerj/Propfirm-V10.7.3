'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { fmtUSD, toNum } from '@/lib/format'
import { isNative } from '@/lib/native'
import { useAuth } from '@/store/auth'
import type { ChallengePlan, PaymentConfig } from '@/types/api'
import { cn } from '@/lib/cn'
import {
  ArrowRight, ArrowLeft, Check, CreditCard, Bitcoin,
  Upload, AlertCircle, ShieldCheck, FileText, Loader2, ExternalLink, Copy,
} from 'lucide-react'
import { QrCode } from '@/components/qr-code'

type Step = 'review' | 'gateway' | 'manual' | 'success'
type Gateway = 'stripe' | 'manual_crypto' | null

interface Props {
  plan:    ChallengePlan
  open:    boolean
  onClose: () => void
}

export function PurchaseDialog({ plan, open, onClose }: Props) {
  const router = useRouter()
  const { user, ready } = useAuth()

  const [step, setStep]         = useState<Step>('review')
  const [config, setConfig]     = useState<PaymentConfig | null>(null)
  const [gateway, setGateway]   = useState<Gateway>(null)
  const [orderId, setOrderId]   = useState<number | null>(null)
  const [proofFile, setProof]   = useState<File | null>(null)
  const [txnRef, setTxnRef]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [coupon, setCoupon]     = useState('')
  const [couponInfo, setCouponInfo] = useState<{ code: string; original: number; discount: number; final: number } | null>(null)
  const [couponErr, setCouponErr]   = useState<string | null>(null)
  const [couponBusy, setCouponBusy] = useState(false)

  const applyCoupon = async () => {
    if (!coupon.trim()) return
    setCouponBusy(true); setCouponErr(null)
    const res = await api.couponValidate(coupon.trim(), plan.id)
    setCouponBusy(false)
    if (res.ok && res.data.valid) {
      setCouponInfo({ code: res.data.code || coupon.trim().toUpperCase(), original: res.data.original ?? price, discount: res.data.discount ?? 0, final: res.data.final ?? price })
    } else {
      setCouponInfo(null)
      setCouponErr(res.ok ? res.data.message : (res.error || 'Could not validate coupon'))
    }
  }
  const clearCoupon = () => { setCoupon(''); setCouponInfo(null); setCouponErr(null) }

  const price = toNum(plan.price)
  const isFree = price <= 0

  // Reset on close OR when plan changes (so reopening with a different plan starts clean)
  useEffect(() => {
    if (!open) {
      setStep('review'); setGateway(null); setOrderId(null)
      setProof(null); setTxnRef(''); setError(null); setLoading(false)
      setConfig(null) // re-fetch on next gateway step in case admin changed settings
    }
  }, [open, plan.id])

  // Fetch payment config when we hit the gateway step
  useEffect(() => {
    if (step !== 'gateway' || config || isFree) return
    api.paymentConfig().then((res) => {
      if (res.ok) setConfig(res.data)
      else        setError(res.error)
    })
  }, [step, config, isFree])

  // Available gateway options
  const gateways = useMemo(() => {
    if (!config) return []
    const list: { id: Gateway; label: string; sub: string; icon: typeof CreditCard; tone: string }[] = []
    if (config.has_stripe) {
      list.push({ id: 'stripe',        label: 'Credit / debit card', sub: 'Instant via Stripe',           icon: CreditCard, tone: 'text-info' })
    }
    if (config.has_manual_crypto) {
      list.push({ id: 'manual_crypto', label: 'Crypto transfer',     sub: 'BTC, USDT, USDC',              icon: Bitcoin,    tone: 'text-warn' })
    }
    return list
  }, [config])

  // ── Actions ────────────────────────────────────────────────────────
  async function startFree() {
    setLoading(true)
    setError(null)
    const res = await api.challengeStart(plan.id)
    setLoading(false)
    if (res.ok && !res.data.requires_payment) {
      toast.success('Challenge started!')
      router.push('/dashboard?started=' + plan.id)
      onClose()
    } else {
      setError(res.ok ? 'Unable to start challenge' : res.error)
    }
  }

  async function chooseGateway(g: Gateway) {
    if (!g) return
    setGateway(g)
    setError(null)

    const couponToSend = couponInfo ? couponInfo.code : ''

    if (g === 'stripe') {
      setLoading(true)
      const res = await api.stripeCheckout(plan.id, couponToSend)
      setLoading(false)
      if (res.ok && res.data.checkout_url) {
        // V10.7.4 BUG 2 fix: on native, window.location.href navigated the app's
        // own WebView to checkout.stripe.com, which is outside the allowed nav
        // list — so Android handed it to external Chrome, the app lost control,
        // and the post-payment redirect landed in a browser with no session.
        // Open Stripe in an in-app browser (Custom Tab / SFSafariViewController)
        // instead; the appUrlOpen deep-link handler (native.ts) closes it and
        // returns to the dashboard on stripe=success. Web is unchanged.
        if (isNative()) {
          // Flag an in-flight checkout so the appStateChange fallback in
          // native.ts can self-heal even if the deep link never fires.
          try { sessionStorage.setItem('fxsim:stripe_pending', '1') } catch { /* private mode */ }
          const { Browser } = await import('@capacitor/browser')
          await Browser.open({ url: res.data.checkout_url, presentationStyle: 'popover' })
        } else {
          window.location.href = res.data.checkout_url
        }
      } else {
        setError(res.ok ? (res.data.message || 'Stripe checkout unavailable') : res.error)
      }
      return
    }

    // Manual gateways — create the order, move to manual step
    setLoading(true)
    const res = await api.paymentCreate(plan.id, g === 'manual_crypto' ? 'crypto' : g, couponToSend)
    setLoading(false)
    if (res.ok && res.data.order_id) {
      setOrderId(res.data.order_id)
      setStep('manual')
    } else {
      setError(res.ok ? 'Order creation failed' : res.error)
    }
  }

  async function submitProof() {
    if (!orderId || !proofFile) return
    setLoading(true)
    setError(null)
    const form = new FormData()
    form.append('order_id', String(orderId))
    form.append('txn_reference', txnRef)
    form.append('proof', proofFile)
    const res = await api.paymentSubmitProof(form)
    setLoading(false)
    if (res.ok) {
      setStep('success')
    } else {
      setError(res.error)
    }
  }

  // ── Not signed in: redirect to login with return ───────────────────
  if (open && ready && !user) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in to continue</DialogTitle>
            <DialogDescription>
              You need an account to purchase a challenge. It only takes 30 seconds.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button asChild size="lg">
              <Link href={`/register?next=/challenges?plan=${plan.id}`}>Create account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/login?next=/challenges?plan=${plan.id}`}>Sign in</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <AnimatePresence mode="wait">
          {step === 'review'  && <ReviewStep    key="review"  plan={plan} onNext={() => isFree ? startFree() : setStep('gateway')} loading={loading} isFree={isFree} error={error}
            coupon={coupon} setCoupon={setCoupon} applyCoupon={applyCoupon} clearCoupon={clearCoupon} couponInfo={couponInfo} couponErr={couponErr} couponBusy={couponBusy} />}
          {step === 'gateway' && <GatewayStep   key="gateway" plan={plan} gateways={gateways} configLoaded={!!config} chooseGateway={chooseGateway} onBack={() => setStep('review')} loading={loading} error={error} />}
          {step === 'manual'  && <ManualStep    key="manual"  plan={plan} gateway={gateway} config={config} orderId={orderId} proofFile={proofFile} setProof={setProof} txnRef={txnRef} setTxnRef={setTxnRef} onBack={() => setStep('gateway')} onSubmit={submitProof} loading={loading} error={error} />}
          {step === 'success' && <SuccessStep   key="success" onClose={onClose} />}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

// ── Step 1: Review plan ─────────────────────────────────────────────────────
function ReviewStep({
  plan, onNext, loading, isFree, error,
  coupon, setCoupon, applyCoupon, clearCoupon, couponInfo, couponErr, couponBusy,
}: {
  plan: ChallengePlan; onNext: () => void; loading: boolean; isFree: boolean; error: string | null
  coupon: string; setCoupon: (v: string) => void; applyCoupon: () => void; clearCoupon: () => void
  couponInfo: { code: string; original: number; discount: number; final: number } | null
  couponErr: string | null; couponBusy: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.25 }}
    >
      <DialogHeader>
        <DialogTitle>{plan.name}</DialogTitle>
        <DialogDescription>Review the challenge before checkout.</DialogDescription>
      </DialogHeader>

      <div className="mt-5 p-5 rounded-lg bg-bg-subtle border border-border-subtle">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-muted">Account size</span>
          <span className="text-2xl font-bold tabular">{fmtUSD(plan.account_size, { decimals: 0 })}</span>
        </div>
        <div className="my-4 h-px bg-border-subtle" />
        <Row label="Profit target P1"     value={`${toNum(plan.p1_profit_target)}%`} />
        <Row label="Profit target P2"     value={`${toNum(plan.p2_profit_target)}%`} />
        <Row label="Max drawdown"         value={`${toNum(plan.p1_max_dd)}%`} />
        <Row label="Daily drawdown"       value={`${toNum(plan.p1_daily_dd)}%`} />
        <Row label="Max leverage"         value={`1:${plan.max_leverage}`} />
        <Row label="Profit split"         value={`${toNum(plan.funded_profit_split)}%`} highlight />
      </div>

      {!isFree && (
        <div className="mt-4">
          {!couponInfo ? (
            <div>
              <div className="flex gap-2">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyCoupon() }}
                  placeholder="Coupon code"
                  className="flex-1 h-10 rounded-md bg-bg-subtle border border-border-subtle px-3 text-sm uppercase tracking-wide focus-ring"
                />
                <Button variant="outline" onClick={applyCoupon} disabled={couponBusy || !coupon.trim()}>
                  {couponBusy ? 'Checking…' : 'Apply'}
                </Button>
              </div>
              {couponErr && <p className="text-xs text-danger mt-1.5">{couponErr}</p>}
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 rounded-md bg-success-muted border border-success/30 text-sm">
              <span className="text-success font-medium">Coupon {couponInfo.code} applied · −{fmtUSD(couponInfo.discount)}</span>
              <button onClick={clearCoupon} className="text-xs text-text-muted hover:text-text underline">Remove</button>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-baseline justify-between p-4 rounded-lg bg-accent-muted border border-accent/20">
        <span className="text-sm font-medium">{isFree ? 'Free trial' : 'Total today'}</span>
        <span className="text-2xl font-bold tabular text-accent flex items-baseline gap-2">
          {!isFree && couponInfo && (
            <span className="text-sm font-normal text-text-faint line-through">{fmtUSD(couponInfo.original)}</span>
          )}
          {isFree ? '$0.00' : fmtUSD(couponInfo ? couponInfo.final : plan.price)}
        </span>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-md bg-danger-muted border border-danger/30 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <Button onClick={onNext} className="w-full mt-6" size="lg" loading={loading}>
        {isFree ? 'Start challenge' : 'Continue to payment'}
        <ArrowRight className="h-4 w-4" />
      </Button>

      <p className="mt-3 text-2xs text-text-faint text-center flex items-center justify-center gap-1.5">
        <ShieldCheck className="h-3 w-3" />
        Secure checkout · 14-day money-back if challenge fails
      </p>
    </motion.div>
  )
}

// ── Step 2: Pick gateway ───────────────────────────────────────────────────
function GatewayStep({
  plan, gateways, configLoaded, chooseGateway, onBack, loading, error,
}: {
  plan:     ChallengePlan
  gateways: { id: Gateway; label: string; sub: string; icon: React.ComponentType<{ className?: string }>; tone: string }[]
  configLoaded: boolean
  chooseGateway: (g: Gateway) => void
  onBack:   () => void
  loading:  boolean
  error:    string | null
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.25 }}
    >
      <DialogHeader>
        <DialogTitle>Payment method</DialogTitle>
        <DialogDescription>Pay {fmtUSD(plan.price)} for the {plan.name} challenge.</DialogDescription>
      </DialogHeader>

      <div className="mt-5 space-y-2">
        {!configLoaded
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          : gateways.length === 0
            ? (
              <div className="p-4 rounded-lg bg-warn-muted border border-warn/30 text-sm">
                <div className="font-medium text-warn">No payment methods available</div>
                <p className="mt-1 text-text-muted">
                  Please contact support to complete this purchase.
                </p>
              </div>
            )
            : gateways.map((g) => {
                const Icon = g.icon
                return (
                  <button
                    key={String(g.id)}
                    onClick={() => chooseGateway(g.id)}
                    disabled={loading}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-surface',
                      'hover:border-accent/60 hover:bg-surface-muted transition-all',
                      'focus-ring text-left disabled:opacity-50 disabled:pointer-events-none',
                      'group',
                    )}
                  >
                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center bg-surface-muted', g.tone)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{g.label}</div>
                      <div className="text-xs text-text-muted">{g.sub}</div>
                    </div>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin text-text-muted" /> : <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />}
                  </button>
                )
              })}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-md bg-danger-muted border border-danger/30 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <Button onClick={onBack} variant="ghost" className="w-full mt-4">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
    </motion.div>
  )
}

// ── Step 3: Manual — show instructions, upload proof ───────────────────────
function ManualStep({
  plan, gateway, config, orderId, proofFile, setProof, txnRef, setTxnRef, onBack, onSubmit, loading, error,
}: {
  plan:     ChallengePlan
  gateway:  Gateway
  config:   PaymentConfig | null
  orderId:  number | null
  proofFile: File | null
  setProof: (f: File | null) => void
  txnRef:   string
  setTxnRef: (s: string) => void
  onBack:   () => void
  onSubmit: () => void
  loading:  boolean
  error:    string | null
}) {

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.25 }}
    >
      <DialogHeader>
        <DialogTitle>Crypto payment</DialogTitle>
        <DialogDescription>
          Order <code className="text-text">#{orderId}</code> · {fmtUSD(plan.price)} due
        </DialogDescription>
      </DialogHeader>

      {/* Payment details from admin config */}
      <CryptoPayBlock config={config} />

      <div className="mt-5 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="txn">Transaction hash / ID</Label>
          <Input
            id="txn"
            value={txnRef}
            onChange={(e) => setTxnRef(e.target.value)}
            placeholder={'0x…'}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="proof">Payment proof <span className="text-text-faint">(screenshot/receipt)</span></Label>
          <label
            htmlFor="proof"
            className={cn(
              'flex items-center gap-3 p-3 rounded-md border border-dashed cursor-pointer transition-colors',
              proofFile ? 'border-success bg-success-muted' : 'border-border hover:border-accent/60 hover:bg-surface-muted',
            )}
          >
            {proofFile ? (
              <>
                <FileText className="h-4 w-4 text-success shrink-0" />
                <span className="text-sm truncate flex-1">{proofFile.name}</span>
                <span className="text-2xs text-text-muted">{(proofFile.size / 1024).toFixed(0)} KB</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 text-text-muted shrink-0" />
                <span className="text-sm text-text-muted">Click to upload (JPG/PNG/PDF, max 5MB)</span>
              </>
            )}
            <input
              id="proof"
              type="file"
              accept="image/png,image/jpeg,image/jpg,application/pdf"
              className="hidden"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-md bg-danger-muted border border-danger/30 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="sticky bottom-0 -mb-1 mt-5 flex gap-2 bg-bg/95 supports-[backdrop-filter]:bg-bg/80 backdrop-blur pt-3 pb-1">
        <Button onClick={onBack} variant="ghost" className="flex-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onSubmit}
          loading={loading}
          disabled={!proofFile || !txnRef}
          className="flex-[2]"
        >
          Submit for review
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
}

// ── Success ────────────────────────────────────────────────────────────────
function SuccessStep({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center py-4"
    >
      <div className="h-16 w-16 rounded-full bg-success-muted text-success flex items-center justify-center mx-auto mb-4 ring-4 ring-success/10">
        <Check className="h-8 w-8" strokeWidth={3} />
      </div>
      <DialogTitle>Submitted for review</DialogTitle>
      <DialogDescription className="mt-2 max-w-xs mx-auto">
        We&apos;ve received your payment proof. You&apos;ll be notified within 24 hours once it&apos;s approved
        and your challenge account is provisioned.
      </DialogDescription>
      <div className="mt-6 flex flex-col gap-2">
        <Button asChild>
          <Link href="/dashboard">
            Go to dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button onClick={onClose} variant="ghost">Close</Button>
      </div>
    </motion.div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className={cn('tabular font-medium', highlight ? 'text-success' : 'text-text')}>{value}</span>
    </div>
  )
}

// ── Crypto payment block: multi-network selector + QR + copy ─────────────────
function CryptoPayBlock({ config }: { config: PaymentConfig | null }) {
  const networks = config?.crypto_networks ?? []
  const [sel, setSel] = useState(0)

  // Fallback: legacy single address when no structured networks are configured.
  if (!networks.length) {
    return (
      <div className="mt-5 p-4 rounded-lg bg-bg-subtle border border-border-subtle space-y-3">
        <div className="text-xs uppercase tracking-wider text-text-faint">Send to address</div>
        <AddressRow address={config?.crypto_address ?? 'Loading…'} />
        {config?.instructions && (
          <div className="text-2xs text-text-muted whitespace-pre-wrap pt-1 border-t border-border-subtle">{config.instructions}</div>
        )}
      </div>
    )
  }

  const active = networks[Math.min(sel, networks.length - 1)]

  return (
    <div className="mt-5 p-4 rounded-lg bg-bg-subtle border border-border-subtle space-y-3">
      <div className="text-xs uppercase tracking-wider text-text-faint">Select network</div>
      <div className="flex flex-wrap gap-2">
        {networks.map((n, i) => (
          <button
            key={n.network}
            onClick={() => setSel(i)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
              i === sel ? 'border-accent bg-accent/10 text-accent' : 'border-border-subtle text-text-muted hover:border-accent/50',
            )}
          >
            {n.label && n.label !== n.network ? `${n.network} · ${n.label}` : n.network}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start pt-1">
        <div className="shrink-0 mx-auto sm:mx-0">
          <QrCode value={active.address} size={148} />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-2xs uppercase tracking-wider text-text-faint">{active.network} address</div>
          <AddressRow address={active.address} />
          {active.instructions && (
            <div className="text-2xs text-warn/90 whitespace-pre-wrap">{active.instructions}</div>
          )}
          {config?.instructions && (
            <div className="text-2xs text-text-muted whitespace-pre-wrap pt-1 border-t border-border-subtle">{config.instructions}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function AddressRow({ address }: { address: string }) {
  const copy = () => {
    try { navigator.clipboard.writeText(address); toast.success('Address copied') } catch { /* no clipboard */ }
  }
  return (
    <div className="flex items-stretch gap-2">
      <pre className="flex-1 text-xs text-text whitespace-pre-wrap break-all font-mono bg-surface p-3 rounded-md border border-border-subtle max-h-36 overflow-y-auto">{address}</pre>
      <button onClick={copy} className="shrink-0 px-2.5 rounded-md border border-border-subtle text-text-muted hover:text-accent hover:border-accent/50 transition-colors" aria-label="Copy address">
        <Copy className="h-4 w-4" />
      </button>
    </div>
  )
}
