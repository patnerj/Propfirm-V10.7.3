import type { Metadata, Viewport } from 'next'

// Self-hosted fonts via @fontsource — no Google Fonts network dependency
// Loaded once at the root and exposed via the CSS variables already wired
// into tailwind.config.ts. These are real OTF/WOFF2 files that ship with
// the package, served from /_next/static.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'

import './globals.css'
import { Providers } from '@/components/providers'
import { LiveChat } from '@/components/marketing/live-chat'

export const metadata: Metadata = {
  title:       { default: 'LaunchAPropFirm', template: '%s' },
  description: 'Pass the evaluation, trade our capital, keep up to 90% of your profits. Institutional-grade prop firm built for serious traders.',
  applicationName: 'LaunchAPropFirm',
  openGraph: {
    title:       'LaunchAPropFirm',
    description: 'Pass the evaluation, trade our capital, keep up to 90% of your profits.',
    type:        'website',
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor:   '#060a12',
  width:        'device-width',
  initialScale: 1,
  // Prevent iOS auto-zoom on input focus — handled by 16px input font-size in globals.css
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased font-sans">
        <Providers>{children}</Providers>
        <LiveChat />
      </body>
    </html>
  )
}
