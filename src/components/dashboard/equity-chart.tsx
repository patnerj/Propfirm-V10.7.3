'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  type TooltipProps,
} from 'recharts'
import { fmtUSD, toNum } from '@/lib/format'

interface EquityPoint { date: string; balance: number }

interface Props {
  data:   EquityPoint[]
  height?: number
}

export function EquityChart({ data, height = 280 }: Props) {
  // Normalise: parse dates, coerce balance, sort, drop NaNs
  const series = useMemo(() => {
    return data
      .map((p) => ({
        date:     p.date,
        balance:  toNum(p.balance),
        label:    new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        full:     new Date(p.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      }))
      .filter((p) => Number.isFinite(p.balance))
  }, [data])

  if (series.length === 0) {
    return (
      <div className="h-full min-h-[200px] flex items-center justify-center text-sm text-text-muted px-6 pb-6" style={{ height }}>
        Not enough data to draw the equity curve yet.
      </div>
    )
  }

  const balances = series.map((p) => p.balance)
  const min      = Math.min(...balances)
  const max      = Math.max(...balances)
  // Pad y-axis ±2% so the line doesn't sit at the edges
  const pad      = Math.max(1, (max - min) * 0.08)
  const yMin     = Math.floor(min - pad)
  const yMax     = Math.ceil(max + pad)

  const startBal = series[0].balance
  const endBal   = series[series.length - 1].balance
  const up       = endBal >= startBal
  const stroke   = up ? 'var(--equity-up, #10B981)' : 'var(--equity-down, #ef4444)'

  return (
    <div style={{ width: '100%', height }} className="px-2 pb-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={stroke} stopOpacity={0.32} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="rgba(156,163,175,0.6)"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            minTickGap={28}
          />
          <YAxis
            domain={[yMin, yMax]}
            stroke="rgba(156,163,175,0.6)"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => fmtUSD(v, { decimals: 0 })}
            width={70}
          />
          <Tooltip content={<EquityTooltip />} cursor={{ stroke: 'rgba(124,110,245,0.4)', strokeWidth: 1, strokeDasharray: '3 4' }} />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={stroke}
            strokeWidth={2}
            fill="url(#eqFill)"
            dot={false}
            activeDot={{ r: 4, stroke: 'var(--bg, #060a12)', strokeWidth: 2 }}
            isAnimationActive
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function EquityTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as { date: string; balance: number; label: string; full?: string }
  return (
    <div className="rounded-lg glass-strong px-3 py-2 shadow-card-lg text-xs">
      <div className="text-text-muted">{p.full || p.label}</div>
      <div className="font-semibold tabular text-text mt-0.5">{fmtUSD(p.balance)}</div>
    </div>
  )
}
