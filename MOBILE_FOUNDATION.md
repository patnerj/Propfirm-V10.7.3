# Mobile Foundation (V10.7.3) — how the pieces fit

**Strategy:** Capacitor remote-URL shell. The native app is a thin Capacitor
runtime whose WebView loads the tenant's deployed Next.js frontend. All native
capability (secure token storage, push, splash/status bar, deep links,
lifecycle, offline detection) is exposed through `src/lib/native.ts`, which is
a complete no-op on web — the browser experience is untouched.

**Auth on native:** the app calls `POST /auth/token` (bearer login added in
V10.7.3 backend), stores the access+refresh pair via `saveTokens()`
(@capacitor/preferences today; secure-storage plugin in V10.8), and
`setSession({ bearer })` feeds the existing API client — every REST call the
web app already makes then works natively with zero endpoint changes. Refresh
rotation is handled by `refreshAccessToken()` (scheduled 2 min before expiry,
retried on app resume, hard-logout on 401/reuse-detection).

**Per-tenant builds:** `CAP_APP_ID`, `CAP_APP_NAME`, `CAP_SERVER_URL` env vars
parameterise `capacitor.config.ts` — one codebase, one build command per buyer.

**Deliberately NOT done in V10.7.3** (V10.8 scope): `npx cap add android/ios`,
push-notification plugin registration (backend queue+device registry are
ready), biometric unlock, secure-storage plugin upgrade, store assets.
