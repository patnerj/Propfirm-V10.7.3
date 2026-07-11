'use client'

import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { useAuth } from '@/store/auth'
import { NativeShell } from '@/components/native-shell'
import { useImpersonation } from '@/store/impersonation'

export function Providers({ children }: { children: React.ReactNode }) {
  const bootstrap = useAuth((s) => s.bootstrap)
  const hydrateImpersonation = useImpersonation((s) => s.hydrate)
  useEffect(() => {
    bootstrap()
    hydrateImpersonation()
  }, [bootstrap, hydrateImpersonation])

  return (
    <NativeShell>
      {children}
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'rgba(14,20,34,.95)',
            border: '1px solid rgba(124,110,245,.25)',
            color: '#e5e7eb',
            backdropFilter: 'blur(20px)',
          },
        }}
      />
    </NativeShell>
  )
}
