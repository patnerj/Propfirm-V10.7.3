'use client'

import { create } from 'zustand'
import { api } from '@/lib/api'
import { fxsimStream } from '@/lib/fxsim'
import type { PricesMap, PriceTick } from '@/types/api'

interface PriceState {
  prices:    PricesMap
  ts:        number
  connected: boolean
  source:    'sse' | 'poll' | 'idle'

  start: () => void
  stop:  () => void
  get:   (symbol: string) => PriceTick | undefined
}

let pollTimer:   ReturnType<typeof setInterval> | null = null
let stream:      EventSource | null = null
let visListener: (() => void) | null = null
let refCount     = 0
let sseFailures  = 0
const MAX_SSE_FAILURES = 3
const POLL_MS = 4000

function clearPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}
function closeStream() {
  if (stream) { stream.close(); stream = null }
}

export const usePrices = create<PriceState>((set, get) => ({
  prices: {},
  ts: 0,
  connected: false,
  source: 'idle',

  start: () => {
    refCount++
    if (refCount > 1) return
    if (typeof window === 'undefined') return

    const startPolling = () => {
      if (pollTimer) return
      const tick = async () => {
        if (typeof document !== 'undefined' && document.hidden) return
        const res = await api.prices()
        if (res.ok) set({ prices: res.data, ts: Date.now(), connected: true, source: 'poll' })
        else        set({ connected: false })
      }
      tick()
      pollTimer = setInterval(tick, POLL_MS)
      set({ source: 'poll' })
    }

    const tryStream = () => {
      const s = fxsimStream()
      if (!s) { startPolling(); return }
      stream = s
      set({ source: 'sse' })
      s.addEventListener('prices', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as PricesMap
          set((st) => ({ prices: { ...st.prices, ...data }, ts: Date.now(), connected: true }))
        } catch { /* malformed */ }
      })
      s.onopen  = () => { sseFailures = 0; set({ connected: true }) }
      s.onerror = () => {
        sseFailures += 1
        set({ connected: false })
        if (sseFailures >= MAX_SSE_FAILURES) {
          closeStream()
          startPolling()
        }
      }
    }

    // Pause everything when tab hidden, resume on visible
    visListener = () => {
      if (document.hidden) {
        closeStream()
        clearPoll()
      } else if (get().source === 'idle' || (!stream && !pollTimer)) {
        // Was paused — restart the appropriate mode
        sseFailures = 0
        tryStream()
      }
    }
    document.addEventListener('visibilitychange', visListener)

    tryStream()
    // One immediate fetch so the first paint isn't blank
    api.prices().then((res) => {
      if (res.ok) set({ prices: res.data, ts: Date.now(), connected: true })
    })
  },

  stop: () => {
    refCount = Math.max(0, refCount - 1)
    if (refCount > 0) return
    closeStream()
    clearPoll()
    if (visListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visListener)
      visListener = null
    }
    sseFailures = 0
    set({ connected: false, source: 'idle' })
  },

  get: (symbol) => get().prices[symbol],
}))
