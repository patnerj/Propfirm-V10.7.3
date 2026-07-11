'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Users2, Copy, Check, DollarSign, TrendingUp, Wallet, ArrowUpRight, ExternalLink } from 'lucide-react'
import { api } from '@/lib/api'
import type { AffiliateMe, Commission, AffiliatePayout } from '@/types/api'
import { fmtUSD, timeAgo } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const tone = (s: Commission['status']) =>
  s === 'paid' ? 'success' : s === 'reversed' ? 'danger' : s === 'approved' ? 'info' : 'warn'
const payoutTone = (s: AffiliatePayout['status']) =>
  s === 'paid' ? 'success' : s === 'rejected' ? 'danger' : s === 'approved' ? 'info' : 'warn'
const METHOD_LABEL: Record<string, string> = { usdt_trc20: 'USDT (TRC20)', usdt_bep20: 'USDT (BEP20)', wise: 'Wise' }

export default function AffiliatePage() {
  const [me, setMe] = useState<AffiliateMe | null>(null)
  const [commissions, setCommissions] = useState<Commission[] | null>(null)
  const [payouts, setPayouts] = useState<AffiliatePayout[] | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [copied, setCopied] = useState(false)
  const [method, setMethod] = useState<'usdt_trc20' | 'usdt_bep20' | 'wise'>('usdt_trc20')
  const [destination, setDestination] = useState('')
  const [savingMethod, setSavingMethod] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const load = async () => {
    const r = await api.affiliateMe()
    if (r.ok) {
      setMe(r.data)
      if (r.data.payout_method) setMethod(r.data.payout_method as 'usdt_trc20' | 'usdt_bep20' | 'wise')
      if (r.data.payout_destination) setDestination(r.data.payout_destination)
      if (r.data.enrolled) {
        const [c, p] = await Promise.all([api.affiliateCommissions(), api.affiliatePayouts()])
        if (c.ok) setCommissions(c.data)
        if (p.ok) setPayouts(p.data)
      }
    }
  }
  useEffect(() => { load() }, [])

  const saveMethod = async () => {
    if (!destination.trim()) { toast.error('Enter your payout destination.'); return }
    setSavingMethod(true)
    const r = await api.affiliateSetPayout(method, destination.trim())
    setSavingMethod(false)
    if (r.ok && r.data.success) { toast.success('Payout method saved.'); load() }
    else toast.error(r.ok ? (r.data.message || 'Could not save.') : r.error)
  }

  const requestPayout = async () => {
    setRequesting(true)
    const r = await api.affiliateRequestPayout()
    setRequesting(false)
    if (r.ok && r.data.success) { toast.success(`Withdrawal requested${r.data.amount ? ` · ${fmtUSD(r.data.amount)}` : ''}.`); load() }
    else toast.error(r.ok ? (r.data.message || 'Could not request withdrawal.') : r.error)
  }

  const enroll = async () => {
    setEnrolling(true)
    const r = await api.affiliateEnroll()
    setEnrolling(false)
    if (r.ok && r.data.enrolled) { setMe(r.data); toast.success('You’re in! Here’s your referral link.'); load() }
    else toast.error('Could not enroll right now.')
  }

  const link = me?.code ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${me.code}` : ''
  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  if (!me) {
    return <div className="space-y-4 max-w-3xl"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>
  }

  if (!me.enrolled) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="h-14 w-14 rounded-xl bg-accent-muted text-accent inline-flex items-center justify-center mb-4"><Users2 className="h-7 w-7" /></div>
              <h2 className="text-xl font-semibold">Earn by referring traders</h2>
              <p className="text-sm text-text-muted mt-2">Get a unique link, share it, and earn a commission on every challenge your referrals purchase.</p>
              <Button className="mt-6" onClick={enroll} disabled={enrolling}>{enrolling ? 'Setting up…' : 'Join the affiliate program'}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const s = me.stats!
  const cards = [
    { label: 'Referrals', value: String(s.referrals), icon: Users2 },
    { label: 'Conversions', value: String(s.conversions), icon: TrendingUp },
    { label: 'Unpaid earnings', value: fmtUSD(s.unpaid), icon: Wallet },
    { label: 'Paid out', value: fmtUSD(s.paid), icon: DollarSign },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Affiliate dashboard</h1>
        <p className="text-sm text-text-muted mt-1">Your commission rate is <span className="text-text font-medium">{me.rate_percent}%</span> of each referred purchase.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Your referral link</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input readOnly value={link} className="flex-1 h-10 rounded-md bg-bg-subtle border border-border-subtle px-3 text-sm font-mono" />
            <Button variant="outline" onClick={copy}>{copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}</Button>
          </div>
          <p className="text-2xs text-text-muted mt-1.5">Code: <span className="font-mono">{me.code}</span></p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label}><CardContent className="p-4">
              <div className="flex items-center gap-2 text-text-muted text-2xs uppercase tracking-wider"><Icon className="h-3.5 w-3.5" /> {c.label}</div>
              <div className="text-xl font-bold tabular mt-1">{c.value}</div>
            </CardContent></Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Withdrawals</CardTitle>
          <p className="text-2xs text-text-muted mt-1">Paid via crypto (USDT) or Wise. Set your destination, then request a withdrawal of your available balance.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-2xs text-text-muted uppercase tracking-wider">Payout method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as 'usdt_trc20' | 'usdt_bep20' | 'wise')}
                className="w-full h-10 rounded-md bg-bg-subtle border border-border-subtle px-3 text-sm"
              >
                <option value="usdt_trc20">USDT — TRC20</option>
                <option value="usdt_bep20">USDT — BEP20</option>
                <option value="wise">Wise</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-2xs text-text-muted uppercase tracking-wider">{method === 'wise' ? 'Wise email' : 'Wallet address'}</label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={method === 'wise' ? 'you@example.com' : method === 'usdt_trc20' ? 'T…' : '0x…'}
                className="w-full h-10 rounded-md bg-bg-subtle border border-border-subtle px-3 text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-text-muted">Available to withdraw: </span>
              <span className="font-bold tabular text-success">{fmtUSD(me.available_balance ?? 0)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={saveMethod} disabled={savingMethod}>Save method</Button>
              <Button onClick={requestPayout} disabled={requesting || (me.available_balance ?? 0) <= 0}>
                <ArrowUpRight className="h-4 w-4" /> Request withdrawal
              </Button>
            </div>
          </div>

          {payouts && payouts.length > 0 && (
            <div className="rounded-lg border border-border-subtle divide-y divide-border-subtle">
              {payouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm tabular">{fmtUSD(Number(p.amount))}</span>
                      <Badge tone={payoutTone(p.status)}>{p.status}</Badge>
                    </div>
                    <div className="text-2xs text-text-muted mt-0.5">
                      {METHOD_LABEL[p.method] || p.method} · {timeAgo(p.created_at_iso || p.created_at)}
                      {p.tx_reference ? <> · ref <span className="font-mono">{p.tx_reference}</span></> : null}
                      {p.admin_note ? <> · {p.admin_note}</> : null}
                    </div>
                  </div>
                  {p.proof_url && (
                    <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text shrink-0" title="Payment proof">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Commission history</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!commissions ? (
            <div className="p-5 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : commissions.length === 0 ? (
            <div className="p-10 text-center text-sm text-text-muted">No commissions yet. Share your link to start earning.</div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {commissions.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm tabular">{fmtUSD(c.amount)}</div>
                    <div className="text-2xs text-text-muted">{c.rate_percent}% of {fmtUSD(c.base_amount)} · {timeAgo(c.created_at_iso || c.created_at)}</div>
                  </div>
                  <Badge tone={tone(c.status)}>{c.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
