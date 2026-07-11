'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { getSession } from '@/lib/fxsim'
import { fmtDate } from '@/lib/format'
import type { AdminKycRow } from '@/types/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Search, ShieldCheck, ExternalLink, CheckCircle2, XCircle, IdCard, ScanFace, FileText, Loader2, Eye, Download,
} from 'lucide-react'

type Filter = 'all' | 'pending' | 'approved' | 'rejected'
const FILTERS: Filter[] = ['pending', 'approved', 'rejected', 'all']
const TONE = { pending: 'warn', approved: 'success', rejected: 'danger' } as const
const LABEL = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' } as const

const DOC_META = [
  { key: 'id_doc' as const,      label: 'Government ID',    icon: IdCard },
  { key: 'selfie' as const,      label: 'Selfie',           icon: ScanFace },
  { key: 'address_doc' as const, label: 'Proof of address', icon: FileText },
]
type DocKey = (typeof DOC_META)[number]['key']

/** Fetch a protected admin doc with credentials and open it in a new tab. */
async function openDoc(url: string) {
  try {
    const res = await fetch(url, { credentials: 'include', headers: { 'X-WP-Nonce': getSession().nonce || '' } })
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    const obj = URL.createObjectURL(blob)
    window.open(obj, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(obj), 60_000)
  } catch {
    toast.error('Could not open document')
  }
}

/** Download a protected admin doc with credentials. */
async function downloadDoc(url: string, label: string) {
  try {
    const res = await fetch(url, { credentials: 'include', headers: { 'X-WP-Nonce': getSession().nonce || '' } })
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    const type = blob.type || ''
    const ext = type.includes('pdf') ? 'pdf' : type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('jpeg') || type.includes('jpg') ? 'jpg' : 'bin'
    const obj = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = obj
    a.download = `${label.replace(/\s+/g, '-').toLowerCase()}.${ext}`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(obj), 60_000)
  } catch {
    toast.error('Could not download document')
  }
}

export function KycReviewQueue() {
  const [rows, setRows]   = useState<AdminKycRow[] | null>(null)
  const [filter, setFilter] = useState<Filter>('pending')
  const [query, setQuery] = useState('')
  const [reviewFor, setReviewFor] = useState<AdminKycRow | null>(null)

  const refresh = useCallback(async () => {
    const res = await api.admin.kycList(filter === 'all' ? undefined : filter)
    if (res.ok) setRows(res.data)
  }, [filter])
  useEffect(() => { setRows(null); refresh() }, [refresh])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !rows) return rows
    return rows.filter((r) =>
      r.username.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q))
  }, [rows, query])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status filter */}
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-surface border border-border">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 h-8 rounded-md text-xs font-medium capitalize transition-colors focus-ring ${
                filter === f ? 'bg-accent text-white' : 'text-text-muted hover:text-text hover:bg-surface-muted'}`}
            >
              {f === 'all' ? 'All' : LABEL[f]}
            </button>
          ))}
        </div>
        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user or email" className="pl-9" />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-subtle/40">
                <Th>User</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Submitted</Th>
                <Th className="hidden lg:table-cell">Reviewed</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows === null && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-border-subtle/40"><td colSpan={5} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
              ))}
              {filtered && filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12">
                  <ShieldCheck className="h-8 w-8 mx-auto text-text-faint mb-3" />
                  <div className="text-sm text-text-muted">No submissions{filter !== 'all' ? ` (${LABEL[filter as keyof typeof LABEL] ?? filter})` : ''}</div>
                </td></tr>
              )}
              {filtered && filtered.map((r) => (
                <tr key={r.id} className="border-b border-border-subtle/40 last:border-0 hover:bg-surface-muted/30">
                  <Td>
                    <div className="font-medium truncate">{r.name || r.username}</div>
                    <div className="text-2xs text-text-muted truncate">{r.email}</div>
                  </Td>
                  <Td><Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge></Td>
                  <Td className="hidden md:table-cell text-2xs text-text-muted">{r.submitted_at ? fmtDate(r.submitted_at, true) : '—'}</Td>
                  <Td className="hidden lg:table-cell text-2xs text-text-muted">{r.reviewed_at ? fmtDate(r.reviewed_at, true) : '—'}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setReviewFor(r)}>Review</Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {reviewFor && (
        <ReviewDialog row={reviewFor} onClose={() => setReviewFor(null)} onDone={() => { setReviewFor(null); refresh() }} />
      )}
    </div>
  )
}

function ReviewDialog({ row, onClose, onDone }: { row: AdminKycRow; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState(row.admin_note ?? '')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [preview, setPreview] = useState<{ key: DocKey; url: string; isPdf: boolean } | null>(null)
  const [previewLoading, setPreviewLoading] = useState<DocKey | null>(null)

  // Fetch a protected doc with credentials and preview it inline (image or PDF).
  const loadPreview = async (key: DocKey, url: string) => {
    if (preview && preview.key === key) { URL.revokeObjectURL(preview.url); setPreview(null); return }
    setPreviewLoading(key)
    try {
      const res = await fetch(url, { credentials: 'include', headers: { 'X-WP-Nonce': getSession().nonce || '' } })
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      if (preview) URL.revokeObjectURL(preview.url)
      setPreview({ key, url: URL.createObjectURL(blob), isPdf: blob.type === 'application/pdf' || url.toLowerCase().endsWith('.pdf') })
    } catch { toast.error('Could not load document') }
    finally { setPreviewLoading(null) }
  }
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  const act = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !note.trim()) { toast.error('Add a note explaining the rejection.'); return }
    setBusy(action)
    const res = await api.admin.kycReview(row.id, action, note.trim())
    setBusy(null)
    if (res.ok && res.data.success) { toast.success(`KYC ${action === 'approve' ? 'approved' : 'rejected'}`); onDone() }
    else toast.error(res.ok ? (res.data.message || 'Action failed') : res.error)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review verification</DialogTitle>
          <DialogDescription>{row.name || row.username} · {row.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge tone={TONE[row.status]}>{LABEL[row.status]}</Badge>
            {row.submitted_at && <span className="text-2xs text-text-muted">Submitted {fmtDate(row.submitted_at, true)}</span>}
          </div>

          <div className="grid grid-cols-1 gap-2">
            {DOC_META.map((d) => {
              const url = row.docs[d.key]
              const Icon = d.icon
              const open = preview?.key === d.key
              return (
                <div key={d.key} className="rounded-lg border border-border-subtle">
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 text-text-muted shrink-0" />
                      <span className="text-sm truncate">{d.label}</span>
                    </div>
                    {url ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => loadPreview(d.key, url)} disabled={previewLoading === d.key}>
                          {previewLoading === d.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                          {open ? 'Hide' : 'Preview'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openDoc(url)} title="Open in new tab">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => downloadDoc(url, d.label)} title="Download">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-2xs text-text-faint">Not provided</span>
                    )}
                  </div>
                  {open && preview && (
                    <div className="border-t border-border-subtle p-2 bg-bg-subtle/40">
                      {preview.isPdf ? (
                        <iframe src={preview.url} title={d.label} className="w-full h-72 rounded bg-white" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview.url} alt={d.label} className="w-full max-h-72 object-contain rounded" />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div>
            <Label htmlFor="kyc-note">Admin note {`(required to reject)`}</Label>
            <Textarea id="kyc-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              placeholder="Visible to the trader on rejection." className="mt-1" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => act('reject')} disabled={!!busy}>
            {busy === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Reject
          </Button>
          <Button variant="success" onClick={() => act('approve')} disabled={!!busy}>
            {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-4 py-3 text-2xs uppercase tracking-wider text-text-faint font-medium ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}
