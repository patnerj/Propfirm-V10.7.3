/**
 * LaunchAPropFirm — native runtime foundation (V10.7.3)
 *
 * Everything Capacitor-specific lives behind this module. On the web build
 * every export is a safe no-op / web fallback, so importing it can never
 * break the browser experience. On native (Capacitor runtime detected) it:
 *
 *   • persists auth tokens in @capacitor/preferences (native storage, not
 *     WebView localStorage which the OS may evict) — V10.8 upgrades this to
 *     capacitor-secure-storage-plugin (Keychain / EncryptedSharedPreferences)
 *   • schedules access-token refresh against /auth/token/refresh with
 *     rotation-aware persistence (both tokens are replaced on every refresh)
 *   • initialises status bar + splash + keyboard behaviour
 *   • exposes network status (offline banner) and app-lifecycle hooks
 *     (refresh token on resume, pause SSE when backgrounded)
 *   • handles deep links (fxprop://… and https universal links) by routing
 *     into the SPA
 */

import { Capacitor } from '@capacitor/core'
import { setSession } from './fxsim'

// ── Platform detection ───────────────────────────────────────────────────────

export const isNative = (): boolean => Capacitor.isNativePlatform()
export const platform = (): 'ios' | 'android' | 'web' =>
  Capacitor.getPlatform() as 'ios' | 'android' | 'web'

// ── Token persistence (secure storage strategy) ─────────────────────────────

const K_ACCESS = 'fxsim.access_token'
const K_REFRESH = 'fxsim.refresh_token'
const K_EXPIRES = 'fxsim.access_expires_at'

export interface StoredTokens {
  access: string | null
  refresh: string | null
  expiresAt: number | null // epoch ms
}

export async function saveTokens(access: string, refresh: string, expiresIn: number): Promise<void> {
  const expiresAt = String(Date.now() + expiresIn * 1000)
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key: K_ACCESS, value: access })
    await Preferences.set({ key: K_REFRESH, value: refresh })
    await Preferences.set({ key: K_EXPIRES, value: expiresAt })
  } else if (typeof window !== 'undefined') {
    localStorage.setItem(K_ACCESS, access)
    localStorage.setItem(K_REFRESH, refresh)
    localStorage.setItem(K_EXPIRES, expiresAt)
  }
}

export async function loadTokens(): Promise<StoredTokens> {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences')
    const [a, r, e] = await Promise.all([
      Preferences.get({ key: K_ACCESS }),
      Preferences.get({ key: K_REFRESH }),
      Preferences.get({ key: K_EXPIRES }),
    ])
    return { access: a.value, refresh: r.value, expiresAt: e.value ? Number(e.value) : null }
  }
  if (typeof window === 'undefined') return { access: null, refresh: null, expiresAt: null }
  return {
    access: localStorage.getItem(K_ACCESS),
    refresh: localStorage.getItem(K_REFRESH),
    expiresAt: localStorage.getItem(K_EXPIRES) ? Number(localStorage.getItem(K_EXPIRES)) : null,
  }
}

export async function clearTokens(): Promise<void> {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences')
    await Promise.all([
      Preferences.remove({ key: K_ACCESS }),
      Preferences.remove({ key: K_REFRESH }),
      Preferences.remove({ key: K_EXPIRES }),
    ])
  } else if (typeof window !== 'undefined') {
    ;[K_ACCESS, K_REFRESH, K_EXPIRES].forEach((k) => localStorage.removeItem(k))
  }
}

// ── Token refresh (rotation-aware) ───────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_FXSIM_API || ''
let refreshTimer: ReturnType<typeof setTimeout> | null = null
// V10.7.4a: single-flight guard. Multiple triggers (the scheduled timer AND
// appStateChange-on-resume) previously called refresh concurrently with the
// SAME stored refresh token. The backend rotates on first use and treats the
// second presentation as token REUSE → revokes the whole session → forced
// re-login (the "logged out after Stripe checkout" bug). Coalescing all callers
// onto one in-flight promise means the token is only ever spent once.
let refreshInFlight: Promise<string | null> | null = null

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = doRefresh().finally(() => { refreshInFlight = null })
  return refreshInFlight
}

