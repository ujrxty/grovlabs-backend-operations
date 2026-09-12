'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { useRTBFilters } from '@/components/rtb/rtb-filter-context'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { TrendingUp, DollarSign, Copy, Clock, Radio } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface Stats {
  total_pings: number
  accepted: number
  rejected: number
  duplicates: number
  accept_rate: number
  total_bid_amount: number
  avg_bid: number
  avg_latency_ms: number
  unique_callers: number
}

interface TrendPoint {
  timestamp: string
  pings: number
  accepted: number
  accept_rate: number
  total_bid: number
  avg_bid: number
}

export default function RTBOverviewPage() {
  const { buildQueryString } = useRTBFilters()
  const [stats, setStats] = useState<Stats | null>(null)
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const qs = buildQueryString()
    try {
      const [statsRes, trendsRes] = await Promise.all([
        fetch(`${QA_AGENT_URL}/pings/stats?${qs}`),
        fetch(`${QA_AGENT_URL}/pings/stats/trends?${qs}&granularity=day`),
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (trendsRes.ok) setTrends(await trendsRes.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [buildQueryString])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatDate = (ts: string) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Pings</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats?.total_pings.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Accept Rate</span>
                </div>
                <div className="text-2xl font-bold text-emerald-500 mt-1">{stats?.accept_rate || 0}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Total Bid Value</span>
                </div>
                <div className="text-2xl font-bold text-emerald-500 mt-1">${stats?.total_bid_amount.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Avg Bid</span>
                </div>
                <div className="text-2xl font-bold mt-1">${stats?.avg_bid.toFixed(2) || '0.00'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Copy className="h-4 w-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Duplicates</span>
                </div>
                <div className="text-2xl font-bold text-orange-500 mt-1">{stats?.duplicates.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Avg Latency</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats?.avg_latency_ms || 0}ms</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ping Volume & Accept Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="timestamp" tickFormatter={formatDate} stroke="#888" fontSize={12} />
                      <YAxis yAxisId="left" stroke="#888" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                        labelFormatter={(v) => formatDate(v as string)}
                      />
                      <Bar yAxisId="left" dataKey="pings" fill="#3b82f6" name="Pings" />
                      <Line yAxisId="right" type="monotone" dataKey="accept_rate" stroke="#22c55e" strokeWidth={2} name="Accept %" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bid Value Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="timestamp" tickFormatter={formatDate} stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                        labelFormatter={(v) => formatDate(v as string)}
                        formatter={(v: number) => [`$${v.toFixed(2)}`, '']}
                      />
                      <Line type="monotone" dataKey="total_bid" stroke="#22c55e" strokeWidth={2} name="Total Bid" dot={false} />
                      <Line type="monotone" dataKey="avg_bid" stroke="#f59e0b" strokeWidth={2} name="Avg Bid" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
