'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { useRTBFilters } from '@/components/rtb/rtb-filter-context'
import { AlertTriangle, Shield, Users, Phone, MapPin, Clock } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface DuplicateCaller {
  caller_phone: string
  occurrence_count: number
  first_seen: string
  last_seen: string
  time_between_calls_minutes: number
  states_seen: string[]
  offers_hit: string[]
  publishers_from: string[]
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  risk_reasons: string[]
}

interface FraudStats {
  total_pings: number
  unique_callers: number
  duplicate_callers: number
  duplicate_rate: number
  high_risk_count: number
  by_publisher: { publisher: string; duplicate_rate: number; total: number; duplicates: number }[]
  by_offer: { offer: string; duplicate_rate: number; total: number; duplicates: number }[]
  recent_duplicates: DuplicateCaller[]
  area_code_analysis: { area_code: string; count: number; duplicate_rate: number }[]
}

export default function FraudDetectionPage() {
  const { buildQueryString } = useRTBFilters()
  const [stats, setStats] = useState<FraudStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${QA_AGENT_URL}/analytics/fraud-stats?days=30`)
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

  const getRiskBadge = (level: string | undefined) => {
    switch (level) {
      case 'critical': return <Badge className="bg-red-500 text-white">Critical</Badge>
      case 'high': return <Badge className="bg-orange-500 text-white">High</Badge>
      case 'medium': return <Badge className="bg-amber-500 text-black">Medium</Badge>
      case 'low': return <Badge className="bg-blue-500/20 text-blue-500">Low</Badge>
      default: return null
    }
  }

  const formatPhone = (phone: string) => {
    if (!phone) return 'N/A'
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
    if (digits.length === 11) return `+${digits[0]} (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`
    return phone
  }

  const formatTime = (d: string) => d ? new Date(d).toLocaleString() : 'N/A'

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span className="text-xs">Total Pings</span>
                </div>
                <div className="text-2xl font-bold mt-1">{(stats.total_pings ?? 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Unique Callers</span>
                </div>
                <div className="text-2xl font-bold mt-1">{(stats.unique_callers ?? 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className={(stats.duplicate_rate ?? 0) > 5 ? 'border-amber-500' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-amber-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs">Duplicates</span>
                </div>
                <div className="text-2xl font-bold text-amber-500 mt-1">{stats.duplicate_callers ?? 0}</div>
                <div className="text-xs text-muted-foreground">{stats.duplicate_rate ?? 0}% rate</div>
              </CardContent>
            </Card>
            <Card className={(stats.high_risk_count ?? 0) > 0 ? 'border-red-500' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-500">
                  <Shield className="h-4 w-4" />
                  <span className="text-xs">High Risk</span>
                </div>
                <div className="text-2xl font-bold text-red-500 mt-1">{stats.high_risk_count ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-emerald-500">
                  <Shield className="h-4 w-4" />
                  <span className="text-xs">Clean Rate</span>
                </div>
                <div className="text-2xl font-bold text-emerald-500 mt-1">
                  {(100 - (stats.duplicate_rate ?? 0)).toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Duplicates by Publisher</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(stats.by_publisher ?? []).map((p) => (
                    <div key={p.publisher} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <span className="truncate max-w-[200px]">{p.publisher}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{p.duplicates}/{p.total}</span>
                        <span className={`font-bold ${p.duplicate_rate > 10 ? 'text-red-500' : p.duplicate_rate > 5 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {p.duplicate_rate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Duplicates by Offer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(stats.by_offer ?? []).map((o) => (
                    <div key={o.offer} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <span className="truncate max-w-[200px]">{o.offer}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{o.duplicates}/{o.total}</span>
                        <span className={`font-bold ${o.duplicate_rate > 10 ? 'text-red-500' : o.duplicate_rate > 5 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {o.duplicate_rate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Duplicate Callers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(stats.recent_duplicates ?? []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                  <p>No duplicate callers detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(stats.recent_duplicates ?? []).map((caller, i) => (
                    <div
                      key={caller.caller_phone}
                      className={`p-4 rounded-lg border ${
                        caller.risk_level === 'critical' ? 'border-red-500 bg-red-500/5' :
                        caller.risk_level === 'high' ? 'border-orange-500 bg-orange-500/5' :
                        caller.risk_level === 'medium' ? 'border-amber-500/50 bg-amber-500/5' :
                        'border-muted bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                          <span className="font-mono font-bold">{formatPhone(caller.caller_phone)}</span>
                          {getRiskBadge(caller.risk_level)}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">{caller.occurrence_count ?? 0}x</div>
                          <div className="text-xs text-muted-foreground">occurrences</div>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <div className="text-muted-foreground text-xs">First Seen</div>
                          <div>{formatTime(caller.first_seen)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Last Seen</div>
                          <div>{formatTime(caller.last_seen)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Time Between
                          </div>
                          <div className={(caller.time_between_calls_minutes ?? 0) < 60 ? 'text-red-500 font-bold' : ''}>
                            {(caller.time_between_calls_minutes ?? 0) < 60
                              ? `${caller.time_between_calls_minutes ?? 0} min`
                              : `${Math.round((caller.time_between_calls_minutes ?? 0) / 60)} hrs`
                            }
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> States
                          </div>
                          <div>{(caller.states_seen ?? []).join(', ') || 'N/A'}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-2">
                        {(caller.risk_reasons ?? []).map((reason, j) => (
                          <Badge key={j} variant="outline" className="text-xs">{reason}</Badge>
                        ))}
                      </div>

                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Offers: {(caller.offers_hit ?? []).join(', ') || 'N/A'}</span>
                        <span>Publishers: {(caller.publishers_from ?? []).join(', ') || 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {(stats.area_code_analysis ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Area Code Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 md:grid-cols-10 gap-2">
                  {(stats.area_code_analysis ?? []).map((ac) => (
                    <div
                      key={ac.area_code}
                      className={`p-2 rounded text-center ${
                        ac.duplicate_rate > 20 ? 'bg-red-500/20' :
                        ac.duplicate_rate > 10 ? 'bg-amber-500/20' :
                        'bg-muted/30'
                      }`}
                    >
                      <div className="font-mono font-bold">{ac.area_code}</div>
                      <div className="text-xs text-muted-foreground">{ac.count} calls</div>
                      <div className={`text-xs font-bold ${ac.duplicate_rate > 10 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {ac.duplicate_rate}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}
