/**
 * fxsim API client — wraps the WordPress REST namespace `fxsim/v1`.
 *
 * Network hygiene (v1.2 — added for the trader dashboard):
 *   • GET request dedup (concurrent identical calls share a single promise)
 *   • Short-TTL in-memory cache for GETs (default 0; opt in per-call via `cache: <ms>`)
 *   • 429 / 5xx exponential backoff with jitter (transparently retries)
 *   • Optional `force: true` to bypass cache + dedup (for after-mutation refresh)
 *
 * Auth model (matches the WP bridge):
 *   • Browser session: WP cookie + X-WP-Nonce header
 *   • Cross-origin: session cookie set by /auth/login on the WP origin
 *   • Server-to-server: Bearer API key generated via /api-keys
 *
 * All errors are normalised to `ApiResult<T>` so callers never throw.
 */

import type { ApiResult, ApiErr } from '@/types/api'

// ── Configuration ──────────────────────────────────────────────────────────
const RAW_BASE = (process.env.NEXT_PUBLIC_FXSIM_API ?? '').trim()
if (!RAW_BASE && typeof window !== 'undefined') {
  console.warn('[fxsim] NEXT_PUBLIC_FXSIM_API not set — API calls will fail')
}
export const FXSIM_BASE = RAW_BASE.replace(/\/$/, '')

// ── Session ────────────────────────────────────────────────────────────────
type Session = { nonce: string | null; bearer: string | null }
let session: Session = { nonce: null, bearer: null }

export function setSession(next: Partial<Session>) {
  session = { ...session, ...next }
  if (typeof window !== 'undefined') {
    try {
      if (next.nonce !== undefined) {
        next.nonce
          ? localStorage.setItem('fxsim:nonce', next.nonce)
          : localStorage.removeItem('fxsim:nonce')
      }
      if (next.bearer !== undefined) {
        next.bearer
          ? localStorage.setItem('fxsim:bearer', next.bearer)
          : localStorage.removeItem('fxsim:bearer')
      }
    } catch { /* private mode */ }
  }
}

export function hydrateSession() {
  if (typeof window === 'undefined') return
  try {
    session.nonce  = localStorage.getItem('fxsim:nonce')
    session.bearer = localStorage.getItem('fxsim:bearer')
  } catch { /* private mode */ }
}

export function getSession(): Readonly<Session> { return session }

// ── Request options ────────────────────────────────────────────────────────
export interface RequestOptions {
  method?:  'GET' | 'POST' | 'PUT' | 'DELETE'
  body?:    unknown
  query?:   Record<string, string | number | boolean | undefined | null>
  signal?:  AbortSignal
  form?:    FormData
  public?:  boolean
  /** Cache TTL in ms (GET only). Default 0 = no cache. */
  cache?:   number
  /** Bypass dedup + cache. Use after mutations. */
  force?:   boolean
  /** Max retries on 429/5xx (default 2). 0 disables. */
  retries?: number
}

function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return ''
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

// ── Dedup + cache for idempotent GETs ──────────────────────────────────────
interface CacheEntry<T = unknown> { at: number; ttl: number; value: ApiResult<T> }
const inflight = new Map<string, Promise<ApiResult<unknown>>>()
const cache    = new Map<string, CacheEntry>()

function cacheKey(method: string, url: string) { return `${method}|${url}` }

/** Wipe everything (call on logout). */
export function clearFxsimCache() { cache.clear(); inflight.clear() }

/** Invalidate by URL prefix (e.g. clear all /account* entries after a mutation). */
export function invalidateFxsim(prefix: string) {
  const fullPrefix = `GET|${FXSIM_BASE}${prefix}`
  for (const k of [...cache.keys()])    if (k.startsWith(fullPrefix)) cache.delete(k)
  for (const k of [...inflight.keys()]) if (k.startsWith(fullPrefix)) inflight.delete(k)
}

