'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { ChallengeAccount, Certificate as Cert } from '@/types/api'
import { CertificateDocument } from '@/components/certificate-document'
import { downloadCertificatePdf } from '@/lib/certificate-pdf'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Award, Download, ExternalLink } from 'lucide-react'

export default function CertificatesPage() {
  const [list,    setList]    = useState<ChallengeAccount[] | null>(null)
  const [certs,   setCerts]   = useState<Record<number, Cert | null>>({})

  useEffect(() => {
    (async () => {
      const res = await api.challengeMy()
      if (!res.ok) { setList([]); return }
      const eligible = res.data.filter((c) => c.status === 'passed' || c.status === 'funded')
      setList(eligible)

      // Load certificates in parallel (per-call cache prevents duplication)
      const results = await Promise.all(eligible.map(async (c) => {
        const r = await api.certificate(c.id)
        return [c.id, r.ok ? r.data : null] as const
      }))
      setCerts(Object.fromEntries(results))
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Certificates</h1>
        <p className="text-sm text-text-muted mt-1">
          Earn a certificate for every passed or funded challenge. Share them publicly with confidence.
        </p>
      </div>

      {list === null ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <Card key={i} className="p-6"><Skeleton className="h-64 w-full" /></Card>)}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <div className="inline-flex h-12 w-12 rounded-xl bg-warn-muted text-warn items-center justify-center mb-4">
              <Award className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">No certificates yet</h2>
            <p className="text-sm text-text-muted mt-2 max-w-md mx-auto">
              Pass an evaluation to earn your first certificate.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={list.length === 1 ? "flex justify-center" : "grid md:grid-cols-2 gap-4"}>
          {list.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={list.length === 1 ? "w-full max-w-lg" : ""}
            >
              <CertificateCard cert={certs[c.id]} challenge={c} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function CertificateCard({ cert, challenge }: { cert: Cert | null | undefined; challenge: ChallengeAccount }) {
  const c = cert
  const [downloading, setDownloading] = useState(false)

  if (c === undefined) return <Card className="p-6"><Skeleton className="h-72 w-full" /></Card>
  if (c === null) return (
    <Card><CardContent className="py-12 text-center text-sm text-text-muted">Certificate unavailable yet</CardContent></Card>
  )

  // Ensure the document can resolve funded vs passed even on older cached payloads.
  const doc: Cert = { ...c, status: c.status ?? challenge.status }
  const shareHref = c.share_code ? `/certificate/${c.share_code}` : undefined
  const download = async () => {
    setDownloading(true)
    try { await downloadCertificatePdf(doc) }
    catch { toast.error('Could not generate the PDF. Please try again.') }
    finally { setDownloading(false) }
  }

  return (
    <Card className="overflow-hidden relative">
      <CertificateDocument cert={doc} />
      <div className="px-6 pb-4 -mt-1 flex items-center justify-end gap-1.5">
        {shareHref && (
          <a href={shareHref} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /> View / Share</Button>
          </a>
        )}
        <Button variant="ghost" size="sm" onClick={download} loading={downloading}>
          <Download className="h-4 w-4" /> Download
        </Button>
      </div>
    </Card>
  )
}