async function doRefresh(): Promise<string | null> {
  const { refresh } = await loadTokens()
  if (!refresh) return null
  try {
    const res = await fetch(`${API}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) {
      // 409 refresh_raced: a concurrent refresh already rotated the token within
      // the backend grace window. The session is intact — our single-flight
      // guard makes this rare, but a straggler from a previous app run can still
      // hit it. Reload the token the winning call persisted rather than logging
      // out. (Belt-and-suspenders with refreshInFlight coalescing.)
      if (res.status === 409) {
        const t = await loadTokens()
        if (t.access) { setSession({ bearer: t.access }); return t.access }
        return null
      }
      // 401 = expired/revoked/reuse-detected → hard logout locally
      await clearTokens()
      setSession({ bearer: null })
      return null
    }
    const d = await res.json()
    await saveTokens(d.access_token, d.refresh_token, d.expires_in)
    setSession({ bearer: d.access_token })   // existing API client picks it up
    scheduleRefresh(d.expires_in)
    return d.access_token as string
  } catch {
    return null // offline — retry on resume / next request
  }
}

/**
 * Refresh only if the access token is actually near expiry. Used on app resume
 * so we don't rotate a perfectly-valid token on every foreground (which both
 * wasted a rotation and widened the race window). Returns the current or a
 * freshly-refreshed access token.
 */
export async function ensureFreshToken(skewSec = 120): Promise<string | null> {
  const { access, expiresAt } = await loadTokens()
  if (access && expiresAt && expiresAt - Date.now() > skewSec * 1000) {
    return access // still valid — no refresh needed
  }
  return refreshAccessToken()
}

export function scheduleRefresh(expiresInSec: number): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  // refresh 2 minutes before expiry, minimum 30s out
  const ms = Math.max(30_000, (expiresInSec - 120) * 1000)
  refreshTimer = setTimeout(() => void refreshAccessToken(), ms)
}

// ── Network / offline detection ──────────────────────────────────────────────

export type NetworkListener = (online: boolean) => void

export async function watchNetwork(cb: NetworkListener): Promise<() => void> {
  if (isNative()) {
    const { Network } = await import('@capacitor/network')
    const st = await Network.getStatus()
    cb(st.connected)
    const h = await Network.addListener('networkStatusChange', (s) => cb(s.connected))
    return () => h.remove()
  }
  if (typeof window === 'undefined') return () => {}
  const on = () => cb(true)
  const off = () => cb(false)
  window.addEventListener('online', on)
  window.addEventListener('offline', off)
  cb(navigator.onLine)
  return () => {
    window.removeEventListener('online', on)
    window.removeEventListener('offline', off)
  }
}

// ── App lifecycle + deep links + chrome init ────────────────────────────────

export async function initNativeShell(navigate: (path: string) => void): Promise<void> {
  if (!isNative()) return // web: nothing to do — entire function is a no-op

  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ])

  // Chrome: dark status bar matching brand bg, hide splash once booted
  try {
    await StatusBar.setStyle({ style: Style.Dark })
    if (platform() === 'android') await StatusBar.setBackgroundColor({ color: '#0B1220' })
  } catch { /* status bar unavailable in some contexts */ }
  await SplashScreen.hide()

  // Lifecycle: on foreground, ensure the access token is valid (refresh only if
  // near expiry) rather than unconditionally rotating — this closes the
  // resume-after-Stripe race that was forcing re-login.
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return
    void ensureFreshToken()

    // V10.7.4 BUG 2 (self-heal fallback): if a Stripe checkout was in flight
    // when we left the app, the deep link back SHOULD have handled the return —
    // but if App Links verification isn't set up (assetlinks.json missing) the
    // link may not fire. On resume with a pending flag, close any lingering
    // in-app browser, drop to the dashboard, and refetch so a just-funded
    // challenge shows immediately instead of the stale purchase dialog.
    let pending = false
    try { pending = sessionStorage.getItem('fxsim:stripe_pending') === '1' } catch { /* ignore */ }
    if (pending) {
      try { sessionStorage.removeItem('fxsim:stripe_pending') } catch { /* ignore */ }
      void (async () => {
        try { const { Browser } = await import('@capacitor/browser'); await Browser.close() } catch { /* already closed */ }
      })()
      navigate('/dashboard')
    }
  })

  // Deep links: fxprop://dashboard/history or universal https links —
  // strip origin/scheme and route inside the SPA.
  App.addListener('appUrlOpen', ({ url }) => {
    try {
      const u = new URL(url)

      // V10.7.4 BUG 2: Stripe returns to /dashboard?stripe=success|cancelled.
      // Close the in-app browser (Custom Tab may still be open) and route to
      // the dashboard so the funded challenge is visible with no app-switching.
      const stripeStatus = u.searchParams.get('stripe')
      if (stripeStatus) {
        try { sessionStorage.removeItem('fxsim:stripe_pending') } catch { /* ignore */ }
        void (async () => {
          try { const { Browser } = await import('@capacitor/browser'); await Browser.close() } catch { /* already closed */ }
        })()
        navigate('/dashboard?stripe=' + encodeURIComponent(stripeStatus))
        return
      }

      navigate(u.pathname + u.search + u.hash || '/')
    } catch {
      /* malformed URL — ignore */
    }
  })

  // Android hardware back button: default = history back, exit at root.
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void App.exitApp()
  })

  // Boot-time session restore: valid access token → wire into API client;
  // expired → attempt one refresh.
  const t = await loadTokens()
  if (t.access && t.expiresAt && t.expiresAt > Date.now() + 60_000) {
    setSession({ bearer: t.access })
    scheduleRefresh(Math.floor((t.expiresAt - Date.now()) / 1000))
  } else if (t.refresh) {
    void refreshAccessToken()
  }
}