// ── Sleep with jitter for backoff ──────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ── Core fetch ─────────────────────────────────────────────────────────────
export async function fxsim<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<ApiResult<T>> {
  if (!FXSIM_BASE) {
    return { ok: false, status: 0, error: 'FXSIM API base URL not configured.' }
  }

  const method = opts.method ?? (opts.body || opts.form ? 'POST' : 'GET')
  const url    = FXSIM_BASE + path + buildQuery(opts.query)
  const key    = cacheKey(method, url)

  // ─── GET-only: cache + dedup ───────────────────────────────────────────
  if (method === 'GET' && !opts.force) {
    const ttl = opts.cache ?? 0
    if (ttl > 0) {
      const hit = cache.get(key)
      if (hit && Date.now() - hit.at < hit.ttl) {
        return hit.value as ApiResult<T>
      }
    }
    const pending = inflight.get(key)
    if (pending) return pending as Promise<ApiResult<T>>
  }

  // ─── Execute with retries ──────────────────────────────────────────────
  const maxRetries = opts.retries ?? 2
  const doRequest = async (): Promise<ApiResult<T>> => {
    let attempt = 0
    while (true) {
      const result = await rawFetch<T>(url, method, opts)
      const shouldRetry =
        !result.ok &&
        attempt < maxRetries &&
        (result.status === 429 || (result.status >= 500 && result.status < 600) || result.status === 0)
      if (!shouldRetry) return result

      // Exponential backoff with jitter: 400ms, 900ms, 1900ms (capped at 4s)
      const base = Math.min(400 * Math.pow(2, attempt), 4000)
      const jittered = base + Math.floor(Math.random() * 250)
      await sleep(jittered)
      attempt++
    }
  }

  if (method === 'GET' && !opts.force) {
    const promise = doRequest().then((value) => {
      if (value.ok && (opts.cache ?? 0) > 0) {
        cache.set(key, { at: Date.now(), ttl: opts.cache!, value })
      }
      inflight.delete(key)
      return value
    }).catch((e) => {
      inflight.delete(key)
      throw e
    })
    inflight.set(key, promise as Promise<ApiResult<unknown>>)
    return promise
  }

  // Mutations bypass cache/dedup; also invalidate related GETs on success
  const result = await doRequest()
  if (result.ok && method !== 'GET') {
    // Best-effort invalidation: clear common related GET caches
    // (Callers can also explicitly invalidate prefixes after mutations.)
    invalidateRelated(path)
  }
  return result
}

/** When a mutation succeeds, clear caches that are likely now stale. */
function invalidateRelated(path: string) {
  if (path.startsWith('/auth/'))            invalidateFxsim('/auth/me')
  if (path.startsWith('/open') || path.startsWith('/close') || path.startsWith('/sltp') || path.startsWith('/partial-close')) {
    invalidateFxsim('/positions')
    invalidateFxsim('/account')
    invalidateFxsim('/history')
    invalidateFxsim('/transactions')
    invalidateFxsim('/stats')
    invalidateFxsim('/challenge/')   // refresh challenge metrics + equity curve after a trade
  }
  if (path.startsWith('/challenge/start')) {
    invalidateFxsim('/challenge/my')
    invalidateFxsim('/account')
  }
  if (path.startsWith('/payment/'))      invalidateFxsim('/payment/my-orders')
  if (path.startsWith('/notifications')) invalidateFxsim('/notifications')
  if (path.startsWith('/pending-order')) invalidateFxsim('/pending-order/my')
  if (path.startsWith('/payout-method')) invalidateFxsim('/payout-method')
  // V10.7.5 hotfix: kycGet() caches for 10s (`cache: 10_000`), but kyc/submit
  // was never in this mapping -- the KYC page's post-submit load() call could
  // hit the stale pre-submit cache and keep showing the upload form even
  // though the backend had already accepted the documents. Only a full page
  // reload (which clears the in-memory cache module) revealed the real
  // 'under review' status. Confirmed via network trace: kyc/submit returned
  // 200, but the UI stayed on the upload form until reload.
  if (path.startsWith('/kyc/submit'))    invalidateFxsim('/kyc')

  // ── Admin mutations ─────────────────────────────────────────────────
  // After admin actions, clear the GET caches the admin pages depend on so
  // refreshes reflect the change immediately.
  if (path.startsWith('/admin/adjust-balance') || path.startsWith('/admin/set-status')) {
    invalidateFxsim('/admin/users')
    invalidateFxsim('/admin/stats')
  }
  if (path.startsWith('/admin/payments/') && (path.endsWith('/approve') || path.endsWith('/reject'))) {
    invalidateFxsim('/admin/payments')
    invalidateFxsim('/admin/stats')
  }
  if (path.startsWith('/admin/challenge/') && path.endsWith('/approve-payout')) {
    invalidateFxsim('/admin/challenges')
  }
  if (path.startsWith('/admin/plans/save')) {
    invalidateFxsim('/admin/plans')
    invalidateFxsim('/challenge/plans')   // public plan listing is now stale too
  }
  if (path.startsWith('/admin/banners')) {
    invalidateFxsim('/admin/banners')     // admin list (cached) must reflect toggle/save/delete
    invalidateFxsim('/banners')           // public banner feed (all placement/page variants)
  }
  if (path.startsWith('/admin/whitelabel/save')) {
    invalidateFxsim('/admin/whitelabel')
  }
  if (path.startsWith('/admin/pending-orders/')) {
    invalidateFxsim('/admin/pending-orders')
  }
  if (path.startsWith('/admin/kyc/')) {
    invalidateFxsim('/admin/kyc')
  }
  if (path.startsWith('/admin/payouts/')) {
    invalidateFxsim('/admin/payouts')
  }
}

