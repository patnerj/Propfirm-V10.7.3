import type { CapacitorConfig } from '@capacitor/cli'

/**
 * LaunchAPropFirm — Capacitor foundation (V10.7.3)
 *
 * Strategy: REMOTE-URL SHELL. The native app loads the deployed Next.js
 * frontend (per-tenant domain) inside the Capacitor runtime, which exposes
 * native plugins (secure storage, push, biometrics, status bar) to it via
 * the bridge. Chosen over static export because the frontend uses dynamic
 * routes + server components on Vercel; a static export would fork the build.
 *
 * White-label: `server.url` and `appId` are per-tenant build parameters —
 * each buyer's app is built with their own domain + bundle id. Keep the
 * CAP_SERVER_URL env override so one codebase produces every tenant build.
 *
 * NOTE (V10.7.3): android/ and ios/ platform folders are intentionally NOT
 * added yet — this release is foundation only. `npx cap add android|ios`
 * is a V10.8 step.
 */
const config: CapacitorConfig = {
  appId: process.env.CAP_APP_ID || 'com.launchapropfirm.trader',
  appName: process.env.CAP_APP_NAME || 'LaunchAPropFirm',
  // webDir is required by the CLI even in remote-URL mode; points at an
  // (empty) placeholder because all content is served from server.url.
  webDir: 'public',
  server: {
    url: process.env.CAP_SERVER_URL || 'https://demo.launchapropfirm.com',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0B1220',          // brand bg-dark
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B1220',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
}

export default config
