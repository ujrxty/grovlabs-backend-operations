'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { AlertTriangle, TrendingDown, TrendingUp, Activity, Clock } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface Anomaly {
  type: 'volume_spike' | 'volume_drop' | 'acceptance_drop' | 'latency_spike' | 'duplicate_surge' | 'bid_anomaly'
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  detected_at: string
  affected_entity?: string
  current_value: number
  expected_value: number
  deviation_percent: number
  recommended_action: string
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${QA_AGENT_URL}/analytics/anomalies?hours=24`)
      if (res.ok) {
        const json = await res.json()
        setAnomalies(Array.isArray(json) ? json : [])
        setLastChecked(new Date())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge className="bg-red-500 text-white">Critical</Badge>
      case 'warning': return <Badge className="bg-amber-500 text-black">Warning</Badge>
      case 'info': return <Badge className="bg-blue-500/20 text-blue-500">Info</Badge>
      default: return null
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'volume_spike': return <TrendingUp className="h-5 w-5 text-emerald-500" />
      case 'volume_drop': return <TrendingDown className="h-5 w-5 text-red-500" />
      case 'acceptance_drop': return <TrendingDown className="h-5 w-5 text-amber-500" />
      case 'latency_spike': return <Clock className="h-5 w-5 text-orange-500" />
      case 'duplicate_surge': return <Activity className="h-5 w-5 text-purple-500" />
      case 'bid_anomaly': return <Activity className="h-5 w-5 text-blue-500" />
      default: return <AlertTriangle className="h-5 w-5" />
    }
  }

  const critical = anomalies.filter(a => a.severity === 'critical')
  const warnings = anomalies.filter(a => a.severity === 'warning')
  const info = anomalies.filter(a => a.severity === 'info')

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${anomalies.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-sm text-muted-foreground">
              {anomalies.length > 0 ? `${anomalies.length} anomalies detected` : 'All systems normal'}
            </span>
          </div>
        </div>
        {lastChecked && (
          <div className="text-sm text-muted-foreground">
            Last checked: {lastChecked.toLocaleTimeString()}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className={critical.length > 0 ? 'border-red-500' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-500 mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Critical</span>
                </div>
                <div className="text-3xl font-bold">{critical.length}</div>
              </CardContent>
            </Card>
            <Card className={warnings.length > 0 ? 'border-amber-500' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-amber-500 mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Warnings</span>
                </div>
                <div className="text-3xl font-bold">{warnings.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-blue-500 mb-2">
                  <Activity className="h-5 w-5" />
                  <span>Info</span>
                </div>
                <div className="text-3xl font-bold">{info.length}</div>
              </CardContent>
            </Card>
          </div>

          {anomalies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-emerald-500 mb-4">
                  <Activity className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Anomalies Detected</h3>
                <p className="text-muted-foreground">
                  All metrics are within normal ranges for the past 24 hours.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {anomalies.map((anomaly, i) => (
                <Card
                  key={i}
                  className={
                    anomaly.severity === 'critical' ? 'border-red-500' :
                    anomaly.severity === 'warning' ? 'border-amber-500/50' : ''
                  }
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(anomaly.type)}
                        <div>
                          <h3 className="font-bold text-lg">{anomaly.title}</h3>
                          {anomaly.affected_entity && (
                            <span className="text-sm text-muted-foreground">{anomaly.affected_entity}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getSeverityBadge(anomaly.severity)}
                        <div className="text-sm text-muted-foreground">
                          {new Date(anomaly.detected_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-4">{anomaly.description}</p>

                    <div className="grid md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg mb-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Current</div>
                        <div className="font-bold">{(anomaly.current_value ?? 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Expected</div>
                        <div className="font-bold">{(anomaly.expected_value ?? 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Deviation</div>
                        <div className={`font-bold ${(anomaly.deviation_percent ?? 0) > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {(anomaly.deviation_percent ?? 0) > 0 ? '+' : ''}{(anomaly.deviation_percent ?? 0).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-lime-500/10 rounded-lg">
                      <Lightbulb className="h-5 w-5 text-lime-500 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-lime-500">Recommended Action</div>
                        <div className="text-sm">{anomaly.recommended_action}</div>
                      </div>
                    </div>
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

function Lightbulb(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  )
}
