'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, BarChart3, Clock, ListOrdered, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ShoppingCart, CheckCircle2, XCircle } from 'lucide-react'

import { api } from '@/lib/api'
import { useTerminal } from '@/store/terminal'
import { usePrices } from '@/store/prices'
import { useVisibilityPoll } from '@/hooks/use-visibility-poll'
import { useMediaQuery } from '@/hooks/use-media-query'
import { fmtPrice, toNum, fmtUSD, fmtPct, pnlClass } from '@/lib/format'
import { symbolDigits } from '@/lib/symbol-meta'
import type { Account, NoChallengeResp, Position, PendingOrder, ChallengeAccount } from '@/types/api'

import { MarketWatch }        from '@/components/dashboard/trading/market-watch'
import { ChartPanel }         from '@/components/dashboard/trading/chart-panel'
import { OrderTicket }        from '@/components/dashboard/trading/order-ticket'
import { PositionsTable }     from '@/components/dashboard/trading/positions-table'
import { PendingOrdersTable } from '@/components/dashboard/trading/pending-orders-table'
import { AccountStrip }       from '@/components/dashboard/trading/account-strip'
import { AccountSwitcher }    from '@/components/dashboard/trading/account-switcher'
import { MobileBottomSheet }  from '@/components/dashboard/trading/mobile-bottom-sheet'
import { cn }                 from '@/lib/cn'

function isAccount(x: Account | NoChallengeResp | null): x is Account {
  return !!x && (x as Account).balance !== undefined && !(x as NoChallengeResp).no_challenge
}

type Tab = 'positions' | 'pending'

export default function TradingTerminalPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const bootstrapTerm = useTerminal((s) => s.bootstrap)
  const refreshSymbols = useTerminal((s) => s.refreshSymbols)
  const symbolsLoaded = useTerminal((s) => s.symbolsLoaded)
  const active        = useTerminal((s) => s.active)

  // Local state for live data — owned here so the entire page coordinates one refresh
  const [account,   setAccount]   = useState<Account | NoChallengeResp | null>(null)
  const [positions, setPositions] = useState<Position[] | null>(null)
  const [pending,   setPending]   = useState<PendingOrder[] | null>(null)
  const [chs,       setChs]       = useState<ChallengeAccount[] | null>(null)
  const [loaded,    setLoaded]    = useState(false)

  // Bootstrap symbols once
  useEffect(() => { bootstrapTerm() }, [bootstrapTerm])

  // BUG-011 (Defect A): keep the symbol list in sync with admin activation
  // changes — revalidate on mount and every 30s while the terminal is open, and
  // again when the tab regains focus. No Disable/Enable cycle or manual refresh
  // is ever needed for enabled symbols to appear (or disabled ones to drop).
  useVisibilityPoll(refreshSymbols, 30_000, true)

  // Start the prices stream while the terminal page is mounted
  const pricesStart = usePrices((s) => s.start)
  const pricesStop  = usePrices((s) => s.stop)
  useEffect(() => {
    pricesStart()
    return () => pricesStop()
  }, [pricesStart, pricesStop])

  // Polling: account + positions + pending. Single function so dedup helps.
  const refreshAll = async () => {
    try {
      const [acc, pos, pen] = await Promise.all([
        api.account(),
        api.positions(),
        api.pendingMine(),
      ])
      if (acc.ok) setAccount(acc.data)
      if (pos.ok) setPositions(pos.data)
      if (pen.ok) setPending(pen.data)
      if (!acc.ok || !isAccount(acc.data)) {
        const ch = await api.challengeMy()
        if (ch.ok) setChs(ch.data)
      }
    } finally {
      setLoaded(true)
    }
  }
  useVisibilityPoll(refreshAll, 4_000, true)

  const acc = isAccount(account) ? account : null
  const readOnly = acc?.read_only === true
  // No usable trading account once the first load has settled — covers both an
  // explicit no_challenge payload AND a 404 (account left null). Without the
  // `loaded` gate the page used to fall through and render the terminal with a
  // null account, leaving the stat cards as skeletons forever.
  const noChallenge = (!!account && !isAccount(account)) || (loaded && !acc)

  // Aggregate open PnL — drives AccountStrip's "P&L" tile
  const openPnL = useMemo(() => {
    if (!positions) return 0
    return positions.reduce((s, p) => s + toNum(p.pnl) + toNum(p.swap) - toNum(p.commission), 0)
  }, [positions])

  // ── No-challenge / frozen state ──────────────────────────────────────
  // read-only = a failed/passed challenge: keep the final snapshot visible but
  // freeze trading. Funded/active accounts trade normally.
  if (noChallenge || readOnly) {
    return <TradingLockState accounts={chs} account={acc} challengeStatus={acc?.challenge_status ?? null} />
  }

  // ── Loading state ────────────────────────────────────────────────────
  if (!symbolsLoaded && positions === null) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-sm text-text-muted">
          <div className="h-7 w-7 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          Loading terminal…
        </div>
      </div>
    )
  }

  // ── Render layout ────────────────────────────────────────────────────
  return isDesktop
    ? <DesktopLayout account={acc} openPnL={openPnL} positions={positions} pending={pending} onChanged={refreshAll} />
    : <MobileLayout  account={acc} openPnL={openPnL} positions={positions} pending={pending} onChanged={refreshAll} />
}

