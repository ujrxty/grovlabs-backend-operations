'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { Users, Star, AlertTriangle, ThumbsUp, ThumbsDown, TrendingUp } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface PublisherQuality {
  source_name: string
  total_pings: number
  accepted: number
  accept_rate: number
  duplicate_rate: number
  avg_bid: number
  total_revenue: number
  quality_score: number
  fraud_signals: number
  recommendation: 'scale_up' | 'maintain' | 'investigate' | 'reduce' | 'pause'
  issues: string[]
}

export default function PublisherQualityPage() {
  const [publishers, setPublishers] = useState<PublisherQuality[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${QA_AGENT_URL}/analytics/publisher-quality?days=30`)
      if (res.ok) {
        const data = await res.json()
        setPublishers(Array.isArray(data) ? data : [])
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

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case 'scale_up':
        return <Badge className="bg-emerald-500/20 text-emerald-500"><TrendingUp className="h-3 w-3 mr-1" />Scale Up</Badge>
      case 'maintain':
        return <Badge className="bg-blue-500/20 text-blue-500">Maintain</Badge>
      case 'investigate':
        return <Badge className="bg-amber-500/20 text-amber-500"><AlertTriangle className="h-3 w-3 mr-1" />Investigate</Badge>
      case 'reduce':
        return <Badge className="bg-orange-500/20 text-orange-500"><ThumbsDown className="h-3 w-3 mr-1" />Reduce</Badge>
      case 'pause':
        return <Badge className="bg-red-500/20 text-red-500">Pause</Badge>
      default:
        return <Badge variant="outline">{rec}</Badge>
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500'
    if (score >= 60) return 'text-lime-500'
    if (score >= 40) return 'text-amber-500'
    return 'text-red-500'
  }

  const scaleUp = publishers.filter(p => p.recommendation === 'scale_up')
  const investigate = publishers.filter(p => p.recommendation === 'investigate' || p.recommendation === 'reduce' || p.recommendation === 'pause')
  const maintain = publishers.filter(p => p.recommendation === 'maintain')

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                  <ThumbsUp className="h-5 w-5" />
                  <span className="font-bold">Scale Up</span>
                </div>
                <div className="text-3xl font-bold">{scaleUp.length}</div>
                <div className="text-sm text-muted-foreground">High quality publishers ready for more volume</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-blue-500 mb-2">
                  <Star className="h-5 w-5" />
                  <span className="font-bold">Maintain</span>
                </div>
                <div className="text-3xl font-bold">{maintain.length}</div>
                <div className="text-sm text-muted-foreground">Stable publishers performing well</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-amber-500 mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-bold">Needs Attention</span>
                </div>
                <div className="text-3xl font-bold">{investigate.length}</div>
                <div className="text-sm text-muted-foreground">Publishers requiring investigation</div>
              </CardContent>
            </Card>
          </div>

          {investigate.length > 0 && (
            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-500">
                  <AlertTriangle className="h-5 w-5" />
                  Publishers Needing Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {investigate.map((p) => (
                    <div key={p.source_name} className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-bold">{p.source_name}</span>
                          <span className={`ml-2 font-bold ${getScoreColor(p.quality_score ?? 0)}`}>
                            Score: {(p.quality_score ?? 0).toFixed(0)}
                          </span>
                        </div>
                        {getRecommendationBadge(p.recommendation)}
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground mb-2">
                        <span>{p.total_pings ?? 0} pings</span>
                        <span>{(p.accept_rate ?? 0).toFixed(1)}% accept</span>
                        <span className="text-orange-500">{(p.duplicate_rate ?? 0).toFixed(1)}% dupes</span>
                        {(p.fraud_signals ?? 0) > 0 && (
                          <span className="text-red-500">{p.fraud_signals} fraud signals</span>
                        )}
                      </div>
                      {(p.issues ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(p.issues ?? []).map((issue, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{issue}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Publishers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Publisher</th>
                      <th className="pb-2 font-medium text-right">Quality</th>
                      <th className="pb-2 font-medium text-right">Pings</th>
                      <th className="pb-2 font-medium text-right">Accept %</th>
                      <th className="pb-2 font-medium text-right">Dupe %</th>
                      <th className="pb-2 font-medium text-right">Avg Bid</th>
                      <th className="pb-2 font-medium text-right">Revenue</th>
                      <th className="pb-2 font-medium text-right">Fraud</th>
                      <th className="pb-2 font-medium">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publishers.map((p) => (
                      <tr key={p.source_name} className="border-b border-muted/50 hover:bg-muted/30">
                        <td className="py-2 font-medium">{p.source_name}</td>
                        <td className={`py-2 text-right font-bold ${getScoreColor(p.quality_score ?? 0)}`}>
                          {(p.quality_score ?? 0).toFixed(0)}
                        </td>
                        <td className="py-2 text-right">{(p.total_pings ?? 0).toLocaleString()}</td>
                        <td className="py-2 text-right">{(p.accept_rate ?? 0).toFixed(1)}%</td>
                        <td className={`py-2 text-right ${(p.duplicate_rate ?? 0) > 10 ? 'text-orange-500' : ''}`}>
                          {(p.duplicate_rate ?? 0).toFixed(1)}%
                        </td>
                        <td className="py-2 text-right">${(p.avg_bid ?? 0).toFixed(2)}</td>
                        <td className="py-2 text-right text-emerald-500">${(p.total_revenue ?? 0).toLocaleString()}</td>
                        <td className={`py-2 text-right ${(p.fraud_signals ?? 0) > 0 ? 'text-red-500 font-bold' : ''}`}>
                          {p.fraud_signals ?? 0}
                        </td>
                        <td className="py-2">{getRecommendationBadge(p.recommendation)}</td>
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
