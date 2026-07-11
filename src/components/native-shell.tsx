'use client'

/**
 * NativeShell (V10.7.3 RC)
 *
 * Mounted once in the root Providers tree. On the WEB it renders children
 * untouched and initialises nothing. Inside the Capacitor runtime it:
 *
 *  • boots the native chrome (splash hide, dark status bar, keyboard mode)
 *  • restores the bearer session from secure storage (silent refresh)
 *  • wires app-lifecycle (token refresh on resume), deep links → router,
 *    Android hardware back button
 *  • shows an offline banner driven by native network status
 *  • enables pull-to-refresh (native-feel rubber-band + spinner) on scrollable
 *    pages — triggers a soft data refresh, not a WebView reload
 *  • applies native-feel CSS: safe-area insets, no text-selection chrome,
 *    no overscroll glow, no tap highlight, momentum scrolling
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { isNative, initNativeShell, watchNetwork } from '@/lib/native'
import { invalidateFxsim } from '@/lib/fxsim'
import { useAuth } from '@/store/auth'

const NATIVE_CSS = `
  :root {
    --safe-top:    env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
  }
  html.fxsim-native body {
    padding-top:    var(--safe-top);
    padding-bottom: var(--safe-bottom);
    overscroll-behavior-y: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
  }
  html.fxsim-native input,
  html.fxsim-native textarea,
  html.fxsim-native [contenteditable] { user-select: text; }
  html.fxsim-native * { -webkit-overflow-scrolling: touch; }
  /* Fitts-friendly touch targets on native only — min 44px interactive height */
  html.fxsim-native button, html.fxsim-native a[role='button'] { min-height: 44px; }
  @keyframes fxsim-spin { to { transform: rotate(360deg); } }
`

export function NativeShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [online, setOnline] = useState(true)
  const [pull, setPull] = useState(0)          // px pulled (0 = idle)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const native = typeof window !== 'undefined' && isNative()

  // ── Boot native runtime once ────────────────────────────────────────────
  useEffect(() => {
    if (!native) return
    document.documentElement.classList.add('fxsim-native')
    const style = document.createElement('style')
    style.textContent = NATIVE_CSS
    document.head.appendChild(style)

    void initNativeShell((path) => router.push(path))
    // Rehydrate the user once the restored bearer is in place
    const t = setTimeout(() => void useAuth.getState().refresh(true), 400)

    let dispose: (() => void) | undefined
    void watchNetwork(setOnline).then((d) => { dispose = d })
    return () => { clearTimeout(t); dispose?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native])

  // ── Pull-to-refresh (native only, window-scroll top) ───────────────────
  useEffect(() => {
    if (!native) return
    const THRESHOLD = 70

    const onStart = (e: TouchEvent) => {
      if (window.scrollY <= 0 && !refreshing) startY.current = e.touches[0].clientY
      else startY.current = null
    }
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0 && window.scrollY <= 0) setPull(Math.min(110, dy * 0.5))
      else setPull(0)
    }
    const onEnd = () => {
      if (startY.current === null) return
      startY.current = null
      setPull((p) => {
        if (p >= THRESHOLD) {
          setRefreshing(true)
          // Soft refresh: drop the API cache and re-render the route —
          // every screen refetches through the normal client hooks.
          invalidateFxsim('/')
          void useAuth.getState().refresh(true)
          router.refresh()
          setTimeout(() => setRefreshing(false), 700)
        }
        return 0
      })
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [native, refreshing, router])

  return (
    <>
      {/* Offline banner — native network events; web uses its own handling */}
      {native && !online && (
        <div
          role="status"
          style={{
            position: 'fixed', top: 'var(--safe-top, 0px)', left: 0, right: 0, zIndex: 9999,
            background: '#7f1d1d', color: '#fecaca', textAlign: 'center',
            fontSize: 12, fontWeight: 600, padding: '6px 12px', letterSpacing: 0.2,
          }}
        >
          You&apos;re offline — live prices paused. Reconnecting…
        </div>
      )}

      {/* Pull-to-refresh indicator */}
      {native && (pull > 0 || refreshing) && (
        <div
          aria-hidden
          style={{
            position: 'fixed', top: `calc(var(--safe-top, 0px) + 8px)`, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', zIndex: 9998,
            transform: `translateY(${refreshing ? 12 : Math.max(0, pull - 40)}px)`,
            opacity: refreshing ? 1 : Math.min(1, pull / 70),
            transition: refreshing ? 'transform .2s ease' : undefined,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 28, height: 28, borderRadius: 14,
              background: '#0F1729', border: '1px solid rgba(124,110,245,.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,.4)',
            }}
          >
            <div
              style={{
                width: 14, height: 14, borderRadius: 7,
                border: '2px solid #7C6EF5', borderTopColor: 'transparent',
                animation: refreshing ? 'fxsim-spin .7s linear infinite' : undefined,
                transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
              }}
            />
          </div>
        </div>
      )}

      {children}
    </>
  )
}
