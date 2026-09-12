'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { Lightbulb, DollarSign, TrendingUp, Target, AlertCircle } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface Opportunity {
  type: 'scale_volume' | 'add_buyer' | 'time_optimization' | 'geo_expansion' | 'reduce_duplicates' | 'improve_quality'
  title: string
  description: string
  estimated_monthly_value: number
  confidence: 'high' | 'medium' | 'low'
  action_items: string[]
  affected_entity?: string
  current_value?: number
  potential_value?: number
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${QA_AGENT_URL}/analytics/revenue-opportunities?days=30`)
      if (res.ok) {
        const data = await res.json()
        setOpportunities(Array.isArray(data) ? data : [])
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'scale_volume': return <TrendingUp className="h-5 w-5 text-emerald-500" />
      case 'add_buyer': return <Target className="h-5 w-5 text-blue-500" />
      case 'time_optimization': return <Lightbulb className="h-5 w-5 text-amber-500" />
      case 'geo_expansion': return <Target className="h-5 w-5 text-purple-500" />
      case 'reduce_duplicates': return <AlertCircle className="h-5 w-5 text-orange-500" />
      case 'improve_quality': return <TrendingUp className="h-5 w-5 text-lime-500" />
      default: return <Lightbulb className="h-5 w-5" />
    }
  }

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high': return <Badge className="bg-emerald-500/20 text-emerald-500">High Confidence</Badge>
      case 'medium': return <Badge className="bg-amber-500/20 text-amber-500">Medium Confidence</Badge>
      case 'low': return <Badge className="bg-muted text-muted-foreground">Low Confidence</Badge>
      default: return null
    }
  }

  const totalPotentialValue = (opportunities ?? []).reduce((sum, o) => sum + (o.estimated_monthly_value ?? 0), 0)
  const highConfidenceValue = (opportunities ?? [])
    .filter(o => o.confidence === 'high')
    .reduce((sum, o) => sum + (o.estimated_monthly_value ?? 0), 0)

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
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Lightbulb className="h-5 w-5" />
                  <span>Opportunities Found</span>
                </div>
                <div className="text-3xl font-bold">{(opportunities ?? []).length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                  <DollarSign className="h-5 w-5" />
                  <span>Total Potential Value</span>
                </div>
                <div className="text-3xl font-bold text-emerald-500">
                  ${totalPotentialValue.toLocaleString()}/mo
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-lime-500 mb-2">
                  <Target className="h-5 w-5" />
                  <span>High Confidence Value</span>
                </div>
                <div className="text-3xl font-bold text-lime-500">
                  ${highConfidenceValue.toLocaleString()}/mo
                </div>
              </CardContent>
            </Card>
          </div>

          {(opportunities ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-bold mb-2">No Opportunities Found</h3>
                <p className="text-muted-foreground">Check back when you have more ping data.</p>
              </CardContent>
            </Card>
          ) : (
          <div className="space-y-4">
            {(opportunities ?? []).map((opp, i) => (
              <Card key={i} className="hover:border-lime-500/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getTypeIcon(opp.type)}
                      <div>
                        <h3 className="font-bold text-lg">{opp.title}</h3>
                        {opp.affected_entity && (
                          <span className="text-sm text-muted-foreground">{opp.affected_entity}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getConfidenceBadge(opp.confidence)}
                      <div className="text-right">
                        <div className="text-xl font-bold text-emerald-500">
                          +${(opp.estimated_monthly_value ?? 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">per month</div>
                      </div>
                    </div>
                  </div>

                  <p className="text-muted-foreground mb-4">{opp.description}</p>

                  {opp.current_value != null && opp.potential_value != null && (
                    <div className="flex items-center gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
                      <div>
                        <div className="text-xs text-muted-foreground">Current</div>
                        <div className="font-bold">${(opp.current_value ?? 0).toLocaleString()}</div>
                      </div>
                      <div className="text-2xl text-muted-foreground">→</div>
                      <div>
                        <div className="text-xs text-muted-foreground">Potential</div>
                        <div className="font-bold text-emerald-500">${(opp.potential_value ?? 0).toLocaleString()}</div>
                      </div>
                    </div>
                  )}

                  {(opp.action_items ?? []).length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Action Items:</div>
                      <ul className="space-y-1">
                        {(opp.action_items ?? []).map((action, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <span className="text-lime-500 mt-1">•</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          )}
        </>
      )}
    </div>
  )
}
