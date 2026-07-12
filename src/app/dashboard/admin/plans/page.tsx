'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Plus, Pencil, Layers } from 'lucide-react'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { fmtUSD, fmtPct, toNum } from '@/lib/format'
import type { ChallengePlan } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<ChallengePlan[] | null>(null)
  const [editing, setEditing] = useState<Partial<ChallengePlan> | null>(null)

  const refresh = useCallback(async () => {
    const res = await api.admin.plansList()
    if (res.ok) setPlans(res.data)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Challenge plans</h1>
          <p className="text-sm text-text-muted mt-1">Pricing tiers, rules, leverage caps, and trading conditions.</p>
        </div>
        <Button onClick={() => setEditing({ phases: 2, is_active: 1, sort_order: 0, currency: 'USD' } as Partial<ChallengePlan>)}>
          <Plus className="h-4 w-4" /> New plan
        </Button>
      </div>

      {plans === null ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i} className="p-5"><Skeleton className="h-40 w-full" /></Card>)}
        </div>
      ) : plans.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Layers className="h-8 w-8 mx-auto text-text-faint mb-3" />
          <div className="text-sm">No plans configured yet</div>
          <Button className="mt-4" onClick={() => setEditing({ phases: 2, is_active: 1, sort_order: 0, currency: 'USD' } as Partial<ChallengePlan>)}>
            Create your first plan
          </Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(i * 0.04, 0.25) }}
            >
              <PlanCard plan={p} onEdit={() => setEditing(p)} />
            </motion.div>
          ))}
        </div>
      )}

      {editing && (
        <PlanDialog
          plan={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidateFxsim('/admin/plans'); refresh() }}
        />
      )}
    </div>
  )
}