async function rawFetch<T>(
  url: string, method: string, opts: RequestOptions,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {}
  if (!opts.form) headers['Content-Type'] = 'application/json'
  if (!opts.public && session.nonce)  headers['X-WP-Nonce']    = session.nonce
  if (session.bearer)                 headers['Authorization'] = `Bearer ${session.bearer}`

  const init: RequestInit = {
    method,
    credentials: 'include',
    headers,
    signal: opts.signal,
    cache:  'no-store',
  }
  if (opts.form)      init.body = opts.form
  else if (opts.body) init.body = JSON.stringify(opts.body)

  let res: Response
  try {
    res = await fetch(url, init)
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return { ok: false, status: 0, error: 'aborted' }
    }
    return { ok: false, status: 0, error: (e as Error).message || 'Network error' }
  }

  let parsed: unknown = null
  const ct = res.headers.get('content-type') || ''
  try {
    if (ct.includes('application/json')) parsed = await res.json()
    else                                 parsed = await res.text()
  } catch { /* empty body */ }

  if (!res.ok) {
    const err = parsed && typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {}
    // Surface the WP "cookie check failed" hint a level up so callers can
    // prompt re-auth instead of looping retries.
    const rawMessage =
      (err.message as string) ||
      (err.error   as string) ||
      `Request failed (${res.status})`
    const message = /cookie/i.test(rawMessage) && /check failed/i.test(rawMessage)
      ? 'Your session has expired. Please sign in again.'
      : rawMessage
    const out: ApiErr = { ok: false, status: res.status, error: message, raw: parsed }
    return out
  }

  return { ok: true, status: res.status, data: parsed as T }
}

// ── SSE helper ─────────────────────────────────────────────────────────────
// EventSource can't send custom headers, so we can't pass the Bearer token
// through it. This AbortController-based fetch stream does the same job and
// supports Authorization headers properly.
export interface FxsimStream {
  close: () => void
  addEventListener: (event: string, handler: (ev: { data: string }) => void) => void
  set onopen(fn: () => void)
  set onerror(fn: () => void)
}

export function fxsimStream(): FxsimStream | null {
  if (typeof window === 'undefined' || !FXSIM_BASE || !session.bearer) return null

  const url   = `${FXSIM_BASE}/stream`
  const ctrl  = new AbortController()
  const listeners: Record<string, ((ev: { data: string }) => void)[]> = {}
  let _onopen:  (() => void) | null = null
  let _onerror: (() => void) | null = null

  const run = async () => {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.bearer}` },
        signal:  ctrl.signal,
      })
      if (!res.ok || !res.body) { _onerror?.(); return }
      _onopen?.()
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buf     = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        let event = 'message'
        for (const line of lines) {
          if (line.startsWith('event:'))      event = line.slice(6).trim()
          else if (line.startsWith('data:')) {
            const data = line.slice(5).trim()
            listeners[event]?.forEach((fn) => fn({ data }))
            event = 'message'
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      _onerror?.()
    }
  }

  run()

  return {
    close: () => ctrl.abort(),
    addEventListener(event: string, handler: (ev: { data: string }) => void) {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(handler)
    },
    set onopen(fn: () => void)  { _onopen  = fn },
    set onerror(fn: () => void) { _onerror = fn },
  }
}
