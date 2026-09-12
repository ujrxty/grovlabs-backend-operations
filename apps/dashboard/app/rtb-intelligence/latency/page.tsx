'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { Gauge, Clock, AlertTriangle, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface LatencyStats {
  overall: {
    p50: number
    p75: number
    p95: number
    p99: number
    avg: number
    min: number
    max: number
  }
  by_buyer: {
    buyer: string
    avg_ms: number
    p95: number
    samples: number
  }[]
  by_state: {
    state: string
    avg_ms: number
    p95: number
    samples: number
  }[]
  slow_requests: {
    timestamp: string
    buyer: string
    latency_ms: number
    state: string
  }[]
  distribution: {
    bucket: string
    count: number
  }[]
}

export default function LatencyPage() {
  const [stats, setStats] = useState<LatencyStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${QA_AGENT_URL}/analytics/latency-stats?days=7`)
      if (res.ok) setStats(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getLatencyColor = (ms: number) => {
    if (ms < 200) return 'text-emerald-500'
    if (ms < 500) return 'text-lime-500'
    if (ms < 1000) return 'text-amber-500'
    return 'text-red-500'
  }

  const getLatencyBadge = (ms: number) => {
    if (ms < 200) return <Badge className="bg-emerald-500/20 text-emerald-500">Fast</Badge>
    if (ms < 500) return <Badge className="bg-lime-500/20 text-lime-500">Good</Badge>
    if (ms < 1000) return <Badge className="bg-amber-500/20 text-amber-500">Slow</Badge>
    return <Badge className="bg-red-500/20 text-red-500">Critical</Badge>
  }

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">P50</div>
                <div className={`text-2xl font-bold ${getLatencyColor(stats.overall?.p50 ?? 0)}`}>
                  {(stats.overall?.p50 ?? 0).toFixed(0)}ms
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">P75</div>
                <div className={`text-2xl font-bold ${getLatencyColor(stats.overall?.p75 ?? 0)}`}>
                  {(stats.overall?.p75 ?? 0).toFixed(0)}ms
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">P95</div>
                <div className={`text-2xl font-bold ${getLatencyColor(stats.overall?.p95 ?? 0)}`}>
                  {(stats.overall?.p95 ?? 0).toFixed(0)}ms
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">P99</div>
                <div className={`text-2xl font-bold ${getLatencyColor(stats.overall?.p99 ?? 0)}`}>
                  {(stats.overall?.p99 ?? 0).toFixed(0)}ms
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Average</div>
                <div className={`text-2xl font-bold ${getLatencyColor(stats.overall?.avg ?? 0)}`}>
                  {(stats.overall?.avg ?? 0).toFixed(0)}ms
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Min</div>
                <div className="text-2xl font-bold text-emerald-500">
                  {(stats.overall?.min ?? 0).toFixed(0)}ms
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Max</div>
                <div className={`text-2xl font-bold ${getLatencyColor(stats.overall?.max ?? 0)}`}>
                  {(stats.overall?.max ?? 0).toFixed(0)}ms
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Latency Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="bucket" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    <Bar dataKey="count" fill="#22c55e" name="Requests" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Latency by Buyer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(stats.by_buyer ?? []).map((b) => (
                    <div key={b.buyer} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div>
                        <span className="font-medium">{b.buyer}</span>
                        <span className="text-xs text-muted-foreground ml-2">({b.samples ?? 0} samples)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`font-bold ${getLatencyColor(b.avg_ms ?? 0)}`}>{(b.avg_ms ?? 0).toFixed(0)}ms</div>
                          <div className="text-xs text-muted-foreground">avg</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${getLatencyColor(b.p95 ?? 0)}`}>{(b.p95 ?? 0).toFixed(0)}ms</div>
                          <div className="text-xs text-muted-foreground">p95</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Latency by State
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(stats.by_state ?? []).slice(0, 10).map((s) => (
                    <div key={s.state} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div>
                        <span className="font-bold">{s.state}</span>
                        <span className="text-xs text-muted-foreground ml-2">({s.samples ?? 0} samples)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`font-bold ${getLatencyColor(s.avg_ms ?? 0)}`}>{(s.avg_ms ?? 0).toFixed(0)}ms</div>
                        {getLatencyBadge(s.avg_ms ?? 0)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {(stats.slow_requests ?? []).length > 0 && (
            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-500">
                  <AlertTriangle className="h-5 w-5" />
                  Slow Requests (Last 24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Time</th>
                        <th className="pb-2 font-medium">Buyer</th>
                        <th className="pb-2 font-medium">State</th>
                        <th className="pb-2 font-medium text-right">Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats.slow_requests ?? []).map((r, i) => (
                        <tr key={i} className="border-b border-muted/50">
                          <td className="py-2 text-muted-foreground">
                            {r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : 'N/A'}
                          </td>
                          <td className="py-2">{r.buyer ?? 'N/A'}</td>
                          <td className="py-2">{r.state ?? 'N/A'}</td>
                          <td className={`py-2 text-right font-bold ${getLatencyColor(r.latency_ms ?? 0)}`}>
                            {(r.latency_ms ?? 0).toFixed(0)}ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}
