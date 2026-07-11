/**
 * Format helpers used by every page. wpdb often serialises DECIMAL columns
 * as strings, so toNum() is the canonical coercer.
 */

export const toNum = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export const fmtUSD = (v: unknown, opts: { sign?: boolean; decimals?: number } = {}) => {
  const n = toNum(v)
  const d = opts.decimals ?? 2
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  if (opts.sign) {
    if (n > 0) return `+$${abs}`
    if (n < 0) return `-$${abs}`
    return `$${abs}`
  }
  return n < 0 ? `-$${abs}` : `$${abs}`
}

export const fmtPct = (v: unknown, decimals = 2, sign = false) => {
  const n = toNum(v)
  const fixed = n.toFixed(decimals)
  if (sign && n > 0) return `+${fixed}%`
  return `${fixed}%`
}

export const fmtNum = (v: unknown, decimals = 0) =>
  toNum(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

export const fmtPrice = (v: unknown, digits = 5) => toNum(v).toFixed(digits)

export const fmtLots = (v: unknown) => toNum(v).toFixed(2)

export const pnlClass = (v: unknown) => {
  const n = toNum(v)
  if (n > 0) return 'text-success'
  if (n < 0) return 'text-danger'
  return 'text-text-muted'
}

/** Relative time — small, human, no extra dep */
export const timeAgo = (iso: string): string => {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return iso
  const s = Math.floor((Date.now() - then) / 1000)
  if (s < 60)     return `${s}s ago`
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const fmtDate = (iso: string, withTime = false) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  if (withTime) {
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Used by certificate display & funded-trader status */
export const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    active: 'In Evaluation', passed: 'Passed', failed: 'Failed',
    funded: 'Funded', suspended: 'Suspended', breached: 'Breached',
  }
  return map[status] ?? status
}

export const statusTone = (status: string): 'success' | 'danger' | 'warn' | 'info' | 'neutral' => {
  const map: Record<string, 'success' | 'danger' | 'warn' | 'info' | 'neutral'> = {
    active: 'info', passed: 'success', funded: 'success',
    failed: 'danger', breached: 'danger', suspended: 'warn',
    pending: 'warn', submitted: 'warn', approved: 'success', rejected: 'danger',
  }
  return map[status] ?? 'neutral'
}
