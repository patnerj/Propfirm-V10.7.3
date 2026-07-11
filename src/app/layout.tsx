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

// V10.7.5 hotfix: favicon was hardcoded to /favicon.svg, completely ignoring
// the admin-configured favicon_url in Branding Center -- uploading a favicon
// there had zero effect on the actual browser tab icon. Fetching the public,
// unauthenticated /branding endpoint here (Next.js metadata can be async via
// generateMetadata) and using its favicon_url/brand_name fixes that, while
// falling back to the previous static defaults if the API is unreachable so
// the site never breaks because of this.
async function getBranding() {
  try {
    const res = await fetch('https://app.launchapropfirm.com/wp-json/fxsim/v1/branding', {
      next: { revalidate: 300 }, // 5 min cache — branding rarely changes, avoids hammering the API
    })
    if (!res.ok) throw new Error('branding fetch failed')
    return await res.json() as {
      brand_name?: string
      favicon_url?: string
      logo_url?: string
    }
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding()
  const brandName = branding?.brand_name || 'LaunchAPropFirm'
  const favicon = branding?.favicon_url || '/favicon.svg'

  return {
    title:       { default: brandName, template: '%s' },
    description: 'Pass the evaluation, trade our capital, keep up to 85% of your profits. Institutional-grade prop firm built for serious traders.',
    applicationName: brandName,
    openGraph: {
      title:       brandName,
      description: 'Pass the evaluation, trade our capital, keep up to 85% of your profits.',
      type:        'website',
      images:      branding?.logo_url ? [branding.logo_url] : undefined,
    },
    twitter: { card: 'summary_large_image' },
    icons: { icon: favicon },
    manifest: '/manifest.json',
  }
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
