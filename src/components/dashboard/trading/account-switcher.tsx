'use client'

/**
 * AccountSwitcher (V10.7.4a Option A)
 *
 * Lets a trader with multiple funded/active challenge accounts choose which one
 * is "active" for trading. Selection is persisted server-side (user meta), so
 * every trading/account endpoint follows it via the backend resolver — this
 * component only lists accounts and POSTs the choice, then triggers a data
 * refresh so the terminal repaints against the newly-selected account.
 *
 * Renders nothing when the user has 0 or 1 tradable account (the common case),
 * so single-account users see no change at all.
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { invalidateFxsim } from '@/lib/fxsim'
import { fmtUSD, toNum } from '@/lib/format'
import type { TradableAccount } from '@/types/api'
import { cn } from '@/lib/cn'

interface Props {
  /** Called after a successful switch so the parent can refetch account/positions. */
  onSwitched?: () => void
}

export function AccountSwitcher({ onSwitched }: Props) {
  const [accounts, setAccounts] = useState<TradableAccount[] | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [align, setAlign] = useState<'left' | 'right'>('right')
  const ref = useRef<HTMLDivElement>(null)

  async function load() {
    const res = await api.challengeAccounts()
    if (res.ok) setAccounts(res.data.accounts)
  }

  useEffect(() => { void load() }, [])

  // V10.7.5 hotfix: the switcher is used both left-positioned (dashboard header)
  // and right-positioned (trading terminal panels). A fixed anchor overflows the
  // viewport in one of those contexts, so pick left/right based on actual space
  // available when the dropdown opens (256px dropdown width, 16px safety margin).
  function toggleOpen() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const dropdownWidth = 256
      const margin = 16
      const spaceOnRight = window.innerWidth - rect.left
      setAlign(spaceOnRight >= dropdownWidth + margin ? 'left' : 'right')
    }
    setOpen((v) => !v)
  }

  // close on outside tap (mobile-friendly)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Only meaningful with 2+ tradable accounts.
  if (!accounts || accounts.length < 2) return null

  const selected = accounts.find((a) => a.selected) ?? accounts[0]

  async function choose(a: TradableAccount) {
    setOpen(false)
    if (a.selected || busy) return
    setBusy(true)
    const res = await api.selectChallenge(a.challenge_id)
    setBusy(false)
    if (res.ok) {
      // Drop cached account/positions so the terminal repaints on the new account.
      invalidateFxsim('/account')
      invalidateFxsim('/positions')
      setAccounts((prev) =>
        prev?.map((x) => ({ ...x, selected: x.challenge_id === a.challenge_id })) ?? null
      )
      onSwitched?.()
    }
  }

  const label = (a: TradableAccount) =>
    `${a.plan_name ?? fmtUSD(toNum(a.account_size), { decimals: 0 })} · ${a.status === 'funded' ? 'Funded' : 'Challenge'}`

  // V10.7.5 BUG 1 (UX): two accounts can be the SAME plan + size (e.g. "Elite
  // Challenge $50,000" twice), which is impossible to tell apart. Always show a
  // distinguishing sub-line: phase, start date, and the account id.
  const sublabel = (a: TradableAccount) => {
    const started = a.created_at
      ? new Date(a.created_at.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null
    const phase = a.status === 'funded' ? 'Funded' : `Phase ${a.phase}`
    return [phase, started ? `started ${started}` : null, `#${a.challenge_id}`].filter(Boolean).join(' · ')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch trading account"
        className={cn(
          'flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2',
          'text-xs font-medium text-text hover:bg-white/10 transition-colors min-h-[44px]',
          busy && 'opacity-60'
        )}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
        <span className="truncate max-w-[9rem]">
          {label(selected)}
          {accounts.filter((x) => label(x) === label(selected)).length > 1 && (
            <span className="text-text-faint"> #{selected.challenge_id}</span>
          )}
        </span>
        <span className="tabular-nums text-text-faint">{fmtUSD(toNum(selected.equity), { decimals: 0 })}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-text-faint transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute z-50 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#0F1729] shadow-2xl p-1.5',
            align === 'left' ? 'left-0' : 'right-0'
          )}
        >
          {accounts.map((a) => (
            <button
              key={a.challenge_id}
              role="option"
              aria-selected={a.selected}
              onClick={() => void choose(a)}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors min-h-[44px]',
                a.selected ? 'bg-accent/10' : 'hover:bg-white/5'
              )}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-text truncate">{label(a)}</span>
                <span className="block text-2xs text-text-faint">{sublabel(a)}</span>
                <span className="block text-2xs text-text-faint tabular-nums">
                  Equity {fmtUSD(toNum(a.equity))} · Bal {fmtUSD(toNum(a.balance))}
                </span>
              </span>
              {a.selected && <Check className="w-4 h-4 text-accent shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
