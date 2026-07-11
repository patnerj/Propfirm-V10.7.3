'use client'

import { create } from 'zustand'
import { api } from '@/lib/api'
import { invalidateFxsim, setSession, hydrateSession, clearFxsimCache } from '@/lib/fxsim'
import type { AuthUser } from '@/types/api'

interface AuthState {
  user:        AuthUser | null
  loading:     boolean
  ready:       boolean
  error:       string | null
  /** Timestamp of last successful /auth/me — used to avoid re-querying frequently. */
  lastChecked: number

  bootstrap: () => Promise<void>
  signin:    (username: string, password: string, remember?: boolean) => Promise<{ ok: boolean; error?: string; twoFactor?: boolean; uid?: number }>
  verifyTwoFactor: (uid: number, code: string) => Promise<{ ok: boolean; error?: string }>
  signup:    (username: string, email: string, password: string, ref?: string) => Promise<{ ok: boolean; error?: string }>
  signout:   () => Promise<void>
  refresh:   (force?: boolean) => Promise<void>
}

// Dedupe concurrent bootstrap() calls
let bootstrapPromise: Promise<void> | null = null
// Only re-check /auth/me at most once every 60s on focus etc.
const RECHECK_INTERVAL_MS = 60_000

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  ready: false,
  error: null,
  lastChecked: 0,

  bootstrap: async () => {
    if (get().ready) return
    if (bootstrapPromise) return bootstrapPromise
    bootstrapPromise = (async () => {
      hydrateSession()
      set({ loading: true })
      const res = await api.auth.me()
      if (res.ok) set({ user: res.data, ready: true, loading: false, error: null, lastChecked: Date.now() })
      else        set({ user: null, ready: true, loading: false, lastChecked: Date.now() })
    })().finally(() => { bootstrapPromise = null })
    return bootstrapPromise
  },

  signin: async (username, password, remember) => {
    set({ loading: true, error: null })

    // ── Native (Capacitor) path: bearer-token login, cookie-free ──────────
    // WebView cookie behaviour is unreliable inside the native shell, so the
    // app authenticates with /auth/token (V10.7.3) and hydrates the user via
    // /auth/me over the Authorization header. Web builds never enter here.
    if ((await import('@/lib/native')).isNative()) {
      const { nativeSignin } = await import('@/lib/native-auth')
      const nres = await nativeSignin(username, password)
      if (nres.ok) {
        clearFxsimCache()
        const me = await api.auth.me(true)
        if (me.ok) {
          set({ user: me.data, loading: false, ready: true, lastChecked: Date.now(), error: null })
          return { ok: true }
        }
        set({ loading: false, error: me.error })
        return { ok: false, error: me.error }
      }
      if (nres.twoFactor) {
        set({ loading: false, error: null })
        return { ok: false, twoFactor: true, uid: -1 }   // uid unused on native
      }
      set({ loading: false, error: nres.error })
      return { ok: false, error: nres.error }
    }

    const res = await api.auth.login({ username, password, remember })
    if (res.ok && res.data.two_factor_required) {
      // Credentials are valid but a one-time code was emailed. Do not establish
      // a session yet — the login page collects the code and calls verifyTwoFactor.
      set({ loading: false, error: null })
      return { ok: false, twoFactor: true, uid: res.data.uid }
    }
    if (res.ok && res.data.user && res.data.nonce) {
      setSession({ nonce: res.data.nonce })
      // Clear any cached anonymous responses
      clearFxsimCache()
      // Defensive: clear any leftover impersonation record from a prior session.
      // The dynamic import avoids a circular dependency with the impersonation store.
      try {
        if (typeof window !== 'undefined') sessionStorage.removeItem('fxsim:impersonating')
        const { useImpersonation } = await import('@/store/impersonation')
        useImpersonation.getState().end()
      } catch { /* private mode or already unmounted */ }
      set({ user: res.data.user, loading: false, ready: true, lastChecked: Date.now(), error: null })
      return { ok: true }
    }
    set({ loading: false, error: res.ok ? 'Login failed' : res.error })
    return { ok: false, error: res.ok ? 'Login failed' : res.error }
  },

  verifyTwoFactor: async (uid: number, code: string) => {
    set({ loading: true, error: null })

    if ((await import('@/lib/native')).isNative()) {
      const { nativeVerify2fa } = await import('@/lib/native-auth')
      const nres = await nativeVerify2fa(code)
      if (nres.ok) {
        clearFxsimCache()
        const me = await api.auth.me(true)
        if (me.ok) {
          set({ user: me.data, loading: false, ready: true, lastChecked: Date.now(), error: null })
          return { ok: true }
        }
        set({ loading: false, error: me.error })
        return { ok: false, error: me.error }
      }
      const msg = nres.twoFactor ? 'Invalid or expired code.' : nres.error
      set({ loading: false, error: msg })
      return { ok: false, error: msg }
    }

    const res = await api.auth.verify2fa(uid, code)
    if (res.ok) {
      setSession({ nonce: res.data.nonce })
      clearFxsimCache()
      try {
        if (typeof window !== 'undefined') sessionStorage.removeItem('fxsim:impersonating')
        const { useImpersonation } = await import('@/store/impersonation')
        useImpersonation.getState().end()
      } catch { /* private mode or already unmounted */ }
      set({ user: res.data.user, loading: false, ready: true, lastChecked: Date.now(), error: null })
      return { ok: true }
    }
    set({ loading: false, error: res.error })
    return { ok: false, error: res.error }
  },

  signup: async (username, email, password, ref) => {
    set({ loading: true, error: null })
    const res = await api.auth.register({ username, email, password, ref })
    if (res.ok) {
      setSession({ nonce: res.data.nonce })
      clearFxsimCache()
      set({ user: res.data.user, loading: false, ready: true, lastChecked: Date.now(), error: null })
      return { ok: true }
    }
    set({ loading: false, error: res.error })
    return { ok: false, error: res.error }
  },

  signout: async () => {
    // Native: revoke the bearer session server-side and wipe stored tokens
    try {
      if ((await import('@/lib/native')).isNative()) {
        const { nativeLogout } = await import('@/lib/native-auth')
        await nativeLogout()
      }
    } catch { /* native modules unavailable — fall through to web logout */ }
    await api.auth.logout().catch(() => null)
    setSession({ nonce: null, bearer: null })
    clearFxsimCache()
    try {
      if (typeof window !== 'undefined') sessionStorage.removeItem('fxsim:impersonating')
      const { useImpersonation } = await import('@/store/impersonation')
      useImpersonation.getState().end()
    } catch { /* private mode or already unmounted */ }
    set({ user: null, ready: true, error: null, lastChecked: Date.now() })
  },

  refresh: async (force = false) => {
    if (!force && Date.now() - get().lastChecked < RECHECK_INTERVAL_MS) return
    if (force) invalidateFxsim('/auth/me')          // drop any cached /auth/me so verification + impersonation-exit reflect instantly
    const res = await api.auth.me(force)
    if (res.ok) set({ user: res.data, lastChecked: Date.now() })
    else if (res.status === 401 || res.status === 403) {
      // Session expired — clear without calling /logout (likely will 401 too)
      setSession({ nonce: null, bearer: null })
      clearFxsimCache()
      set({ user: null, lastChecked: Date.now() })
    }
  },
}))
