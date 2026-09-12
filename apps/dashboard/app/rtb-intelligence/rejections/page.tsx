'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { useRTBFilters } from '@/components/rtb/rtb-filter-context'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { XCircle } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface RejectReason {
  reason: string
  count: number
  pct: number
}

const REASON_LABELS: Record<string, string> = {
  cap_reached: 'Cap Reached',
  state_not_serviced: 'State Not Serviced',
  duplicate: 'Duplicate',
  invalid_data: 'Invalid Data',
  timeout: 'Timeout',
  quality_score: 'Quality Score',
  filter_rules: 'Filter Rules',
  other: 'Other',
  unknown: 'Unknown',
}

export default function RejectionsPage() {
  const { buildQueryString } = useRTBFilters()
  const [data, setData] = useState<RejectReason[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const qs = buildQueryString()
    try {
      const res = await fetch(`${QA_AGENT_URL}/pings/reject-reasons?${qs}`)
      if (res.ok) setData(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [buildQueryString])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const chartData = data.map(r => ({
    ...r,
    label: REASON_LABELS[r.reason] || r.reason,
  }))

  const total = data.reduce((sum, r) => sum + r.count, 0)

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-red-500">{total.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Rejections</div>
              </CardContent>
            </Card>
            {data.slice(0, 3).map((r) => (
              <Card key={r.reason}>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{r.count.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">{REASON_LABELS[r.reason] || r.reason}</div>
                  <div className="text-xs text-muted-foreground">{r.pct}% of rejections</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rejection Reasons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis type="number" stroke="#888" fontSize={12} />
                      <YAxis dataKey="label" type="category" width={120} stroke="#888" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                      <Bar dataKey="count" fill="#ef4444" name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">% of Rejections</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.reason}>
                      <TableCell className="font-medium">{REASON_LABELS[row.reason] || row.reason}</TableCell>
                      <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.pct}%</TableCell>
                    </TableRow>
                  ))}
                  {data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No rejections recorded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
