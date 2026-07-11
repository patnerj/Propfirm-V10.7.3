'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Capacitor } from '@capacitor/core'

declare global {
  interface Window {
    Tawk_API: object
    Tawk_LoadStart: Date
  }
}

export function LiveChat() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // V10.7.4 BUG 1 fix: the Tawk widget was mounted in the ROOT layout, so it
    // loaded on every route — including the authenticated trading terminal —
    // and its proactive auto-greeting expanded over the buy/sell controls on
    // mobile viewports, making it impossible to place an order. Scope it to
    // PUBLIC marketing routes only, and never load it inside the native app
    // (a trader in their dashboard doesn't need a marketing chat widget, and it
    // must never cover trading controls).
    const isNativeApp = Capacitor.isNativePlatform()
    const isAppRoute =
      pathname?.startsWith('/dashboard') ||
      pathname?.startsWith('/checkout') ||
      pathname?.startsWith('/certificate')

    if (isNativeApp || isAppRoute) {
      // If a widget was injected on a previous (marketing) route, hide it so it
      // can never linger over an app screen after client-side navigation.
      const api = window.Tawk_API as { hideWidget?: () => void }
      try { api?.hideWidget?.() } catch { /* not loaded yet */ }
      return
    }

    if (document.getElementById('fxsim-livechat')) {
      const api = window.Tawk_API as { showWidget?: () => void }
      try { api?.showWidget?.() } catch { /* ignore */ }
      return
    }

    window.Tawk_API = window.Tawk_API || {}
    window.Tawk_LoadStart = new Date()

    const s1 = document.createElement('script')
    const s0 = document.getElementsByTagName('script')[0]
    s1.id = 'fxsim-livechat'
    s1.async = true
    s1.src = 'https://embed.tawk.to/6a35aa74d0dd3e1d406c7115/1jrgq3mlr'
    s1.charset = 'UTF-8'
    s1.setAttribute('crossorigin', '*')
    s0.parentNode!.insertBefore(s1, s0)
  }, [pathname])

  return null
}
