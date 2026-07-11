/**
 * Native token authentication (V10.7.3 RC)
 *
 * Inside the Capacitor shell, WebView cross-site cookie behaviour is
 * unreliable (WKWebView ITP on iOS, cookie partitioning on Android), so the
 * native app authenticates with the V10.7.3 bearer-token endpoints instead of
 * the cookie flow. The web build never calls anything in this file.
 *
 * Flow: POST /auth/token → tokens saved natively (rotation-aware refresh is
 * handled by lib/native.ts) → session.bearer feeds the existing API client →
 * /auth/me hydrates the user exactly like the cookie flow.
 *
 * 2FA: the token endpoint drives its own email OTP (401 + code=2fa_required).
 * Credentials are held in module memory (never persisted) between the two
 * steps so the OTP retry can re-submit them.
 */

import { fxsim, setSession } from './fxsim'
import { saveTokens, clearTokens, scheduleRefresh, platform } from './native'

interface TokenResponse {
  success: boolean
  code?: string
  message?: string
  access_token?: string
  refresh_token?: string
  expires_in?: number
  session_id?: number
}

// In-memory only — cleared the moment login completes or fails terminally.
let pending: { username: string; password: string } | null = null

export type NativeSignin =
  | { ok: true }
  | { ok: false; twoFactor: true }
  | { ok: false; twoFactor?: false; error: string }

async function requestTokens(username: string, password: string, otp?: string): Promise<NativeSignin> {
  const device = platform() === 'ios' ? 'iPhone' : platform() === 'android' ? 'Android device' : 'Browser'
  const res = await fxsim<TokenResponse>('/auth/token', {
    public: true,
    body: { username, password, otp, device_name: device, platform: platform() },
  })

  if (res.ok && res.data.success && res.data.access_token && res.data.refresh_token) {
    pending = null
    await saveTokens(res.data.access_token, res.data.refresh_token, res.data.expires_in ?? 1800)
    setSession({ bearer: res.data.access_token })
    scheduleRefresh(res.data.expires_in ?? 1800)
    return { ok: true }
  }

  // fxsim() surfaces non-2xx as ApiErr { ok:false, status, error, raw } — the
  // token endpoint's 2fa_required marker rides in the 401 body (raw).
  const payload = (!res.ok ? (res.raw as TokenResponse | undefined) : res.data) ?? undefined
  if (payload?.code === '2fa_required') {
    pending = { username, password }
    return { ok: false, twoFactor: true }
  }
  pending = null
  const msg = payload?.message ?? (!res.ok ? res.error : undefined) ?? 'Sign-in failed'
  return { ok: false, error: msg }
}

export function nativeSignin(username: string, password: string): Promise<NativeSignin> {
  return requestTokens(username, password)
}

export function nativeVerify2fa(otp: string): Promise<NativeSignin> {
  if (!pending) return Promise.resolve({ ok: false, error: 'Session expired — please sign in again.' })
  return requestTokens(pending.username, pending.password, otp)
}

export async function nativeLogout(): Promise<void> {
  try {
    await fxsim('/auth/token/logout', { method: 'POST' })   // revoke server-side (bearer identifies session)
  } catch { /* offline logout is still a local logout */ }
  await clearTokens()
  setSession({ bearer: null })
}
