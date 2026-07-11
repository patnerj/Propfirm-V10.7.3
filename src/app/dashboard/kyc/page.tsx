'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { fmtDate } from '@/lib/format'
import type { KycInfo, KycStatus } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ShieldCheck, IdCard, ScanFace, FileText, UploadCloud, X, CheckCircle2,
  Clock, AlertCircle, Loader2, FileCheck2, Lock, Wallet, Camera,
} from 'lucide-react'

type DocKey = 'id_doc' | 'selfie' | 'address_doc'
interface DocSpec { key: DocKey; title: string; hint: string; icon: React.ComponentType<{ className?: string }> }

const DOCS: DocSpec[] = [
  { key: 'id_doc',      title: 'Government ID',     hint: 'Passport, driver\u2019s licence or national ID. All four corners visible.', icon: IdCard },
  { key: 'selfie',      title: 'Selfie verification', hint: 'A clear photo of your face. Good lighting, no sunglasses or hats.',       icon: ScanFace },
  { key: 'address_doc', title: 'Proof of address',  hint: 'Utility bill or bank statement issued in the last 3 months.',             icon: FileText },
]

const MAX = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

/* ── Stepper timeline ─────────────────────────────────────────────────────── */
function Stepper({ status }: { status: KycStatus }) {
  const step = status === 'approved' ? 3 : status === 'pending' ? 2 : 1
  const rejected = status === 'rejected'
  const steps = [
    { n: 1, label: 'Upload documents' },
    { n: 2, label: 'Under review' },
    { n: 3, label: 'Verified' },
  ]
  return (
    <div className="flex items-center">
      {steps.map((s, i) => {
        const done = s.n < step
        const current = s.n === step
        const tone = rejected && s.n === 1 ? 'danger' : done ? 'success' : current ? 'accent' : 'neutral'
        const ring =
          tone === 'success' ? 'bg-success-muted text-success border-success/40'
          : tone === 'danger' ? 'bg-danger-muted text-danger border-danger/40'
          : tone === 'accent' ? 'bg-accent-muted text-accent border-accent/40'
          : 'bg-surface-muted text-text-faint border-border'
        return (
          <div key={s.n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`h-8 w-8 rounded-full border inline-flex items-center justify-center text-xs font-semibold ${ring}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : rejected && s.n === 1 ? <AlertCircle className="h-4 w-4" /> : s.n}
              </div>
              <span className={`text-2xs text-center max-w-[5.5rem] ${current ? 'text-text font-medium' : 'text-text-faint'}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1.5 -mt-5 rounded ${s.n < step ? 'bg-success/50' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Upload tile ──────────────────────────────────────────────────────────── */
function UploadTile({
  spec, file, preview, uploading, onPick, onClear,
}: {
  spec: DocSpec; file: File | null; preview: string | null; uploading: boolean
  onPick: (f: File) => void; onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const Icon = spec.icon

  const handle = (f?: File | null) => {
    if (!f) return
    if (!ACCEPT.split(',').includes(f.type)) { toast.error('Use JPG, PNG, WebP or PDF.'); return }
    if (f.size > MAX) { toast.error('File must be 5MB or smaller.'); return }
    onPick(f)
  }

  return (
    <Card className={`overflow-hidden transition-colors ${drag ? 'border-accent/60' : file ? 'border-success/30' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className={`h-9 w-9 rounded-lg inline-flex items-center justify-center shrink-0 ${file ? 'bg-success-muted text-success' : 'bg-accent-muted text-accent'}`}>
            {file ? <FileCheck2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">{spec.title}</div>
            <div className="text-2xs text-text-faint truncate">{spec.hint}</div>
          </div>
        </div>

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]) }}
            className={`w-full rounded-lg border border-dashed ${drag ? 'border-accent bg-accent-muted/20' : 'border-border'} px-3 py-6 flex flex-col items-center gap-1.5 text-center transition-colors hover:border-accent/50 hover:bg-surface-muted/40 focus-ring`}
          >
            <UploadCloud className="h-6 w-6 text-text-muted" />
            <span className="text-xs text-text">Tap to upload <span className="text-text-faint">or drag &amp; drop</span></span>
            <span className="text-2xs text-text-faint">JPG, PNG, WebP, PDF · max 5MB</span>
          </button>
        ) : (
          <div className="rounded-lg border border-border-subtle bg-surface-muted/40 p-2.5 flex items-center gap-3">
            <div className="h-14 w-14 rounded-md overflow-hidden bg-surface shrink-0 inline-flex items-center justify-center border border-border-subtle">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <FileText className="h-6 w-6 text-text-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{file.name}</div>
              <div className="text-2xs text-text-faint">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              {uploading ? (
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface overflow-hidden">
                  <div className="h-full w-2/3 rounded-full bg-accent animate-pulse" />
                </div>
              ) : (
                <div className="mt-1 inline-flex items-center gap-1 text-2xs text-success"><CheckCircle2 className="h-3 w-3" /> Ready to submit</div>
              )}
            </div>
            {!uploading && (
              <button onClick={onClear} className="h-7 w-7 inline-flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-surface-muted focus-ring shrink-0" aria-label="Remove file">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
          onChange={(e) => handle(e.target.files?.[0])} />
      </CardContent>
    </Card>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function KycPage() {
  const [kyc, setKyc] = useState<KycInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [files, setFiles] = useState<Record<DocKey, File | null>>({ id_doc: null, selfie: null, address_doc: null })
  const [previews, setPreviews] = useState<Record<DocKey, string | null>>({ id_doc: null, selfie: null, address_doc: null })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    const res = await api.kycGet()
    setLoading(false)
    if (res.ok) setKyc(res.data)
  }
  useEffect(() => { load() }, [])

  // Clean up object URLs
  useEffect(() => () => { Object.values(previews).forEach((u) => u && URL.revokeObjectURL(u)) }, [previews])

  const pick = (key: DocKey, f: File) => {
    setFiles((p) => ({ ...p, [key]: f }))
    setPreviews((p) => {
      if (p[key]) URL.revokeObjectURL(p[key]!)
      return { ...p, [key]: f.type.startsWith('image/') ? URL.createObjectURL(f) : null }
    })
  }
  const clear = (key: DocKey) => {
    setPreviews((p) => { if (p[key]) URL.revokeObjectURL(p[key]!); return { ...p, [key]: null } })
    setFiles((p) => ({ ...p, [key]: null }))
  }

  const allReady = !!(files.id_doc && files.selfie && files.address_doc)

  const submit = async () => {
    if (!allReady) return
    setSubmitting(true)
    const form = new FormData()
    form.append('id_doc', files.id_doc!)
    form.append('selfie', files.selfie!)
    form.append('address_doc', files.address_doc!)
    const res = await api.kycSubmit(form)
    setSubmitting(false)
    if (res.ok && res.data.success) {
      toast.success('Documents submitted for review')
      setFiles({ id_doc: null, selfie: null, address_doc: null })
      setPreviews({ id_doc: null, selfie: null, address_doc: null })
      load()
    } else {
      toast.error(res.ok ? (res.data.message || 'Submission failed') : res.error)
    }
  }

  const status = kyc?.status ?? 'not_started'
  const showForm = status === 'not_started' || status === 'rejected'

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Identity verification</h1>
        <p className="text-sm text-text-muted mt-1">Verify your identity (KYC) to unlock payouts on funded accounts.</p>
      </div>

      {loading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
      ) : (
        <>
          {/* Progress tracker */}
          <Card><CardContent className="p-5"><Stepper status={status} /></CardContent></Card>

          {/* Approved */}
          {status === 'approved' && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-success/40 bg-success-muted/20">
                <CardContent className="p-6 text-center">
                  <div className="h-14 w-14 rounded-full bg-success-muted text-success inline-flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <div className="font-semibold text-lg">You&apos;re verified</div>
                  <p className="text-sm text-text-muted mt-1">Your identity has been approved. Payouts are unlocked on your funded accounts.</p>
                  {kyc?.reviewed_at && <p className="text-2xs text-text-faint mt-2">Approved {fmtDate(kyc.reviewed_at, true)}</p>}
                  <Button asChild size="sm" className="mt-4"><a href="/dashboard/payouts">Go to payouts</a></Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Pending */}
          {status === 'pending' && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-warn/40 bg-warn-muted/20">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-lg bg-warn-muted text-warn inline-flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">Under review</span>
                        <Badge tone="warn">Pending review</Badge>
                      </div>
                      <p className="text-sm text-text-muted mt-1">Thanks — your documents are with our review team. You&apos;ll get an email as soon as a decision is made (usually within 1–2 business days).</p>
                      {kyc?.submitted_at && <p className="text-2xs text-text-faint mt-2">Submitted {fmtDate(kyc.submitted_at, true)}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {DOCS.map((d) => (
                      <div key={d.key} className="rounded-lg border border-border-subtle bg-surface-muted/40 px-3 py-2.5 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        <span className="text-2xs text-text-muted truncate">{d.title}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Rejected note */}
          {status === 'rejected' && (
            <Card className="border-danger/40 bg-danger-muted/20">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-sm">Your previous submission was rejected</div>
                  <p className="text-xs text-text-muted mt-0.5">{kyc?.admin_note || 'Please re-submit clear, valid documents.'}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload form (not started / rejected) */}
          {showForm && (
            <div className="grid lg:grid-cols-2 gap-4 items-start">
              {/* Left column — document uploads + submit */}
              <div className="space-y-4 order-2 lg:order-1">
                <div className="grid gap-4">
                  {DOCS.map((d) => (
                    <UploadTile
                      key={d.key}
                      spec={d}
                      file={files[d.key]}
                      preview={previews[d.key]}
                      uploading={submitting}
                      onPick={(f) => pick(d.key, f)}
                      onClear={() => clear(d.key)}
                    />
                  ))}
                </div>

                <Card className="bg-surface-muted/30">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-2xs text-text-faint flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Encrypted in transit, visible only to our verification team.
                    </p>
                    <Button onClick={submit} disabled={!allReady || submitting} className="shrink-0 w-full sm:w-auto">
                      {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : 'Submit for verification'}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right column — why we verify, security, eligibility, requirements */}
              <Card className="order-1 lg:order-2">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-lg bg-accent-muted text-accent inline-flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold">Why we verify your identity</h2>
                      <p className="text-sm text-text-muted mt-1 leading-relaxed">
                        As a regulated-style prop firm, we confirm every funded trader&apos;s identity before
                        releasing payouts. This protects your earnings, keeps the program fair, and meets our
                        anti-fraud and compliance (KYC/AML) obligations. It&apos;s a one-time check.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 mt-5">
                    <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-muted/30 p-3.5">
                      <Wallet className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">Unlocks payouts</div>
                        <div className="text-2xs text-text-muted mt-0.5 leading-relaxed">Required once before your first withdrawal on a funded account.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-muted/30 p-3.5">
                      <Lock className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">Bank-grade security</div>
                        <div className="text-2xs text-text-muted mt-0.5 leading-relaxed">Documents are encrypted in transit and seen only by our review team.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-muted/30 p-3.5">
                      <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">Fast turnaround</div>
                        <div className="text-2xs text-text-muted mt-0.5 leading-relaxed">Most submissions are reviewed within 1–2 business days.</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-lg border border-border-subtle p-4">
                    <div className="text-2xs uppercase tracking-wider text-text-faint mb-2.5">Before you start — have these ready</div>
                    <ul className="space-y-2 text-sm text-text-muted">
                      <li className="flex items-start gap-2.5"><IdCard className="h-4 w-4 text-text-muted shrink-0 mt-0.5" /><span><span className="text-text font-medium">Government ID</span> — passport, driver&apos;s licence, or national ID. All four corners visible, not expired, no glare.</span></li>
                      <li className="flex items-start gap-2.5"><Camera className="h-4 w-4 text-text-muted shrink-0 mt-0.5" /><span><span className="text-text font-medium">Selfie</span> — a clear photo of your face in good lighting, matching your ID.</span></li>
                      <li className="flex items-start gap-2.5"><FileText className="h-4 w-4 text-text-muted shrink-0 mt-0.5" /><span><span className="text-text font-medium">Proof of address</span> — a utility bill or bank statement from the last 3 months showing your name and address.</span></li>
                    </ul>
                    <p className="text-2xs text-text-faint mt-3">Tip: use clear, full-page photos or scans. Blurry, cropped, or expired documents are the most common reason a submission is rejected.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