// ── Desktop ─────────────────────────────────────────────────────────────

function DesktopLayout({
  account, openPnL, positions, pending, onChanged,
}: {
  account: Account | null
  openPnL: number
  positions: Position[] | null
  pending: PendingOrder[] | null
  onChanged: () => void
}) {
  const [tab, setTab] = useState<Tab>('positions')
  // Collapsible positions panel — auto-collapses on trading page open, remembered across sessions.
  const [posCollapsed, setPosCollapsed] = useState(true)
  useEffect(() => {
    // Always start collapsed on terminal open for maximum chart space
    setPosCollapsed(true)
    try { localStorage.setItem('fxsim:term:pos', '1') } catch { /* private mode */ }
  }, [])
  const togglePos = () => {
    setPosCollapsed((v) => {
      const next = !v
      try { localStorage.setItem('fxsim:term:pos', next ? '1' : '0') } catch { /* private mode */ }
      return next
    })
  }
  // Collapsible market-watch pane — state remembered across sessions.
  const [mwCollapsed, setMwCollapsed] = useState(true)
  const [otCollapsed, setOtCollapsed] = useState(false)
  const toggleOt = () => {
    setOtCollapsed((v) => {
      const next = !v
      try { localStorage.setItem('fxsim:term:ot', next ? '1' : '0') } catch { /* private mode */ }
      return next
    })
  }
  useEffect(() => {
    // Always start collapsed on terminal open for maximum chart space
    setMwCollapsed(true)
    try { localStorage.setItem('fxsim:term:mw', '1') } catch { /* private mode */ }
  }, [])
  const toggleMw = () => {
    setMwCollapsed((v) => {
      const next = !v
      try { localStorage.setItem('fxsim:term:mw', next ? '1' : '0') } catch { /* private mode */ }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100dvh-6.5rem)] min-h-[640px]">
      {/* Three-pane grid — left pane collapses to reclaim chart width.
          Side panes use clamp() so they shrink on 1366–1440 laptops (giving the
          chart its proper share) while staying full-width on large monitors.
          MarketWatch: 210px→260px, OrderTicket: 264px→320px across the viewport. */}
      <div
        className="flex-1 min-h-0 grid gap-3"
        style={{ gridTemplateColumns: `${mwCollapsed ? '44px' : 'clamp(210px, 17vw, 260px)'} minmax(0,1fr) ${otCollapsed ? '44px' : 'clamp(264px, 21vw, 320px)'}` }}
      >
        {/* Left: market watch (collapsible) */}
        {mwCollapsed ? (
          <aside onClick={toggleMw} className="rounded-lg border border-border bg-surface flex flex-col items-center pt-2 cursor-pointer hover:bg-surface-muted transition-colors">
            <button
              onClick={(e) => e.stopPropagation()}
              onClickCapture={toggleMw}
              className="h-8 w-8 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring"
              aria-label="Show market watch"
              title="Show market watch"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
            <span className="mt-3 text-2xs font-semibold uppercase tracking-wider text-text-faint [writing-mode:vertical-rl] rotate-180">
              Market watch
            </span>
          </aside>
        ) : (
          <aside className="rounded-lg border border-border bg-surface flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3 py-2.5 border-b border-border-subtle flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Market watch</h3>
              <button
                onClick={toggleMw}
                className="h-6 w-6 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring"
                aria-label="Hide market watch"
                title="Hide market watch"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
            <MarketWatch />
          </aside>
        )}

        {/* Center: chart + tabs */}
        <div
          className="grid gap-3 min-h-0"
          style={{ gridTemplateRows: posCollapsed ? '1fr 44px' : '1fr minmax(0,260px)' }}
        >
          <section className="rounded-lg border border-border bg-surface overflow-hidden flex flex-col min-h-0">
            <ChartPanel positions={positions} />
          </section>
          <section className="rounded-lg border border-border bg-surface overflow-hidden flex flex-col min-h-0">
            <div
              className={`shrink-0 flex items-center gap-1 px-3 pt-2 border-b border-border-subtle ${posCollapsed ? 'cursor-pointer hover:bg-surface-muted transition-colors' : ''}`}
              onClick={posCollapsed ? togglePos : undefined}
            >
              <TabButton active={tab === 'positions'} onClick={() => setTab('positions')}>
                Positions
                {positions && positions.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-muted text-accent text-2xs font-medium px-1">
                    {positions.length}
                  </span>
                )}
              </TabButton>
              <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
                Pending
                {pending && pending.filter((o) => o.status === 'pending').length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warn-muted text-warn text-2xs font-medium px-1">
                    {pending.filter((o) => o.status === 'pending').length}
                  </span>
                )}
              </TabButton>
              {/* MT5-style account metrics bar */}
              <div className="ml-auto flex items-center gap-4 pr-1">
                {account && (() => {
                  const bal  = toNum(account.balance)
                  const eq   = toNum(account.equity)
                  const used = toNum(account.margin_used)
                  const free = eq - used
                  const lvl  = used > 0 ? (eq / used) * 100 : null
                  const pnl  = openPnL ?? (eq - bal)
                  return (
                    <>
                      <span className="text-2xs text-text-muted">Balance: <span className="text-text font-medium">{fmtUSD(bal)}</span></span>
                      <span className="text-2xs text-text-muted">Equity: <span className="text-text font-medium">{fmtUSD(eq)}</span></span>
                      <span className="text-2xs text-text-muted">P&L: <span className={cn('font-medium', pnlClass(pnl))}>{fmtUSD(pnl, { sign: true })}</span></span>
                      <span className="text-2xs text-text-muted hidden lg:inline">Free margin: <span className="text-text font-medium">{fmtUSD(free)}</span></span>
                      {lvl !== null && <span className="text-2xs text-text-muted hidden xl:inline">Margin level: <span className={cn('font-medium', lvl < 100 ? 'text-danger' : lvl < 200 ? 'text-warn' : 'text-text')}>{fmtPct(lvl, 1)}</span></span>}
                    </>
                  )
                })()}
              </div>
              {/* Collapse/expand positions panel */}
              <button
                onClick={togglePos}
                className="h-6 w-6 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring"
                aria-label={posCollapsed ? 'Expand positions panel' : 'Collapse positions panel'}
                title={posCollapsed ? 'Expand positions panel' : 'Collapse positions panel'}
              >
                {posCollapsed
                  ? <PanelLeftOpen className="h-3.5 w-3.5 rotate-90" />
                  : <PanelLeftClose className="h-3.5 w-3.5 rotate-90" />
                }
              </button>
            </div>
            {!posCollapsed && (
              <div className="flex-1 overflow-y-auto min-h-0">
                {tab === 'positions'
                  ? <PositionsTable positions={positions} onChanged={onChanged} />
                  : <PendingOrdersTable orders={pending} onChanged={onChanged} />
                }
              </div>
            )}
          </section>
        </div>

        {/* Right: order ticket (collapsible) */}
        {otCollapsed ? (
          <aside onClick={toggleOt} className="rounded-lg border border-border bg-surface flex flex-col items-center pt-2 cursor-pointer hover:bg-surface-muted transition-colors">
            <button
              onClickCapture={toggleOt}
              className="h-8 w-8 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring"
              aria-label="Show order ticket"
              title="Show order ticket"
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
            <span className="mt-3 text-2xs font-semibold uppercase tracking-wider text-text-faint [writing-mode:vertical-rl]">
              New order
            </span>
          </aside>
        ) : (
          <aside className="rounded-lg border border-border bg-surface overflow-hidden flex flex-col min-h-0">
            <div className="shrink-0 px-3 py-2.5 border-b border-border-subtle flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">New order</h3>
              <div className="flex items-center gap-1.5">
                <AccountSwitcher onSwitched={onChanged} />
                <button
                  onClick={toggleOt}
                  className="h-6 w-6 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted focus-ring"
                  aria-label="Hide order ticket"
                  title="Hide order ticket"
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <OrderTicket account={account} />
          </aside>
        )}
      </div>
    </div>
  )
}

function TabButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative h-9 px-3 text-xs font-medium transition-colors focus-ring',
        active ? 'text-text' : 'text-text-muted hover:text-text',
      )}
    >
      {children}
      {active && (
        <motion.span
          layoutId="trading-tab-indicator"
          className="absolute inset-x-0 -bottom-px h-0.5 bg-accent rounded-full"
          transition={{ type: 'spring', damping: 28, stiffness: 380 }}
        />
      )}
    </button>
  )
}

// ── Mobile ──────────────────────────────────────────────────────────────

function MobileLayout({
  account, openPnL, positions, pending, onChanged,
}: {
  account: Account | null
  openPnL: number
  positions: Position[] | null
  pending: PendingOrder[] | null
  onChanged: () => void
}) {
  type Sheet = null | 'watchlist' | 'order' | 'positions' | 'pending'
  const [sheet, setSheet] = useState<Sheet>(null)
  const active = useTerminal((s) => s.active)
  const getMeta = useTerminal((s) => s.getMeta)
  const tick = usePrices((s) => s.prices[active])
  const meta = getMeta(active)
  const digits = meta?.digits || symbolDigits(active)
  const bid = toNum(tick?.bid)
  const ask = toNum(tick?.ask)

  return (
    <div className="flex flex-col gap-3 h-[calc(100dvh-6rem)] -mx-3 -my-3 md:-mx-4 md:-my-4">
      {/* Account strip — compact */}
      <div className="px-4 pt-4 shrink-0 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <AccountStrip account={account} openPnL={openPnL} compact />
        </div>
        <AccountSwitcher onSwitched={onChanged} />
      </div>

      {/* Chart — fills remaining space; ChartPanel header has symbol + tap-to-change */}
      <div className="flex-1 mx-4 rounded-lg border border-border overflow-hidden min-h-0">
        <ChartPanel compact positions={positions} onOpenWatchlist={() => setSheet('watchlist')} />
      </div>

      {/* Bottom dock — tab strip + floating buy/sell */}
      <div className="shrink-0 relative">
        <div className="grid grid-cols-3 gap-1 mx-4 mb-3 p-1 rounded-md bg-surface border border-border text-2xs">
          <DockButton
            icon={BarChart3}
            label="Markets"
            onClick={() => setSheet('watchlist')}
          />
          <DockButton
            icon={ListOrdered}
            label="Positions"
            count={positions?.length}
            onClick={() => setSheet('positions')}
          />
          <DockButton
            icon={Clock}
            label="Pending"
            count={pending?.filter((o) => o.status === 'pending').length}
            onClick={() => setSheet('pending')}
          />
        </div>
      </div>

      {/* Floating order FAB — anchored bottom-right above safe area */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 280, delay: 0.2 }}
        onClick={() => setSheet('order')}
        className={cn(
          'fixed right-4 z-30',
          'h-14 w-14 rounded-full bg-gradient-to-br from-accent to-success',
          'shadow-glow flex items-center justify-center',
          'focus-ring active:scale-95 transition-transform',
        )}
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        aria-label="Open order ticket"
      >
        <span className="grid place-items-center text-white">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </motion.button>

      {/* Bottom sheets */}
      <MobileBottomSheet
        open={sheet === 'watchlist'}
        onClose={() => setSheet(null)}
        title="Markets"
        height={0.8}
      >
        <MarketWatch onPick={() => setSheet(null)} />
      </MobileBottomSheet>

      <MobileBottomSheet
        open={sheet === 'order'}
        onClose={() => setSheet(null)}
        title={`Trade ${active}`}
        height={0.92}
      >
        <OrderTicket compact account={account} onSubmitted={() => setSheet(null)} />
      </MobileBottomSheet>

      <MobileBottomSheet
        open={sheet === 'positions'}
        onClose={() => setSheet(null)}
        title={`Positions${positions?.length ? ` (${positions.length})` : ''}`}
        height={0.8}
      >
        <div className="flex-1 overflow-y-auto">
          <PositionsTable positions={positions} onChanged={onChanged} compact />
        </div>
      </MobileBottomSheet>

      <MobileBottomSheet
        open={sheet === 'pending'}
        onClose={() => setSheet(null)}
        title="Pending orders"
        height={0.8}
      >
        <div className="flex-1 overflow-y-auto">
          <PendingOrdersTable orders={pending} onChanged={onChanged} />
        </div>
      </MobileBottomSheet>
    </div>
  )
}

