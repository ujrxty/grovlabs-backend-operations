'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { useRTBFilters } from '@/components/rtb/rtb-filter-context'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface TrendPoint {
  timestamp: string
  pings: number
  accepted: number
  rejected: number
  accept_rate: number
  total_bid: number
  avg_bid: number
  duplicates: number
}

interface HourlyData {
  hour: number
  day_of_week: number
  pings: number
  accepted: number
  accept_rate: number
  avg_bid: number
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function TrendsPage() {
  const { buildQueryString } = useRTBFilters()
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [hourly, setHourly] = useState<HourlyData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const qs = buildQueryString()
    try {
      const [trendsRes, hourlyRes] = await Promise.all([
        fetch(`${QA_AGENT_URL}/pings/stats/trends?${qs}&granularity=hour`),
        fetch(`${QA_AGENT_URL}/pings/stats/hourly?${qs}`),
      ])
      if (trendsRes.ok) setTrends(await trendsRes.json())
      if (hourlyRes.ok) setHourly(await hourlyRes.json())
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
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`
  }

  const getHeatmapColor = (value: number, max: number) => {
    if (value === 0) return 'bg-muted/30'
    const intensity = value / max
    if (intensity > 0.75) return 'bg-lime-500'
    if (intensity > 0.5) return 'bg-lime-500/70'
    if (intensity > 0.25) return 'bg-lime-500/40'
    return 'bg-lime-500/20'
  }

  const maxPings = Math.max(...hourly.map(h => h.pings), 1)

  const heatmapData = DAYS.map((day, dow) => ({
    day,
    hours: Array.from({ length: 24 }, (_, hour) => {
      const data = hourly.find(h => h.day_of_week === dow && h.hour === hour)
      return { hour, pings: data?.pings || 0, accept_rate: data?.accept_rate || 0 }
    })
  }))

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ping Volume Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="timestamp" tickFormatter={formatDate} stroke="#888" fontSize={11} interval="preserveStartEnd" />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                      labelFormatter={(v) => formatDate(v as string)}
                    />
                    <Area type="monotone" dataKey="pings" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Total Pings" />
                    <Area type="monotone" dataKey="accepted" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="Accepted" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accept Rate & Bid Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="timestamp" tickFormatter={formatDate} stroke="#888" fontSize={11} interval="preserveStartEnd" />
                    <YAxis yAxisId="left" stroke="#888" fontSize={12} domain={[0, 100]} />
                    <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                      labelFormatter={(v) => formatDate(v as string)}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="accept_rate" stroke="#22c55e" strokeWidth={2} name="Accept %" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="avg_bid" stroke="#f59e0b" strokeWidth={2} name="Avg Bid $" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hour of Day / Day of Week Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <div className="flex">
                    <div className="w-12" />
                    {Array.from({ length: 24 }, (_, i) => (
                      <div key={i} className="w-8 text-center text-xs text-muted-foreground">
                        {i}
                      </div>
                    ))}
                  </div>
                  {heatmapData.map((row) => (
                    <div key={row.day} className="flex items-center">
                      <div className="w-12 text-xs text-muted-foreground">{row.day}</div>
                      {row.hours.map((cell) => (
                        <div
                          key={cell.hour}
                          className={cn(
                            'w-8 h-6 m-0.5 rounded text-[10px] flex items-center justify-center',
                            getHeatmapColor(cell.pings, maxPings)
                          )}
                          title={`${row.day} ${cell.hour}:00 - ${cell.pings} pings, ${cell.accept_rate}% accept`}
                        >
                          {cell.pings > 0 ? cell.pings : ''}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Hover over cells to see details. Color intensity = ping volume.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
