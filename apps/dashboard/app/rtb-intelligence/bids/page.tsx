'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { useRTBFilters } from '@/components/rtb/rtb-filter-context'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface BidAnalysis {
  total_bids: number
  avg_bid: number
  min_bid: number
  max_bid: number
  median_bid: number
  p25_bid: number
  p75_bid: number
  suggested_floor: number
  distribution: { range: string; count: number; pct: number }[]
  by_buyer: { buyer: string; avg_bid: number; win_rate: number; total_bids: number }[]
}

export default function BidsPage() {
  const { buildQueryString } = useRTBFilters()
  const [data, setData] = useState<BidAnalysis | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const qs = buildQueryString()
    try {
      const res = await fetch(`${QA_AGENT_URL}/pings/stats/bids?${qs}`)
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
      ) : data && data.total_bids > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Total Bids</div>
                <div className="text-xl font-bold">{data.total_bids.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Avg Bid</div>
                <div className="text-xl font-bold text-emerald-500">${data.avg_bid.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Median</div>
                <div className="text-xl font-bold">${data.median_bid.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Min</div>
                <div className="text-xl font-bold">${data.min_bid.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Max</div>
                <div className="text-xl font-bold">${data.max_bid.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">25th %ile</div>
                <div className="text-xl font-bold">${data.p25_bid.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">75th %ile</div>
                <div className="text-xl font-bold">${data.p75_bid.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-lime-500/30 bg-lime-500/5">
            <CardContent className="pt-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-lime-500" />
              <div>
                <div className="text-sm font-medium">Suggested Bid Floor</div>
                <div className="text-lg font-bold text-lime-500">${data.suggested_floor.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">
                  Based on 25th percentile (-10%). Setting a floor here would reject the bottom 25% of bids.
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bid Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.distribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="range" stroke="#888" fontSize={11} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                      <Bar dataKey="count" fill="#22c55e" name="Bids" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Buyer Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Buyer</TableHead>
                      <TableHead className="text-right">Avg Bid</TableHead>
                      <TableHead className="text-right">Win Rate</TableHead>
                      <TableHead className="text-right">Total Wins</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_buyer.map((row) => (
                      <TableRow key={row.buyer}>
                        <TableCell className="font-medium max-w-[150px] truncate">{row.buyer}</TableCell>
                        <TableCell className="text-right font-mono">${row.avg_bid.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn(row.win_rate >= 30 ? 'text-emerald-500' : '')}>
                            {row.win_rate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{row.total_bids.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {data.by_buyer.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No buyer data
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No bid data available for the selected filters
          </CardContent>
        </Card>
      )}
    </div>
  )
}