function DockButton({
  icon: Icon, label, count, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-0.5 h-12 rounded text-text-muted hover:text-text hover:bg-surface-muted/50 focus-ring transition-colors active:scale-95"
    >
      <Icon className="h-4 w-4" />
      <span className="text-2xs font-medium">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="absolute top-1 right-2 h-4 min-w-4 px-1 inline-flex items-center justify-center rounded-full bg-accent text-white text-2xs font-medium">
          {count}
        </span>
      )}
    </button>
  )
}

// ── No-challenge state ──────────────────────────────────────────────────

function TradingLockState({ accounts, account, challengeStatus }: {
  accounts: ChallengeAccount[] | null
  account?: Account | null
  challengeStatus?: string | null
}) {
  const passed = challengeStatus === 'passed' || !!accounts?.some((a) => a.status === 'passed')
  const failed = challengeStatus === 'failed' || !!accounts?.some((a) => a.status === 'failed')
  const funded = challengeStatus === 'funded'
  const reason: 'no_challenge' | 'phase_passed' | 'challenge_failed' | 'funded' =
    funded ? 'funded'
    : passed ? 'phase_passed'
    : failed ? 'challenge_failed'
    : (!accounts || accounts.length === 0) && !account ? 'no_challenge'
    : 'challenge_failed'

  const cfg = {
    no_challenge: {
      tone: 'accent' as const, icon: ShoppingCart,
      title: 'No active challenge',
      body: 'You need an active challenge to access the trading terminal. Purchase a challenge to get started.',
      cta: { href: '/challenges', label: 'Purchase Challenge' },
    },
    phase_passed: {
      tone: 'success' as const, icon: CheckCircle2,
      title: 'Phase passed — trading frozen',
      body: 'Congratulations! This phase has been passed and trading is frozen on it. Your next phase will be available shortly — check your dashboard.',
      cta: { href: '/dashboard', label: 'Go to Dashboard' },
    },
    challenge_failed: {
      tone: 'danger' as const, icon: XCircle,
      title: 'Challenge ended — trading frozen',
      body: 'This challenge has ended and trading is frozen. Your final results are shown below. You can start a new challenge whenever you’re ready.',
      cta: { href: '/challenges', label: 'Start a new challenge' },
    },
    funded: {
      tone: 'success' as const, icon: CheckCircle2,
      title: 'Funded account — trading frozen',
      body: 'This account is funded. Trading is currently frozen here; check your dashboard for next steps.',
      cta: { href: '/dashboard', label: 'Go to Dashboard' },
    },
  }[reason]

  const Icon = cfg.icon
  const bg = cfg.tone === 'success' ? 'bg-success-muted text-success'
    : cfg.tone === 'danger' ? 'bg-danger-muted text-danger' : 'bg-accent-muted text-accent'

  const statusLabel = failed ? 'Failed' : passed ? 'Passed' : funded ? 'Funded' : null

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md">
        <div className={`inline-flex h-12 w-12 rounded-xl items-center justify-center mb-4 ${bg}`}>
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{cfg.title}</h2>
        <p className="text-sm text-text-muted mt-2">{cfg.body}</p>

        {account && (
          <div className="mt-5 grid grid-cols-2 gap-2 text-left">
            {statusLabel && (
              <div className="col-span-2 flex items-center justify-between rounded-md border border-border-subtle px-3 py-2">
                <span className="text-2xs uppercase tracking-wider text-text-muted">Final status</span>
                <span className={`text-sm font-semibold ${failed ? 'text-danger' : 'text-success'}`}>{statusLabel}</span>
              </div>
            )}
            <div className="rounded-md border border-border-subtle px-3 py-2">
              <div className="text-2xs uppercase tracking-wider text-text-muted">Balance</div>
              <div className="text-sm font-semibold tabular">{fmtUSD(toNum(account.balance))}</div>
            </div>
            <div className="rounded-md border border-border-subtle px-3 py-2">
              <div className="text-2xs uppercase tracking-wider text-text-muted">Equity</div>
              <div className="text-sm font-semibold tabular">{fmtUSD(toNum(account.equity))}</div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <a href={cfg.cta.href} className="inline-flex h-10 px-5 items-center rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover focus-ring">
            {cfg.cta.label}
          </a>
        </div>
      </div>
    </div>
  )
}