function PlanCard({ plan: p, onEdit }: { plan: ChallengePlan; onEdit: () => void }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight truncate">{p.name}</h3>
          <div className="text-2xs text-text-muted tabular mt-0.5">{fmtUSD(p.account_size, { decimals: 0 })} account</div>
        </div>
        <div className="flex items-center gap-2">
          {p.is_active === 1 ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
          <button onClick={onEdit} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-surface-muted focus-ring" aria-label="Edit plan">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="text-2xl font-bold tabular mb-3">{fmtUSD(p.price)}</div>
      <div className="space-y-1.5 text-2xs">
        <KV label="Phases"             value={String(p.phases)} />
        <KV label="P1 profit target"   value={fmtPct(p.p1_profit_target)} />
        <KV label="P1 max DD"          value={fmtPct(p.p1_max_dd)} />
        {p.phases > 1 && <KV label="P2 profit target" value={fmtPct(p.p2_profit_target)} />}
        <KV label="Profit split"       value={fmtPct(p.funded_profit_split)} />
        <KV label="Max leverage"       value={`1:${p.max_leverage}`} />
      </div>
    </Card>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-muted">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  )
}

function PlanDialog({ plan, onClose, onSaved }: {
  plan: Partial<ChallengePlan>
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Partial<ChallengePlan>>(plan)
  const [busy, setBusy] = useState(false)

  const update = <K extends keyof ChallengePlan>(k: K, v: ChallengePlan[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const submit = async () => {
    if (!draft.name?.trim() || !draft.account_size || !draft.price) {
      toast.error('Name, account size, and price are required'); return
    }
    setBusy(true)
    const res = await api.admin.planSave(draft)
    setBusy(false)
    if (res.ok && res.data.success) {
      toast.success(plan.id ? 'Plan updated' : 'Plan created')
      onSaved()
    } else {
      toast.error(res.ok ? 'Save failed' : res.error)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan.id ? `Edit plan — ${plan.name}` : 'New plan'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <Section title="Basics">
            <div className="grid grid-cols-2 gap-3">
              <NumOrTextField label="Name" value={draft.name} onChange={(v) => update('name', v as string)} text />
              <NumOrTextField label="Account size (USD)" value={draft.account_size} onChange={(v) => update('account_size', v as number)} />
              <NumOrTextField label="Price (USD)" value={draft.price} onChange={(v) => update('price', v as number)} />
              <NumOrTextField label="Phases (1 or 2)" value={draft.phases} onChange={(v) => update('phases', v as number)} />
            </div>
          </Section>

          <Section title="Phase 1 rules">
            <div className="grid grid-cols-2 gap-3">
              <NumOrTextField label="Profit target %" value={draft.p1_profit_target} onChange={(v) => update('p1_profit_target', v as number)} />
              <NumOrTextField label="Max DD %"        value={draft.p1_max_dd}        onChange={(v) => update('p1_max_dd', v as number)} />
              <NumOrTextField label="Daily DD %"      value={draft.p1_daily_dd}      onChange={(v) => update('p1_daily_dd', v as number)} />
              <NumOrTextField label="Min trading days" value={draft.p1_min_days}     onChange={(v) => update('p1_min_days', v as number)} />
            </div>
          </Section>

          {(toNum(draft.phases) > 1) && (
            <Section title="Phase 2 rules">
              <div className="grid grid-cols-2 gap-3">
                <NumOrTextField label="Profit target %" value={draft.p2_profit_target} onChange={(v) => update('p2_profit_target', v as number)} />
                <NumOrTextField label="Max DD %"        value={draft.p2_max_dd}        onChange={(v) => update('p2_max_dd', v as number)} />
                <NumOrTextField label="Daily DD %"      value={draft.p2_daily_dd}      onChange={(v) => update('p2_daily_dd', v as number)} />
                <NumOrTextField label="Min trading days" value={draft.p2_min_days}     onChange={(v) => update('p2_min_days', v as number)} />
              </div>
            </Section>
          )}

          <Section title="Funded & trading rules">
            <div className="grid grid-cols-2 gap-3">
              <NumOrTextField label="Profit split %" value={draft.funded_profit_split} onChange={(v) => update('funded_profit_split', v as number)} />
              <NumOrTextField label="Max leverage" value={draft.max_leverage}          onChange={(v) => update('max_leverage', v as number)} />
              <NumOrTextField label="Max lot size" value={draft.max_lot_size}          onChange={(v) => update('max_lot_size', v as number)} />
              <NumOrTextField label="Sort order" value={draft.sort_order}              onChange={(v) => update('sort_order', v as number)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <Toggle label="News trading allowed"  value={draft.news_trading === 1}   onChange={(v) => update('news_trading',   v ? 1 : 0)} />
              <Toggle label="Weekend holding"       value={draft.weekend_holding === 1} onChange={(v) => update('weekend_holding', v ? 1 : 0)} />
              <Toggle label="Plan active (visible)" value={draft.is_active === 1}      onChange={(v) => update('is_active', v ? 1 : 0)} />
            </div>
          </Section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy}>{plan.id ? 'Save changes' : 'Create plan'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="text-2xs uppercase tracking-wider text-text-muted font-medium pb-1 border-b border-border-subtle">{title}</div>
      {children}
    </div>
  )
}

function NumOrTextField({ label, value, onChange, text }: {
  label: string
  value: number | string | undefined
  onChange: (v: number | string) => void
  text?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label className="text-2xs">{label}</Label>
      <Input
        type="text"
        inputMode={text ? undefined : 'decimal'}
        value={value ?? ''}
        onChange={(e) => onChange(text ? e.target.value : toNum(e.target.value))}
      />
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 px-3 h-10 rounded-md border border-border bg-surface cursor-pointer min-w-0">
      <span className="text-2xs min-w-0 truncate">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          value ? 'bg-success' : 'bg-surface-muted border border-border',
        )}
        aria-pressed={value}
      >
        <span className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-[18px]' : 'translate-x-0.5',
        )} />
      </button>
    </label>
  )
}
