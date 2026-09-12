'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { useRTBFilters } from '@/components/rtb/rtb-filter-context'
import { Award, TrendingUp, DollarSign, Clock, Star, ArrowUp, ArrowDown, Minus } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface BuyerPerformance {
  buyer_name: string
  total_pings: number
  accepted: number
  rejected: number
  accept_rate: number
  total_revenue: number
  avg_bid: number
  max_bid: number
  min_bid: number
  avg_response_time_ms: number
  consistency_score: number
  reliability_score: number
  rank: number
  trend: 'up' | 'down' | 'stable'
}

export default function BuyerLeaderboardPage() {
  const { buildQueryString } = useRTBFilters()
  const [buyers, setBuyers] = useState<BuyerPerformance[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${QA_AGENT_URL}/analytics/buyer-leaderboard?days=30`)
      if (res.ok) {
        const data = await res.json()
        setBuyers(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <ArrowUp className="h-4 w-4 text-emerald-500" />
    if (trend === 'down') return <ArrowDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  const getReliabilityColor = (score: number) => {
    if (score >= 90) return 'bg-emerald-500/20 text-emerald-500'
    if (score >= 70) return 'bg-lime-500/20 text-lime-500'
    if (score >= 50) return 'bg-amber-500/20 text-amber-500'
    return 'bg-red-500/20 text-red-500'
  }

  const topBuyers = buyers.slice(0, 3)
  const restBuyers = buyers.slice(3)

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            {topBuyers.map((b, i) => (
              <Card key={b.buyer_name} className={i === 0 ? 'ring-2 ring-amber-500' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        {i === 0 && <Award className="h-6 w-6 text-amber-500" />}
                        {i === 1 && <Award className="h-5 w-5 text-slate-400" />}
                        {i === 2 && <Award className="h-5 w-5 text-orange-700" />}
                        <span className="font-bold text-lg">{b.buyer_name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Rank #{b.rank} {getTrendIcon(b.trend)}
                      </div>
                    </div>
                    <Badge className={getReliabilityColor(b.reliability_score ?? 0)}>
                      {(b.reliability_score ?? 0).toFixed(0)}% reliable
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Accept Rate</div>
                      <div className="text-xl font-bold text-emerald-500">{(b.accept_rate ?? 0).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Avg Bid</div>
                      <div className="text-xl font-bold">${(b.avg_bid ?? 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total Revenue</div>
                      <div className="text-lg font-bold text-emerald-500">${(b.total_revenue ?? 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Response Time</div>
                      <div className="text-lg font-bold">{(b.avg_response_time_ms ?? 0).toFixed(0)}ms</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t flex justify-between text-sm">
                    <span>{(b.total_pings ?? 0).toLocaleString()} pings</span>
                    <span className="text-emerald-500">{(b.accepted ?? 0).toLocaleString()} accepted</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Buyers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Rank</th>
                      <th className="pb-2 font-medium">Buyer</th>
                      <th className="pb-2 font-medium text-right">Accept %</th>
                      <th className="pb-2 font-medium text-right">Avg Bid</th>
                      <th className="pb-2 font-medium text-right">Revenue</th>
                      <th className="pb-2 font-medium text-right">Response</th>
                      <th className="pb-2 font-medium text-right">Reliability</th>
                      <th className="pb-2 font-medium text-right">Consistency</th>
                      <th className="pb-2 font-medium text-center">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(buyers ?? []).map((b) => (
                      <tr key={b.buyer_name} className="border-b border-muted/50 hover:bg-muted/30">
                        <td className="py-2 font-bold">#{b.rank ?? 0}</td>
                        <td className="py-2">{b.buyer_name ?? 'Unknown'}</td>
                        <td className="py-2 text-right text-emerald-500 font-bold">{(b.accept_rate ?? 0).toFixed(1)}%</td>
                        <td className="py-2 text-right">${(b.avg_bid ?? 0).toFixed(2)}</td>
                        <td className="py-2 text-right text-emerald-500">${(b.total_revenue ?? 0).toLocaleString()}</td>
                        <td className="py-2 text-right">{(b.avg_response_time_ms ?? 0).toFixed(0)}ms</td>
                        <td className="py-2 text-right">
                          <Badge className={getReliabilityColor(b.reliability_score ?? 0)} variant="outline">
                            {(b.reliability_score ?? 0).toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="py-2 text-right">{(b.consistency_score ?? 0).toFixed(0)}%</td>
                        <td className="py-2 text-center">{getTrendIcon(b.trend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
