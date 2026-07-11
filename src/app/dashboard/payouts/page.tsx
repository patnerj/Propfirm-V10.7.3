'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useVisibilityPoll } from '@/hooks/use-visibility-poll'
import { fmtUSD, fmtDate, fmtPct, toNum, statusLabel, statusTone } from '@/lib/format'
import type { ChallengeAccount, PaymentOrder, PayoutsResp } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PayoutSummary, PayoutHistory } from '@/components/dashboard/payout-history'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Banknote, ArrowUpRight, AlertCircle, Wallet, CheckCircle2, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

type PayoutMethod = 'crypto' | 'wise'

export default function PayoutsPage() {
  const [funded,  setFunded]  = useState<ChallengeAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [savedMethod, setSavedMethod] = useState<{ method: string; address: string; details: string } | null>(null)
  const [requestFor, setRequestFor]   = useState<ChallengeAccount | null>(null)
  const [kycApproved, setKycApproved] = useState<boolean | null>(null)
  const [pdata, setPdata]             = useState<PayoutsResp | null>(null)

  const refresh = async () => {
    const [ch, pm, po] = await Promise.all([api.challengeMy(), api.payoutMethodGet(), api.payouts()])
    setLoading(false)
    if (ch.ok) setFunded(ch.data.filter((c) => c.status === 'funded'))
    if (pm.ok) setSavedMethod(pm.data)
    if (po.ok) { setPdata(po.data); setKycApproved(po.data.kyc_approved) }
  }
  useVisibilityPoll(refresh, 30_000, true)

  const totalPaid = (pdata?.history ?? [])
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + (p.trader_amount || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Payouts</h1>
        <p className="text-sm text-text-muted mt-1">Request a payout from a funded account and manage your payout method.</p>
      </div>

      {/* Summary: available · next payout · paid to date */}
      <PayoutSummary
        available={pdata?.available ?? 0}
        nextPayoutAt={pdata?.next_payout_at ?? null}
        cycleDays={pdata?.cycle_days ?? 14}
        totalPaid={totalPaid}
        loading={loading}
      />

      {/* V10.7.5 hotfix: `grid lg:grid-cols-3` left grid-template-columns unset
          below the lg breakpoint (display:grid with no explicit columns), so
          grid items didn't get the `minmax(0,1fr)` sizing Tailwind's grid-cols-N
          utilities provide. The order-history table inside could then stretch
          this whole container (and therefore the page) to its natural content
          width on mobile, even though the table itself has its own
          overflow-x-auto wrapper -- the ancestor was never constrained enough
          to make that wrapper's scroll kick in instead of the whole page
          widening. Explicit grid-cols-1 fixes the sizing at every breakpoint. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* KYC gate */}
          {kycApproved === false && (
            <Card className="border-warn/40 bg-warn-muted/20">
              <CardContent className="flex items-start gap-3 p-4">
                <ShieldAlert className="h-5 w-5 text-warn shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">KYC Required</span>
                    <Badge tone="warn">Verification needed</Badge>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Complete identity verification before requesting your first payout.
                  </p>
                  <Button asChild size="sm" className="mt-3">
                    <Link href="/dashboard/kyc">Complete verification <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Funded accounts</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <Skeleton className="h-32 w-full" />
              ) : funded.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-muted">
                  <Banknote className="h-8 w-8 mx-auto text-text-faint mb-2" />
                  You need to pass an evaluation before you can request a payout.
                </div>
              ) : funded.map((c) => {
                const profit = toNum(c.current_balance) - toNum(c.starting_balance)
                const splitPct = toNum(c.funded_profit_split ?? 80)
                const traderShare = profit > 0 ? (profit * splitPct) / 100 : 0
                return (
                  <div key={c.id} className="rounded-lg border border-border-subtle p-4 hover:border-accent transition-colors">
                    {/* V10.7.5 BUG 6 fix: a flex item defaults to `min-width:auto`, so
                        this text block refused to shrink below the intrinsic width of
                        "$50,000 · Funded Jul 10, 2026". On a narrow (mobile/WebView)
                        viewport that forced the card — and therefore the whole document —
                        wider than the screen, which is why the PAGE header rendered
                        clipped on both edges ("ayouts") and the badge was cut to "FUND".
                        It only ever happened on funded accounts because this block only
                        renders for them. `min-w-0` lets it shrink; `truncate` bounds the
                        long line; `shrink-0` stops the badge being crushed. */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{c.plan_name ?? `Challenge #${c.id}`}</div>
                        <div className="text-2xs text-text-muted tabular truncate">{fmtUSD(c.account_size ?? 0, { decimals: 0 })} · Funded {c.funded_at && fmtDate(c.funded_at)}</div>
                      </div>
                      <Badge tone="success" className="shrink-0">FUNDED</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <Stat label="Profit"      value={fmtUSD(profit, { sign: true })} tone={profit >= 0 ? 'success' : 'danger'} />
                      <Stat label={`Your share (${splitPct}%)`} value={fmtUSD(traderShare)} tone="success" />
                      <Stat label="Equity"      value={fmtUSD(c.current_balance)} />
                    </div>
                    {kycApproved === false ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href="/dashboard/kyc">Complete KYC to request <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => setRequestFor(c)}
                        disabled={profit <= 0}
                      >
                        Request payout <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {profit <= 0 && (
                      <div className="mt-2 text-2xs text-text-muted">Your account needs to be in profit before you can request a payout.</div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <PayoutHistory items={pdata?.history ?? null} loading={loading} />

          <PayoutOrdersList />
        </div>

        <div className="lg:col-span-1">
          <PayoutMethodCard savedMethod={savedMethod} onSaved={refresh} />
        </div>
      </div>

      {requestFor && (
        <RequestPayoutDialog
          challenge={requestFor}
          savedMethod={savedMethod}
          onClose={() => setRequestFor(null)}
          onSuccess={() => { setRequestFor(null); refresh() }}
        />
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  return (
    // V10.7.5 BUG 6: grid children also default to `min-width:auto`, so a long
    // value (e.g. "+$12,345.67" in a 3-col mobile grid) could overflow the row.
    // min-w-0 + truncate on BOTH lines bounds it.
    <div className="min-w-0 p-2.5 rounded-md bg-surface-muted/50 border border-border-subtle">
      <div className="text-2xs text-text-muted truncate">{label}</div>
      <div className={`text-sm font-medium tabular truncate ${tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : ''}`}>{value}</div>
    </div>
  )
}

// ── Payout method ────────────────────────────────────────────────────────

function PayoutMethodCard({ savedMethod, onSaved }: { savedMethod: { method: string; address: string; details: string } | null; onSaved: () => void }) {
  const [method,  setMethod]  = useState<PayoutMethod>((savedMethod?.method as PayoutMethod) || 'crypto')
  const [address, setAddress] = useState(savedMethod?.address ?? '')
  const [details, setDetails] = useState(savedMethod?.details ?? '')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (savedMethod) {
      setMethod((savedMethod.method as PayoutMethod) || 'crypto')
      setAddress(savedMethod.address || '')
      setDetails(savedMethod.details || '')
    }
  }, [savedMethod])

  const save = async () => {
    if (!address.trim()) { toast.error('Enter your payout address or account number'); return }
    setSaving(true)
    const res = await api.payoutMethodSave(method, address.trim(), details.trim())
    setSaving(false)
    if (res.ok) { toast.success('Payout method saved'); onSaved() }
    else        toast.error(res.error)
  }

  return (
    <Card>
      <CardHeader><CardTitle>Payout method</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: 'crypto', label: 'Crypto (USDT)', icon: Wallet },
            { id: 'wise',   label: 'Wise',          icon: Banknote },
          ] as const).map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                onClick={() => setMethod(opt.id)}
                className={`flex flex-col items-center gap-1 p-3 rounded-md border text-2xs font-medium transition-colors focus-ring ${
                  method === opt.id
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border bg-surface text-text-muted hover:text-text hover:border-border-strong'
                }`}
              >
                <Icon className="h-4 w-4" />
                {opt.label}
              </button>
            )
          })}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="addr">
            {method === 'crypto' ? 'USDT wallet address (TRC20 / BEP20)' : 'Wise email'}
          </Label>
          <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={
            method === 'crypto' ? 'T... (TRC20) or 0x... (BEP20)' : 'you@example.com'
          } />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dets">Additional details (optional)</Label>
          <Textarea id="dets" rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={
            method === 'crypto' ? 'Network: TRC20 or BEP20 (and memo/tag if required)' : 'Account holder name'
          } />
        </div>

        <Button onClick={save} loading={saving} className="w-full">Save payout method</Button>
      </CardContent>
    </Card>
  )
}

