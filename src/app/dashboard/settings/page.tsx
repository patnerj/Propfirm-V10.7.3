'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  User, Mail, ShieldCheck, Lock, LogOut, AtSign, MailWarning, BadgeCheck,
} from 'lucide-react'

export default function SettingsPage() {
  const router          = useRouter()
  const user            = useAuth((s) => s.user)
  const signout         = useAuth((s) => s.signout)
  const refresh         = useAuth((s) => s.refresh)

  const [twoFA,    setTwoFA]    = useState<boolean | null>(null)
  const [busy,     setBusy]     = useState(false)
  const [resending, setResending] = useState(false)
  // V10.7.6 2FA 2-step enable flow
  const [tfaPending, setTfaPending] = useState(false)  // waiting for OTP confirmation
  const [tfaCode,    setTfaCode]    = useState('')      // OTP the user types

  // Load 2FA status
  useEffect(() => {
    api.auth.twoFactorStatus().then((res) => {
      if (res.ok) setTwoFA(res.data.enabled)
      else        setTwoFA(false)
    })
  }, [])

  const toggle2FA = async () => {
    if (twoFA == null) return
    if (twoFA) {
      // Disabling: single step, no OTP needed
      setBusy(true)
      const res = await api.auth.twoFactorToggle(false)
      setBusy(false)
      if (res.ok) { setTwoFA(false); toast.success('2FA disabled') }
      else        toast.error(res.error)
      return
    }
    // Enabling step 1: request OTP email
    setBusy(true)
    const res = await api.auth.twoFactorToggle(true)
    setBusy(false)
    if (res.ok && res.data.pending) {
      setTfaPending(true)
      setTfaCode('')
      toast.success('Check your email for a 6-digit code')
    } else if (res.ok && res.data.enabled) {
      setTwoFA(true); toast.success('2FA enabled')
    } else if (!res.ok) {
      toast.error(res.error || 'Something went wrong')
    } else {
      toast.error('Something went wrong')
    }
  }

  const confirmTfaCode = async () => {
    if (!tfaCode || tfaCode.length !== 6) { toast.error('Enter the 6-digit code from your email'); return }
    setBusy(true)
    const res = await api.auth.twoFactorToggle(true, tfaCode)
    setBusy(false)
    if (res.ok && res.data.enabled) {
      setTwoFA(true); setTfaPending(false); setTfaCode(''); toast.success('2FA enabled')
    } else if (!res.ok) {
      toast.error(res.error || 'Invalid code — try again')
    } else {
      toast.error(res.data.message || 'Invalid code — try again')
    }
  }

  const resendVerify = async () => {
    setResending(true)
    const res = await api.auth.resendVerification()
    setResending(false)
    if (res.ok) toast.success('Verification email sent — check your inbox')
    else        toast.error(res.error)
  }

  const handleSignout = async () => {
    await signout()
    toast.success('Signed out')
    router.replace('/')
  }

  if (!user) return null

  return (
    <div className="space-y-6 max-w-2xl mx-auto w-full">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-text-muted mt-1">Manage your account, security, and preferences.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-border-subtle">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-accent to-success flex items-center justify-center text-lg font-semibold text-white">
              {(user.display_name || user.username).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{user.display_name || user.username}</div>
              <div className="text-sm text-text-muted">@{user.username}</div>
            </div>
            {user.is_admin && <Badge tone="accent" className="ml-auto">Admin</Badge>}
          </div>

          <ReadOnlyField icon={User}  label="Username" value={user.username} />
          <ReadOnlyField icon={AtSign} label="Display name" value={user.display_name} />
          <div>
            <Label>Email</Label>
            <div className="mt-1.5 flex items-center gap-2 px-3 h-10 rounded-md border border-border bg-surface text-sm">
              <Mail className="h-4 w-4 text-text-muted" />
              <span className="flex-1 truncate">{user.email}</span>
              {user.email_verified ? (
                <Badge tone="success"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
              ) : (
                <Badge tone="warn">Unverified</Badge>
              )}
            </div>
            {!user.email_verified && (
              <div className="mt-2 text-xs text-text-muted flex items-center gap-1.5">
                <MailWarning className="h-3.5 w-3.5 text-warn" />
                Verify your email to enable payouts.
                <button
                  onClick={resendVerify}
                  disabled={resending}
                  className="text-accent hover:underline disabled:opacity-50 ml-1"
                >
                  {resending ? 'Sending…' : 'Resend verification'}
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader><CardTitle>Security</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-success-muted text-success flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">Two-factor authentication</div>
                <div className="text-xs text-text-muted">Get a one-time code sent to your email on every sign-in.</div>
              </div>
            </div>
            <div className="shrink-0">
              {twoFA == null ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <Button
                  variant={twoFA ? 'outline' : 'primary'}
                  size="sm"
                  loading={busy && !tfaPending}
                  onClick={tfaPending ? undefined : toggle2FA}
                  disabled={tfaPending}
                >
                  {twoFA ? 'Disable' : 'Enable'}
                </Button>
              )}
            </div>
          </div>

          {/* V10.7.6: OTP confirmation step shown after clicking Enable */}
          {tfaPending && (
            <div className="rounded-lg border border-accent/40 bg-accent-muted/20 p-3 space-y-2">
              <p className="text-xs text-text-muted">
                A 6-digit code was sent to <strong>{user.email}</strong>. Enter it below to confirm.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={tfaCode}
                  onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="flex-1 h-9 rounded-md border border-border bg-surface px-3 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <Button size="sm" loading={busy} onClick={confirmTfaCode}>Confirm</Button>
                <Button size="sm" variant="outline" onClick={() => { setTfaPending(false); setTfaCode('') }}>Cancel</Button>
              </div>
            </div>
          )}

          <hr className="border-border-subtle" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-accent-muted text-accent flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">Password</div>
                <div className="text-xs text-text-muted">Update your password through the password-reset email link.</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const res = await api.auth.requestReset(user.email)
                if (res.ok) toast.success('Password reset link sent to your email')
                else        toast.error(res.error)
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account actions */}
      <Card className="border-danger/30">
        <CardHeader><CardTitle className="text-danger">Account actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Sign out</div>
              <div className="text-xs text-text-muted">End your session on this device.</div>
            </div>
            <Button variant="outline" onClick={handleSignout} size="sm">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReadOnlyField({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-center gap-2 px-3 h-10 rounded-md border border-border bg-surface-muted/50 text-sm">
        <Icon className="h-4 w-4 text-text-muted" />
        <span className="truncate">{value}</span>
      </div>
    </div>
  )
}
