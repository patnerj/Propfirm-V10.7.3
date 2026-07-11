'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { fmtUSD, fmtDate, toNum, pnlClass } from '@/lib/format'
import type { Trade } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Calendar, Search, ChevronDown, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'

export default function HistoryPage() {
  const [trades, setTrades]   = useState<Trade[]>([])
  const [cursor, setCursor]   = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell' | 'win' | 'loss'>('all')

  const loadInitial = async () => {
    setLoading(true)
    const res = await api.history()
    setLoading(false)
    if (!res.ok) { setError(res.error || 'Could not load trade history.'); setHasMore(false); return }
    setError(null)
    setTrades(res.data.trades ?? [])
    setCursor(res.data.next_cursor)
    setHasMore(!!res.data.has_more)
  }

  const loadMore = async () => {
    if (!hasMore || cursor == null) return
    setLoadingMore(true)
    const res = await api.history(cursor)
    setLoadingMore(false)
    if (!res.ok) return
    setTrades((prev) => [...prev, ...res.data.trades])
    setCursor(res.data.next_cursor)
    setHasMore(res.data.has_more)
  }

  useEffect(() => { loadInitial() }, [])

  const filtered = useMemo(() => trades.filter((t) => {
    if (query && !(t.symbol ?? '').toLowerCase().includes(query.toLowerCase())) return false
    if (filter === 'buy'  && t.type !== 'buy')  return false
    if (filter === 'sell' && t.type !== 'sell') return false
    if (filter === 'win'  && toNum(t.pnl) <= 0)  return false
    if (filter === 'loss' && toNum(t.pnl) >= 0)  return false
    return true
  }), [trades, query, filter])

  // Summary stats
  const stats = useMemo(() => {
    const wins   = trades.filter((t) => toNum(t.pnl) > 0).length
    const losses = trades.filter((t) => toNum(t.pnl) < 0).length
    const netPnL = trades.reduce((s, t) => s + toNum(t.pnl), 0)
    const winRate = trades.length ? (wins / trades.length) * 100 : 0
    return { wins, losses, total: trades.length, netPnL, winRate }
  }, [trades])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Trade history</h1>
        <p className="text-sm text-text-muted mt-1">All closed positions across your accounts.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryStat label="Total trades" value={String(stats.total)} />
        <SummaryStat label="Win rate"     value={`${stats.winRate.toFixed(1)}%`} tone="info" />
        <SummaryStat label="Wins / Losses" value={`${stats.wins} / ${stats.losses}`} />
        <SummaryStat label="Net P&L"      value={fmtUSD(stats.netPnL, { sign: true })} tone={stats.netPnL >= 0 ? 'success' : 'danger'} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by symbol (e.g. EURUSD)"
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 bg-surface-muted p-1 rounded-md text-2xs">
            {(['all', 'buy', 'sell', 'win', 'loss'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 h-8 rounded-md transition-colors focus-ring ${
                  filter === f ? 'bg-bg-subtle text-text font-medium' : 'text-text-muted hover:text-text'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-subtle/40">
                <th className="text-left  px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium">Symbol</th>
                <th className="text-left  px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium">Side</th>
                <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium hidden sm:table-cell">Lots</th>
                <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium hidden md:table-cell">Open</th>
                <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium hidden md:table-cell">Close</th>
                <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium">P&L</th>
                <th className="text-right px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium hidden lg:table-cell">Closed</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border-subtle/40">
                  <td colSpan={7} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                </tr>
              ))}
              {!loading && error && (
                <tr><td colSpan={7} className="text-center py-16">
                  <BarChart3 className="h-8 w-8 mx-auto text-danger/70 mb-3" />
                  <div className="text-sm text-text-muted">{error}</div>
                  <Button variant="outline" size="sm" className="mt-3" onClick={loadInitial}>Try again</Button>
                </td></tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-16">
                  <BarChart3 className="h-8 w-8 mx-auto text-text-faint mb-3" />
                  <div className="text-sm text-text-muted">
                    {trades.length === 0 ? 'No closed trades yet' : 'No trades match your filter'}
                  </div>
                </td></tr>
              )}
              {!loading && !error && filtered.map((t, i) => {
                const pnl = toNum(t.pnl)
                const type = (t.type ?? '').toLowerCase()
                return (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.3) }}
                    className="border-b border-border-subtle/40 last:border-0 hover:bg-surface-muted/30"
                  >
                    <td className="px-4 py-3 font-medium tabular">{t.symbol}</td>
                    <td className="px-4 py-3">
                      <Badge tone={type === 'buy' ? 'success' : 'danger'}>
                        {type === 'buy' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {(t.type ?? '—').toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular text-text-muted hidden sm:table-cell">{toNum(t.lot_size).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular text-text-muted hidden md:table-cell">{toNum(t.open_price).toFixed(5)}</td>
                    <td className="px-4 py-3 text-right tabular text-text-muted hidden md:table-cell">{toNum(t.close_price).toFixed(5)}</td>
                    <td className={`px-4 py-3 text-right tabular font-medium ${pnlClass(pnl)}`}>
                      {fmtUSD(pnl, { sign: true })}
                    </td>
                    <td className="px-4 py-3 text-right text-2xs text-text-muted hidden lg:table-cell">{fmtDate(t.closed_at_iso || t.closed_at, true)}</td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {hasMore && !loading && (
          <div className="border-t border-border-subtle p-4 text-center">
            <Button variant="outline" size="sm" loading={loadingMore} onClick={loadMore}>
              Load more <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' | 'info' }) {
  const colors = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'info' ? 'text-info' : 'text-text'
  return (
    <Card className="p-4">
      <div className="text-2xs uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`mt-1 text-xl sm:text-2xl font-bold tracking-tight tabular ${colors}`}>{value}</div>
    </Card>
  )
}
