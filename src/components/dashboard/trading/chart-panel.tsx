'use client'

import { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Maximize2, Minimize2, ArrowUp, ArrowDown, PencilRuler } from 'lucide-react'
import { useTerminal } from '@/store/terminal'
import { usePrices } from '@/store/prices'
import { tvSymbol, tvInterval, symbolDigits, parseTvMap } from '@/lib/symbol-meta'
import { useBranding } from '@/store/branding'
import { fmtPrice, fmtUSD, toNum, pnlClass } from '@/lib/format'
import type { Position } from '@/types/api'

interface Props {
  compact?: boolean
  /** Open positions — used to overlay live execution-feed levels on the chart. */
  positions?: Position[] | null
  /** Mobile: callback to open the market watch sheet */
  onOpenWatchlist?: () => void
}

// Default interval the chart opens on. Users change timeframe with TradingView's
// own built-in controls (we no longer render a duplicate row), and because the
// widget is only rebuilt on symbol change, drawings persist across tf changes.
const DEFAULT_TF = '1h'

// V10.5 — session widget cache (desktop): keep up to N recent TradingView
// widget instances alive and toggle their visibility instead of destroying
// them on every symbol switch. Drawings live inside each widget's iframe, so
// while an instance survives, its drawings survive — SESSION-based retention
// only (refresh/logout/device change still reset; that requires the Charting
// Library). Uses only documented widget construction — no iframe access.
const WIDGET_CACHE_MAX = 3
const MOBILE_DRAW_KEY  = 'fxsim:chart:mobile-draw'

declare global {
  interface Window { TradingView?: { widget: new (cfg: Record<string, unknown>) => unknown } }
}

let tvScriptPromise: Promise<void> | null = null

function loadTvScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.TradingView) return Promise.resolve()
  if (tvScriptPromise) return tvScriptPromise
  tvScriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src   = 'https://s3.tradingview.com/tv.js'
    s.async = true
    s.onload  = () => resolve()
    s.onerror = () => { tvScriptPromise = null; reject(new Error('TradingView script failed to load')) }
    document.head.appendChild(s)
  })
  return tvScriptPromise
}

