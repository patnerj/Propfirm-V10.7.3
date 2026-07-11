'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { SidebarBrand } from '@/components/logo'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { useImpersonation } from '@/store/impersonation'
import { cn } from '@/lib/cn'
import {
  LayoutDashboard, Trophy, History, Banknote,
  Award, Bell, Settings, X, LifeBuoy, CandlestickChart,
  Users, CreditCard, Layers, BarChart3, SlidersHorizontal, PanelLeftClose, PanelLeftOpen, Mail, Megaphone, Ticket, Users2, HeartPulse, Rocket, Gauge,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NavItem {
  href:  string
  label: string
  icon:  React.ComponentType<{ className?: string }>
  badge?: string
}

const NAV: NavItem[] = [
  { href: '/dashboard',                label: 'Overview',     icon: LayoutDashboard },
  { href: '/dashboard/trading',        label: 'Trade',         icon: CandlestickChart, badge: 'LIVE' },
  { href: '/dashboard/challenges',     label: 'Challenges',   icon: Trophy },
  { href: '/dashboard/history',        label: 'Trade history', icon: History },
  { href: '/dashboard/payouts',        label: 'Payouts',      icon: Banknote },
  { href: '/dashboard/affiliate',      label: 'Affiliate',    icon: Users2 },
  { href: '/dashboard/certificates',   label: 'Certificates', icon: Award },
  { href: '/dashboard/notifications',  label: 'Notifications', icon: Bell },
  { href: '/dashboard/settings',       label: 'Settings',     icon: Settings },
]

// Admin navigation — shown only to admins while inside /dashboard/admin.
// Replaces the trader nav entirely so the admin workspace is self-contained.
const ADMIN_NAV: NavItem[] = [
  { href: '/dashboard/admin',            label: 'Overview',   icon: LayoutDashboard },
  { href: '/dashboard/admin/users',      label: 'Users',      icon: Users },
  { href: '/dashboard/admin/challenges', label: 'Challenges', icon: Trophy },
  { href: '/dashboard/admin/payments',   label: 'Payments',   icon: CreditCard },
  { href: '/dashboard/admin/plans',      label: 'Plans',      icon: Layers },
  { href: '/dashboard/admin/challenge-operations', label: 'Challenge Operations', icon: SlidersHorizontal },
  { href: '/dashboard/admin/analytics',     label: 'Analytics',  icon: BarChart3 },
  { href: '/dashboard/admin/notifications', label: 'Activity',   icon: Bell },
  { href: '/dashboard/admin/banners',       label: 'Banners',    icon: Megaphone },
  { href: '/dashboard/admin/coupons',       label: 'Coupons',    icon: Ticket },
  { href: '/dashboard/admin/affiliates',    label: 'Affiliates', icon: Users2 },
  { href: '/dashboard/admin/email',         label: 'Email Campaigns', icon: Mail },
  { href: '/dashboard/admin/setup',         label: 'Setup',      icon: Rocket },
  { href: '/dashboard/admin/operations',    label: 'Operations', icon: Gauge },
  { href: '/dashboard/admin/health',        label: 'System Status', icon: HeartPulse },
  { href: '/dashboard/admin/settings',      label: 'Settings',   icon: Settings },
]

interface Props { open: boolean; onClose: () => void; collapsed?: boolean; onToggleCollapse?: () => void }

export function DashboardSidebar({ open, onClose, collapsed = false, onToggleCollapse }: Props) {
  // BUG-012: lock background scroll while the mobile drawer is open so the
  // dashboard behind the overlay can't scroll or show through as a second layer.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className={cn(
        'hidden lg:flex fixed inset-y-0 left-0 flex-col border-r border-border-subtle bg-bg-subtle/40 backdrop-blur z-30 transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}>
        <SidebarBody collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 bg-black/70 z-[60]"
              onClick={onClose}
              aria-hidden
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="lg:hidden fixed inset-y-0 left-0 w-[17rem] max-w-[85vw] flex-col bg-bg-subtle border-r border-border z-[70] flex shadow-2xl"
            >
              <div className="flex items-center justify-end h-14 px-3 border-b border-border-subtle shrink-0">
                <button
                  onClick={onClose}
                  className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-surface-muted text-text-muted focus-ring"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarBody />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function SidebarBody({ collapsed = false, onToggleCollapse }: { collapsed?: boolean; onToggleCollapse?: () => void }) {
  const pathname = usePathname()
  const isAdmin = useAuth((s) => s.user?.is_admin === true)
  const impersonating = useImpersonation((s) => s.record !== null)
  // Role-driven nav: an admin gets the admin sidebar as their PRIMARY (and
  // only) navigation — the trader items are removed entirely, with no extra
  // "Admin panel" entry. During impersonation we fall back to the trader nav,
  // since the active session cookie then belongs to the impersonated trader.
  const adminMode = isAdmin && !impersonating
  // Setup is a first-run onboarding wizard: visible until completed, then hidden
  // (Re-run Setup stays available from Settings). We re-check completion on every
  // route change, so finishing the wizard — which navigates away from /setup —
  // hides the item immediately, with no hard refresh required.
  const [setupDone, setSetupDone] = useState(false)
  useEffect(() => {
    if (!adminMode) return
    let cancel = false
    api.admin.whitelabelGet().then((r) => {
      if (!cancel && r.ok && (r.data as Record<string, string>).setup_completed === '1') setSetupDone(true)
    })
    return () => { cancel = true }
  }, [adminMode, pathname])

  const items = adminMode
    ? ADMIN_NAV.filter((i) => !(setupDone && i.href === '/dashboard/admin/setup'))
    : NAV
  const homeHref = adminMode ? '/dashboard/admin' : '/dashboard'

  return (
    <>
      <div className={cn('border-b border-border-subtle flex items-center gap-2', collapsed ? 'px-2 py-5 justify-center' : 'px-4 py-5 justify-between')}>
        <Link href={homeHref} className="focus-ring rounded-md flex items-center gap-2 min-w-0 flex-1">
          <SidebarBrand collapsed={collapsed} />
        </Link>
        {onToggleCollapse && !collapsed && (
          <button onClick={onToggleCollapse} aria-label="Collapse sidebar"
            className="hidden lg:inline-flex shrink-0 p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-muted focus-ring">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {onToggleCollapse && collapsed && (
        <button onClick={onToggleCollapse} aria-label="Expand sidebar"
          className="hidden lg:flex mx-auto mt-2 p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-muted focus-ring">
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((it) => {
          // Exact match on the section root, prefix match on sub-routes
          const isRoot = it.href === '/dashboard' || it.href === '/dashboard/admin'
          const active = isRoot
            ? pathname === it.href
            : pathname?.startsWith(it.href)
          const Icon = it.icon
          const tone = adminMode ? 'warn' : 'accent'
          return (
            <Link
              key={it.href}
              href={it.href}
              title={collapsed ? it.label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                'focus-ring relative group',
                collapsed && 'justify-center px-0',
                active
                  ? adminMode
                    ? 'bg-warn-muted text-warn font-medium'
                    : 'bg-accent-muted text-accent font-medium'
                  : 'text-text-muted hover:text-text hover:bg-surface-muted',
              )}
            >
              {active && !collapsed && (
                <span className={cn(
                  'absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r',
                  adminMode ? 'bg-warn' : 'bg-accent',
                )} />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1">{it.label}</span>}
              {it.badge && !collapsed && (
                <span className="text-[0.6rem] tracking-wider font-semibold px-1.5 py-0.5 rounded bg-success/15 text-success inline-flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-success animate-pulse" />
                  {it.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className={cn('border-t border-border-subtle space-y-2', collapsed ? 'px-2 py-4' : 'px-3 py-4')}>
        {collapsed ? (
          <Link href="/faq" title="Help & docs"
            className="flex items-center justify-center p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-muted transition-colors">
            <LifeBuoy className="h-4 w-4" />
          </Link>
        ) : adminMode ? (
          <Link
            href="/faq"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
          >
            <LifeBuoy className="h-4 w-4" />
            Help &amp; docs
          </Link>
        ) : (
          <>
            <Link
              href="/faq"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
            >
              <LifeBuoy className="h-4 w-4" />
              Help &amp; FAQ
            </Link>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/challenges">+ Start new challenge</Link>
            </Button>
          </>
        )}
      </div>
    </>
  )
}
