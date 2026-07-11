'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/store/auth'
import { useImpersonation } from '@/store/impersonation'
import { api } from '@/lib/api'
import type { NotificationsResp } from '@/types/api'
import { useVisibilityPoll } from '@/hooks/use-visibility-poll'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Menu, Bell, User, LogOut, Settings, Trophy } from 'lucide-react'

interface Props { onMenuClick: () => void }

/** Normalise any notification link (absolute backend URL, frontend URL, or
 *  relative path) to an in-app SPA path so it routes client-side. */
function toAppPath(link: string): string {
  if (!link) return '/dashboard'
  try {
    if (/^https?:\/\//i.test(link)) { const u = new URL(link); return (u.pathname || '/dashboard') + u.search }
    return link.startsWith('/') ? link : `/${link}`
  } catch { return '/dashboard' }
}

export function DashboardTopbar({ onMenuClick }: Props) {
  const router = useRouter()
  const user   = useAuth((s) => s.user)
  const signout = useAuth((s) => s.signout)
  const impersonating = useImpersonation((s) => !!s.record)
  const adminMode = user?.is_admin === true && !impersonating
  const [notifs, setNotifs] = useState<NotificationsResp | null>(null)

  const loadNotifs = async () => {
    const res = adminMode ? await api.admin.notifications() : await api.notifications()
    if (res.ok) setNotifs(res.data)
  }
  // Poll every 30s, paused on hidden tabs
  useVisibilityPoll(loadNotifs, 30_000, true)

  const handleSignout = async () => {
    await signout()
    router.replace('/')
  }

  const initials = (user?.display_name || user?.username || '?').slice(0, 2).toUpperCase()
  const unread   = notifs?.unread_count ?? 0

  return (
    <header className="sticky top-0 z-20 h-16 flex items-center gap-2 px-4 md:px-8 border-b border-border-subtle bg-bg/90 backdrop-blur-sm">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-2 rounded-md hover:bg-surface-muted focus-ring"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Spacer — page title slot could go here if needed */}
      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        {/* Notifications */}
        <NotificationsButton unread={unread} notifs={notifs} adminMode={adminMode} onReadAll={async () => {
          await (adminMode ? api.admin.notificationsRead([]) : api.notificationsRead([]))
          loadNotifs()
        }} />

        {/* Profile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 h-9 pl-2 pr-3 rounded-md hover:bg-surface-muted focus-ring transition-colors"
              aria-label="Profile menu"
            >
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-accent to-success flex items-center justify-center text-2xs font-semibold text-white">
                {initials}
              </div>
              <span className="hidden md:block text-sm font-medium text-text">{user?.display_name || user?.username}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[220px]">
            <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
            <div className="px-2.5 pb-2 text-sm">
              <div className="font-medium truncate">{user?.display_name || user?.username}</div>
              <div className="text-text-muted text-xs truncate">{user?.email}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard"><User className="h-4 w-4" /> Dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/challenges"><Trophy className="h-4 w-4" /> My challenges</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings"><Settings className="h-4 w-4" /> Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={handleSignout}>
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function NotificationsButton({
  unread, notifs, onReadAll, adminMode,
}: {
  unread: number
  notifs: NotificationsResp | null
  onReadAll: () => void | Promise<void>
  adminMode?: boolean
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const on = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-notif-pop]')) setOpen(false)
    }
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [open])

  return (
    <div className="relative" data-notif-pop>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-surface-muted focus-ring"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="h-5 w-5 text-text-muted" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 inline-flex h-4 min-w-4 px-1 items-center justify-center text-2xs font-semibold text-white bg-danger rounded-full">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-[340px] max-w-[calc(100vw-2rem)] rounded-lg glass-strong shadow-card-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <div className="font-semibold text-sm">Notifications</div>
              {unread > 0 && (
                <button
                  onClick={() => { onReadAll(); setOpen(false) }}
                  className="text-2xs text-accent hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[340px] overflow-y-auto">
              {!notifs ? (
                <div className="p-4 text-center text-sm text-text-muted">Loading…</div>
              ) : notifs.notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-8 w-8 mx-auto text-text-faint mb-2" />
                  <div className="text-sm text-text-muted">No notifications yet</div>
                </div>
              ) : (
                notifs.notifications.slice(0, 8).map((n) => {
                  const inner = (
                    <div className="flex items-start gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${
                        n.type === 'success' ? 'bg-success' :
                        n.type === 'error'   ? 'bg-danger' :
                        n.type === 'warning' ? 'bg-warn' : 'bg-info'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{n.title}</div>
                        <div className="text-xs text-text-muted line-clamp-2">{n.message}</div>
                      </div>
                    </div>
                  )
                  const cls = `block px-4 py-3 border-b border-border-subtle last:border-0 hover:bg-surface-muted/40 transition-colors ${!n.is_read ? 'bg-accent-muted/20' : ''}`
                  return n.link
                    ? <Link key={n.id} href={toAppPath(n.link)} onClick={() => setOpen(false)} className={cls}>{inner}</Link>
                    : <div key={n.id} className={cls}>{inner}</div>
                })
              )}
            </div>

            <div className="px-4 py-2 border-t border-border-subtle">
              <Link
                href={adminMode ? '/dashboard/admin/notifications' : '/dashboard/notifications'}
                onClick={() => setOpen(false)}
                className="block text-center text-2xs text-accent hover:underline"
              >
                View all notifications →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