// ── Request payout dialog ────────────────────────────────────────────────

function RequestPayoutDialog({
  challenge, savedMethod, onClose, onSuccess,
}: {
  challenge: ChallengeAccount
  savedMethod: { method: string; address: string; details: string } | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [method,  setMethod]  = useState(savedMethod?.method || 'crypto')
  const [address, setAddress] = useState(savedMethod?.address ?? '')
  const [busy,    setBusy]    = useState(false)
  const [success, setSuccess] = useState(false)

  const profit = toNum(challenge.current_balance) - toNum(challenge.starting_balance)
  const splitPct = toNum(challenge.funded_profit_split ?? 80)
  const traderShare = (profit * splitPct) / 100
  const firmShare   = profit - traderShare

  const submit = async () => {
    if (!address.trim()) { toast.error('Enter your payout address'); return }
    setBusy(true)
    const res = await api.challengePayout(challenge.id, method, address.trim())
    setBusy(false)
    if (res.ok && res.data.success) { setSuccess(true); setTimeout(onSuccess, 1500) }
    else                            toast.error(res.ok ? (res.data.message ?? 'Request failed') : res.error)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request payout</DialogTitle>
          <DialogDescription>From {challenge.plan_name ?? `Challenge #${challenge.id}`}</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-6">
            <div className="h-14 w-14 rounded-full bg-success-muted text-success flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold">Payout requested</h3>
            <p className="text-sm text-text-muted mt-2">
              We&apos;ll review and approve your payout within 1 business day.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg bg-bg-subtle border border-border-subtle p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Profit on account</span>
                <span className="tabular font-medium">{fmtUSD(profit)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Your share ({splitPct}%)</span>
                <span className="tabular font-semibold text-success">{fmtUSD(traderShare)}</span>
              </div>
              <div className="flex justify-between text-2xs text-text-faint">
                <span>Firm share ({fmtPct(100 - splitPct, 0)})</span>
                <span className="tabular">{fmtUSD(firmShare)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['crypto', 'wise'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`h-9 rounded-md border text-2xs font-medium transition-colors focus-ring ${
                      method === m ? 'border-accent bg-accent-muted text-accent' : 'border-border bg-surface text-text-muted'
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payaddr">Payout address</Label>
              <Input id="payaddr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={
                method === 'crypto' ? 'USDT wallet address' : 'Wise email'
              } />
            </div>

            <div className="flex items-start gap-2 text-2xs text-text-muted">
              <AlertCircle className="h-3.5 w-3.5 text-warn shrink-0 mt-0.5" />
              <span>Payouts are reviewed within 1 business day. Once approved, funds typically arrive within 24h.</span>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="success" onClick={submit} loading={busy} disabled={!address.trim()}>
                Request {fmtUSD(traderShare)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Payment orders (purchase history) ────────────────────────────────────

function PayoutOrdersList() {
  const [orders, setOrders] = useState<PaymentOrder[] | null>(null)

  const refresh = async () => {
    const res = await api.paymentMyOrders()
    if (res.ok) setOrders(res.data)
  }
  useVisibilityPoll(refresh, 30_000, true)

  return (
    <Card>
      <CardHeader><CardTitle>Purchase order history</CardTitle></CardHeader>
      <CardContent className="p-0">
        {orders === null ? (
          <div className="p-5 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">No purchase orders yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-subtle/40">
                  <th className="text-left  px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium">Order</th>
                  <th className="text-left  px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium hidden sm:table-cell">Gateway</th>
                  <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium">Amount</th>
                  <th className="text-left  px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium hidden md:table-cell">Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border-subtle/40 last:border-0">
                    <td className="px-4 py-3 tabular text-text-muted">#{o.id}</td>
                    <td className="px-4 py-3 capitalize hidden sm:table-cell">{o.gateway}</td>
                    <td className="px-4 py-3 text-right tabular font-medium">{fmtUSD(o.amount)}</td>
                    <td className="px-4 py-3"><Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge></td>
                    <td className="px-4 py-3 text-right text-2xs text-text-muted hidden md:table-cell">{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
