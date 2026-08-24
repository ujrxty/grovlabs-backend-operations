'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Eye, ExternalLink, ChevronLeft, ChevronRight, AlertTriangle, FileText } from 'lucide-react'
import { CallRecord } from '@/lib/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function formatDuration(seconds: number): string {
  const m = Math.floor((seconds ?? 0) / 60)
  const s = (seconds ?? 0) % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function CallQAContent() {
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [viewCall, setViewCall] = useState<CallRecord | null>(null)

  const fetchCalls = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (flaggedOnly) params.set('flagged', 'true')
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      params.set('page', String(page))
      const res = await fetch(`/api/calls?${params.toString()}`)
      const data = await res.json()
      setCalls(data?.calls ?? [])
      setTotalPages(data?.pages ?? 1)
      setTotal(data?.total ?? 0)
    } catch {
      toast.error('Failed to load calls')
    }
    setLoading(false)
  }, [search, flaggedOnly, dateFrom, dateTo, page])

  useEffect(() => { fetchCalls() }, [fetchCalls])

  return (
    <div className="space-y-6">
      <PageHeader title="Call QA Logs" description={`Browse and filter analyzed calls (${total} total)`} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by call ID or caller number..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1) }}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="flagged" checked={flaggedOnly} onCheckedChange={(v: boolean) => { setFlaggedOnly(v); setPage(1) }} />
            <Label htmlFor="flagged" className="text-sm">Flagged only</Label>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDateFrom(e.target.value); setPage(1) }} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDateTo(e.target.value); setPage(1) }} className="w-[160px]" />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Caller</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Flagged</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Recording</TableHead>
                <TableHead className="w-[60px]">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_: any, i: number) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((__: any, j: number) => (
                      <TableCell key={j}><div className="h-4 animate-pulse bg-muted rounded w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (calls?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No calls found</TableCell>
                </TableRow>
              ) : (
                (calls ?? []).map((call: CallRecord) => (
                  <TableRow key={call?.id} className={cn('hover:bg-muted/50', call?.qa_analysis?.is_flagged ? 'bg-red-50/50' : '')}>
                    <TableCell className="text-xs whitespace-nowrap">{call?.created_at ? new Date(call.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date(call.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{call?.caller_number || call?.trackdrive_call_id?.slice?.(0, 12) || '—'}</TableCell>
                    <TableCell className="text-sm">{call?.affiliate?.name ?? '—'}</TableCell>
                    <TableCell className="text-sm">{call?.campaign_name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{formatDuration(call?.duration ?? 0)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{call?.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {call?.qa_analysis?.is_flagged ? (
                        <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                          <AlertTriangle className="h-3 w-3" /> Yes
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {call?.qa_analysis ? (
                        <span className="font-mono text-xs">
                          {(call?.qa_analysis?.confidence_score ?? 0).toFixed(0)}%
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {call?.recording_url ? (
                        <a href={call.recording_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" onClick={() => setViewCall(call)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={!!viewCall} onOpenChange={(open: boolean) => { if (!open) setViewCall(null) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Details: {viewCall?.trackdrive_call_id}
            </DialogTitle>
          </DialogHeader>
          {viewCall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Vendor:</span> <span className="font-medium">{viewCall?.affiliate?.name ?? '—'}</span></div>
                <div><span className="text-muted-foreground">Campaign:</span> <span className="font-medium">{viewCall?.campaign_name ?? '—'}</span></div>
                <div><span className="text-muted-foreground">Buyer:</span> <span className="font-medium">{viewCall?.buyer_name ?? '—'}</span></div>
                <div><span className="text-muted-foreground">Caller:</span> <span className="font-mono">{viewCall?.caller_number ?? '—'}</span></div>
                <div><span className="text-muted-foreground">Duration:</span> <span className="font-mono">{formatDuration(viewCall?.duration ?? 0)}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="text-xs capitalize">{viewCall?.status}</Badge></div>
              </div>

              {viewCall?.qa_analysis && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-primary" /> QA Analysis
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Flagged:</span>{' '}
                      {viewCall.qa_analysis.is_flagged ? (
                        <Badge className="bg-red-100 text-red-800 text-xs">Yes</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">No</Badge>
                      )}
                    </div>
                    <div><span className="text-muted-foreground">Confidence:</span> <span className="font-mono">{(viewCall?.qa_analysis?.confidence_score ?? 0).toFixed(1)}%</span></div>
                    <div><span className="text-muted-foreground">High Sensitivity:</span> <span>{viewCall?.qa_analysis?.high_sensitivity ? 'Yes' : 'No'}</span></div>
                  </div>
                  {viewCall?.qa_analysis?.flag_reason && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground">Flag Reason:</p>
                      <p className="text-sm mt-1 bg-red-50 p-2 rounded">{viewCall.qa_analysis.flag_reason}</p>
                    </div>
                  )}
                  {(viewCall?.qa_analysis?.detected_triggers?.length ?? 0) > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-1">Detected Triggers:</p>
                      <div className="flex flex-wrap gap-1">
                        {(viewCall?.qa_analysis?.detected_triggers ?? []).map((t: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {viewCall?.qa_analysis?.ai_summary && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground">AI Summary:</p>
                      <p className="text-sm mt-1 bg-muted p-3 rounded-lg">{viewCall.qa_analysis.ai_summary}</p>
                    </div>
                  )}
                </div>
              )}

              {viewCall?.transcript && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-2">Transcript</h4>
                  <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {viewCall.transcript.transcript_text}
                  </pre>
                </div>
              )}

              {viewCall?.recording_url && (
                <div className="border-t pt-4">
                  <a href={viewCall.recording_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="h-4 w-4" /> Open Recording
                    </Button>
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}