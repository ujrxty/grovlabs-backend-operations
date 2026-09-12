'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { useRTBFilters } from '@/components/rtb/rtb-filter-context'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface SegmentStats {
  name: string
  pings: number
  accepted: number
  accept_rate: number
  total_bid: number
  avg_bid: number
  pct_of_total: number
}

export default function OffersPage() {
  const { buildQueryString } = useRTBFilters()
  const [data, setData] = useState<SegmentStats[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const qs = buildQueryString()
    try {
      const res = await fetch(`${QA_AGENT_URL}/pings/stats/by-offer?${qs}&limit=50`)
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

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          {data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pings by Offer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis type="number" stroke="#888" fontSize={12} />
                      <YAxis dataKey="name" type="category" width={150} stroke="#888" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                      <Bar dataKey="pings" fill="#3b82f6" name="Total Pings" />
                      <Bar dataKey="accepted" fill="#22c55e" name="Accepted" />
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
                    <TableHead>Offer</TableHead>
                    <TableHead className="text-right">Pings</TableHead>
                    <TableHead className="text-right">Accepted</TableHead>
                    <TableHead className="text-right">Accept Rate</TableHead>
                    <TableHead className="text-right">Total Bid</TableHead>
                    <TableHead className="text-right">Avg Bid</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.pings.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.accepted.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn(row.accept_rate >= 30 ? 'text-emerald-500' : row.accept_rate < 10 ? 'text-red-500' : '')}>
                          {row.accept_rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">${row.total_bid.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">${row.avg_bid.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{row.pct_of_total}%</TableCell>
                    </TableRow>
                  ))}
                  {data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No data available
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