export const ChartPanel = memo(function ChartPanel({ compact, positions, onOpenWatchlist }: Props) {
  const active  = useTerminal((s) => s.active)
  const meta    = useTerminal((s) => s.getMeta(active))
  const metaRef = useRef(meta)
  useEffect(() => { metaRef.current = meta }, [meta])
  const tick    = usePrices((s) => s.prices[active])

  // Open positions on the *active* symbol — drawn as execution-feed overlays.
  const symPositions = (positions ?? []).filter((p) => p.symbol === active)

  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef    = useRef<unknown>(null)
  const wrapRef      = useRef<HTMLDivElement>(null)
  const [ready, setReady]   = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [fullscreen, setFs] = useState(false)

  // Admin chart-symbol overrides (Settings → Trading Feed), via the branding store.
  const rawTvMap = useBranding((s) => s.branding.tv_symbol_map)
  const tvMap    = useMemo(() => parseTvMap(rawTvMap), [rawTvMap])

  // Mobile drawing toolbar — user-controlled, persisted per device.
  const [mobileDraw, setMobileDraw] = useState(false)
  const mobileDrawRef = useRef(false)
  useEffect(() => {
    try {
      const v = localStorage.getItem(MOBILE_DRAW_KEY) === '1'
      mobileDrawRef.current = v
      setMobileDraw(v)
    } catch { /* private mode */ }
  }, [])
  const toggleMobileDraw = useCallback(() => {
    setMobileDraw((v) => {
      const next = !v
      mobileDrawRef.current = next
      try { localStorage.setItem(MOBILE_DRAW_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }, [])

  // Session widget cache (desktop only): resolved TV symbol → host element.
  const cacheRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const orderRef = useRef<string[]>([])

  // Stable ref for compact — avoids re-creating buildWidget on every render
  const compactRef = useRef(compact)
  useEffect(() => { compactRef.current = compact }, [compact])

  /** Build a TradingView widget into the given host element. */
  const buildWidget = useCallback((host: HTMLElement, resolved: string, sideToolbarHidden: boolean) => {
    const isCompact = compactRef.current
    const id = `tv-chart-${Math.random().toString(36).slice(2, 9)}`
    const inner = document.createElement('div')
    inner.id = id
    inner.style.height = '100%'
    inner.style.width  = '100%'
    host.appendChild(inner)
    return new window.TradingView!.widget({
      container_id:        id,
      autosize:            true,
      symbol:              resolved,
      interval:            tvInterval(DEFAULT_TF),
      timezone:            'Etc/UTC',
      theme:               'dark',
      style:               '1',
      locale:              'en',
      toolbar_bg:          '#0a0f1a',
      enable_publishing:   false,
      hide_side_toolbar:   sideToolbarHidden,
      hide_top_toolbar:    false,
      hide_legend:         !!isCompact,
      allow_symbol_change: false,
      save_image:          false,
      withdateranges:      true,
      backgroundColor:     'rgba(10,15,26,0)',
      gridColor:           'rgba(255,255,255,0.04)',
      disabled_features:   ['volume_force_overlay', 'create_volume_indicator_by_default'],
      enabled_features:    ['show_symbol_logos'],
    })
  }, [])

  // Widget lifecycle.
  //  • Mobile (compact): single instance, rebuilt on symbol or toolbar-toggle
  //    change — caching multiple heavyweight iframes isn't worth it on phones.
  //  • Desktop: LRU cache of up to WIDGET_CACHE_MAX instances keyed by the
  //    RESOLVED TradingView symbol. Switching to a cached symbol reuses its
  //    live iframe (drawings intact); only cache-evicted, terminal-exit, or
  //    session-end destroys a widget. Timeframe changes use TradingView's own
  //    toolbar and never touch the widget at all.
  useEffect(() => {
    let cancelled = false
    setError(null)
    const category = (metaRef.current as { category?: string } | null | undefined)?.category
    const resolved = tvSymbol(active, tvMap, category)

    loadTvScript().then(() => {
      if (cancelled || !containerRef.current || !window.TradingView) return

      // ── Mobile: simple single-instance path ──
      if (compactRef.current) {
        setReady(false)
        containerRef.current.innerHTML = ''
        try {
          widgetRef.current = buildWidget(containerRef.current, resolved, !mobileDrawRef.current)
          setReady(true)
        } catch (e) { setError((e as Error).message || 'Chart failed to load') }
        return
      }

      // ── Desktop: session cache ──
      const cache = cacheRef.current
      const order = orderRef.current

      // Hide every cached host, then show (or create) the active one.
      for (const el of cache.values()) el.style.display = 'none'

      let host = cache.get(resolved)
      if (host) {
        host.style.display = 'block'
        // LRU touch
        orderRef.current = [...order.filter((k) => k !== resolved), resolved]
        // Hidden iframes can mis-measure; nudge TradingView's autosize.
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
        setReady(true)
        return
      }

      setReady(false)
      host = document.createElement('div')
      host.style.position = 'absolute'
      host.style.inset = '0'
      containerRef.current.appendChild(host)
      try {
        buildWidget(host, resolved, false)
        cache.set(resolved, host)
        orderRef.current = [...order, resolved]
        // Evict least-recently-used beyond the cap — true destruction.
        while (orderRef.current.length > WIDGET_CACHE_MAX) {
          const evict = orderRef.current.shift()!
          const el = cache.get(evict)
          if (el) { el.remove(); cache.delete(evict) }
        }
        setReady(true)
      } catch (e) { setError((e as Error).message || 'Chart failed to load') }
    }).catch((e: Error) => {
      if (!cancelled) setError(e.message || 'Chart unavailable')
    })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tvMap])

  // Destroy everything only when the trader actually leaves the terminal
  // (component unmount) — never on symbol switches.
  useEffect(() => {
    const container = containerRef.current
    const cache = cacheRef.current
    return () => {
      cache.clear()
      orderRef.current = []
      if (container) container.innerHTML = ''
      widgetRef.current = null
    }
  }, [])

  // Fullscreen toggle (desktop convenience)
  const toggleFs = useCallback(async () => {
    const el = wrapRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.()
        setFs(true)
      } else {
        await document.exitFullscreen?.()
        setFs(false)
      }
    } catch { /* user-denied or unsupported */ }
  }, [])

  useEffect(() => {
    const onFsChange = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const digits = meta?.digits || symbolDigits(active)
  const bid = toNum(tick?.bid)
  const ask = toNum(tick?.ask)
  const mid = bid && ask ? (bid + ask) / 2 : 0

  return (
    <div ref={wrapRef} className="flex flex-col h-full min-h-0 bg-surface relative">
      {/* Header — symbol info + timeframe selector */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-bg-subtle/40">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={compact && onOpenWatchlist ? onOpenWatchlist : undefined}
            className={compact && onOpenWatchlist ? 'min-w-0 text-left hover:opacity-80 transition-opacity' : 'min-w-0 text-left cursor-default'}
          >
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold tabular truncate">{active}</span>
              {meta && (
                <span className="text-2xs text-text-muted truncate hidden sm:inline">
                  · {meta.display_name}
                </span>
              )}
              {compact && onOpenWatchlist && (
                <span className="text-2xs text-accent truncate sm:hidden">· tap to change</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-2xs tabular">
              <span className="text-text-faint uppercase tracking-wider mr-0.5">Exec</span>
              <span className="text-success">{bid ? fmtPrice(bid, digits) : '—'}</span>
              <span className="text-text-faint">/</span>
              <span className="text-danger">{ask ? fmtPrice(ask, digits) : '—'}</span>
            </div>
          </button>
        </div>

        {/* Timeframe + drawing tools are provided by TradingView's own toolbars
            (no duplicate row here). */}

        {/* Mobile drawing toolbar toggle — the user decides (persisted per device) */}
        {compact && (
          <button
            onClick={toggleMobileDraw}
            className={`shrink-0 ml-auto h-7 px-2 inline-flex items-center gap-1 rounded text-2xs focus-ring ${mobileDraw ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text hover:bg-surface-muted/50'}`}
            aria-pressed={mobileDraw}
            aria-label="Toggle drawing tools"
          >
            <PencilRuler className="h-3.5 w-3.5" /> Draw
          </button>
        )}

        {/* Fullscreen */}
        {!compact && (
          <button
            onClick={toggleFs}
            className="shrink-0 ml-auto h-7 w-7 inline-flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-muted/50 focus-ring"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Chart host */}
      <div className="relative flex-1 min-h-0" style={{ touchAction: 'pan-y' }}>
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface z-[1]">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 text-xs text-text-muted"
            >
              <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              Loading chart…
            </motion.div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <div>
              <div className="text-sm text-text-muted">Chart temporarily unavailable</div>
              <div className="text-2xs text-text-faint mt-1">{error}</div>
            </div>
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0" />

      </div>

      {/* Chart data disclosure + session-retention note */}
      <div className="shrink-0 px-3 py-1 border-t border-border-subtle bg-bg-subtle/30 text-[10px] leading-tight text-text-faint flex flex-wrap gap-x-3 gap-y-0.5">
        <span>Chart data is provided by TradingView reference feeds. Trade execution and challenge evaluation use platform pricing.</span>
        {!compact && (
          <span>Recent chart drawings remain available while working between your recent charts during the current session.</span>
        )}
      </div>
    </div>
  )
})

// Compact overlay card: one open position's live execution levels.
// All values come from the sim execution feed (current_price / pnl), not the chart.
function ExecLevelRow({ pos, digits }: { pos: Position; digits: number }) {
  const isBuy = pos.type === 'buy'
  const live  = toNum(pos.current_price)
  const entry = toNum(pos.open_price)
  const sl    = pos.sl != null && pos.sl !== '' ? toNum(pos.sl) : null
  const tp    = pos.tp != null && pos.tp !== '' ? toNum(pos.tp) : null
  const pnl   = toNum(pos.pnl) + toNum(pos.swap) - toNum(pos.commission)

  return (
    <div className="rounded-md bg-bg/80 backdrop-blur border border-border-subtle px-2.5 py-1.5 text-2xs shadow-card">
      <div className="flex items-center gap-2 flex-wrap tabular">
        <span className={`inline-flex items-center gap-0.5 font-semibold ${isBuy ? 'text-success' : 'text-danger'}`}>
          {isBuy ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {isBuy ? 'BUY' : 'SELL'} {toNum(pos.lot_size)}
        </span>
        <span className="text-text-muted">Entry <span className="text-text">{fmtPrice(entry, digits)}</span></span>
        <span className="text-text-muted">Live <span className="text-text">{live ? fmtPrice(live, digits) : '—'}</span></span>
        {sl !== null && <span className="text-text-muted">SL <span className="text-danger">{fmtPrice(sl, digits)}</span></span>}
        {tp !== null && <span className="text-text-muted">TP <span className="text-success">{fmtPrice(tp, digits)}</span></span>}
        <span className={`font-semibold ${pnlClass(pnl)}`}>{fmtUSD(pnl, { sign: true })}</span>
      </div>
    </div>
  )
}
