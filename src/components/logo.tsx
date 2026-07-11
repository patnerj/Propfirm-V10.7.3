'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/cn'
import { useBranding } from '@/store/branding'

/** Built-in gradient mark — square, scales cleanly at any sidebar width. */
function DefaultMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn('shrink-0', className)} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28">
          <stop offset="0%" stopColor="#7c6ef5" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="24" height="24" rx="7" fill="url(#logo-grad)" opacity="0.18" />
      <rect x="2" y="2" width="24" height="24" rx="7" stroke="url(#logo-grad)" strokeWidth="1.5" />
      <path d="M8 18 L12 12 L15 15 L20 8" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="20" cy="8" r="1.6" fill="#10B981" />
    </svg>
  )
}

/**
 * General brand lockup. Used on the login page (login_logo_url) and anywhere a
 * horizontal logo is appropriate. Falls back to mark + brand name.
 *
 * @param variant 'login' prefers login_logo_url; 'dashboard' uses logo_url.
 */
export function Logo({
  className,
  wordmark = true,
  variant = 'dashboard',
}: {
  className?: string
  wordmark?: boolean
  variant?: 'dashboard' | 'login'
}) {
  const branding = useBranding((s) => s.branding)
  const loaded = useBranding((s) => s.loaded)
  const load = useBranding((s) => s.load)
  useEffect(() => { load() }, [load])

  const imageUrl = variant === 'login'
    ? (branding.login_logo_url || branding.logo_url)
    : branding.logo_url
  const name = branding.brand_name || 'LaunchAPropFirm'

  if (!loaded) {
    return (
      <div className={cn('flex items-center gap-2.5', className)}>
        <div className="h-7 w-7 rounded-lg skel shrink-0" aria-hidden />
        {wordmark && <span className="h-4 w-24 rounded skel" aria-hidden />}
      </div>
    )
  }

  if (imageUrl) {
    return (
      <div className={cn('flex items-center', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={name} className="h-14 w-auto max-w-[280px] object-contain" />
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <DefaultMark className="h-7 w-7" />
      {/* Hold the wordmark until real branding resolves so no stale/placeholder
          name ever flashes on first paint. The brand-neutral mark shows instantly. */}
      {wordmark && (
        <span className={cn('font-semibold tracking-tight text-text transition-opacity duration-200', loaded ? 'opacity-100' : 'opacity-0')}>
          {loaded ? name : '\u00A0'}
        </span>
      )}
    </div>
  )
}

/**
 * Sidebar brand lockup — purpose-built for a narrow sidebar.
 *   Expanded:  [icon] Company Name
 *   Collapsed: [icon]
 * Uses a dedicated square Sidebar Icon (sidebar_icon_url). If none is set it falls
 * back to the built-in mark + brand name, so existing installs keep working with a
 * clean, readable lockup instead of a squeezed horizontal logo.
 */
export function SidebarBrand({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  const branding = useBranding((s) => s.branding)
  const loaded = useBranding((s) => s.loaded)
  const load = useBranding((s) => s.load)
  useEffect(() => { load() }, [load])

  const icon = branding.sidebar_icon_url
  const name = branding.brand_name || 'LaunchAPropFirm'

  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt={name} className="h-9 w-9 rounded-lg object-contain shrink-0 bg-surface-muted/40" />
      ) : loaded ? (
        <DefaultMark className="h-8 w-8 shrink-0" />
      ) : (
        <div className="h-8 w-8 rounded-lg skel shrink-0" aria-hidden />
      )}
      {!collapsed && (
        <span className={cn('font-semibold tracking-tight text-text truncate text-[15px] transition-opacity duration-200', loaded ? 'opacity-100' : 'opacity-0')}>
          {loaded ? name : '\u00A0'}
        </span>
      )}
    </div>
  )
}
