'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { Clock, DollarSign } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface TimeCell {
  hour: number
  day: number
  pings: number
  accepted: number
  accept_rate: number
  revenue: number
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function TimeHeatmapPage() {
  const [data, setData] = useState<TimeCell[]>([])
  const [loading, setLoading] = useState(true)
  const [metric, setMetric] = useState<'accept_rate' | 'pings' | 'revenue'>('accept_rate')
  const [selectedCell, setSelectedCell] = useState<TimeCell | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${QA_AGENT_URL}/analytics/time-heatmap?days=30`)
      if (res.ok) {
        const json = await res.json()
        setData(Array.isArray(json) ? json : [])
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

  const getCell = (hour: number, day: number) => {
    return data.find(d => d.hour === hour && d.day === day)
  }

  const getCellColor = (cell: TimeCell | undefined) => {
    if (!cell) return 'bg-muted/20'
    let value: number
    let max: number

    switch (metric) {
      case 'accept_rate':
        value = cell.accept_rate
        max = 100
        break
      case 'pings':
        value = cell.pings ?? 0
        max = data.length > 0 ? Math.max(...data.map(d => d.pings ?? 0)) : 1
        break
      case 'revenue':
        value = cell.revenue ?? 0
        max = data.length > 0 ? Math.max(...data.map(d => d.revenue ?? 0)) : 1
        break
    }

    const intensity = value / max
    if (intensity >= 0.8) return 'bg-emerald-500'
    if (intensity >= 0.6) return 'bg-lime-500'
    if (intensity >= 0.4) return 'bg-amber-500'
    if (intensity >= 0.2) return 'bg-orange-500'
    return 'bg-red-500/50'
  }

  const getCellOpacity = (cell: TimeCell | undefined) => {
    if (!cell || (cell.pings ?? 0) === 0) return 0.1
    const maxPings = data.length > 0 ? Math.max(...data.map(d => d.pings ?? 0)) : 1
    return 0.3 + ((cell.pings ?? 0) / maxPings) * 0.7
  }

  const formatHour = (h: number) => {
    if (h === 0) return '12am'
    if (h === 12) return '12pm'
    if (h < 12) return `${h}am`
    return `${h - 12}pm`
  }

  const bestHours = [...data]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const worstHours = [...data]
    .filter(d => d.pings > 0)
    .sort((a, b) => a.accept_rate - b.accept_rate)
    .slice(0, 5)

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Time Performance Heatmap
                </CardTitle>
                <div className="flex gap-2">
                  {(['accept_rate', 'pings', 'revenue'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetric(m)}
                      className={`px-3 py-1 text-sm rounded ${metric === m ? 'bg-lime-500 text-black' : 'bg-muted hover:bg-muted/80'}`}
                    >
                      {m === 'accept_rate' ? 'Accept %' : m === 'pings' ? 'Volume' : 'Revenue'}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <div className="flex">
                    <div className="w-12" />
                    {HOURS.map(h => (
                      <div key={h} className="flex-1 text-center text-xs text-muted-foreground pb-1">
                        {h % 3 === 0 ? formatHour(h) : ''}
                      </div>
                    ))}
                  </div>
                  {DAYS.map((day, dayIdx) => (
                    <div key={day} className="flex">
                      <div className="w-12 text-xs text-muted-foreground flex items-center">{day}</div>
                      {HOURS.map(hour => {
                        const cell = getCell(hour, dayIdx)
                        return (
                          <div
                            key={hour}
                            className={`flex-1 aspect-square m-0.5 rounded cursor-pointer transition-all hover:scale-110 ${getCellColor(cell)}`}
                            style={{ opacity: getCellOpacity(cell) }}
                            onClick={() => cell && setSelectedCell(cell)}
                            title={cell ? `${DAYS[dayIdx]} ${formatHour(hour)}: ${cell.pings ?? 0} pings, ${(cell.accept_rate ?? 0).toFixed(1)}%` : ''}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {selectedCell && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xl font-bold">
                      {DAYS[selectedCell.day]} at {formatHour(selectedCell.hour)}
                    </span>
                    <button onClick={() => setSelectedCell(null)} className="text-muted-foreground hover:text-foreground">×</button>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Pings</div>
                      <div className="font-bold">{(selectedCell.pings ?? 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Accepted</div>
                      <div className="font-bold text-emerald-500">{(selectedCell.accepted ?? 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Accept Rate</div>
                      <div className="font-bold">{(selectedCell.accept_rate ?? 0).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Revenue</div>
                      <div className="font-bold text-emerald-500">${(selectedCell.revenue ?? 0).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-500">
                  <DollarSign className="h-5 w-5" />
                  Best Performing Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bestHours.map((h, i) => (
                    <div key={`${h.day}-${h.hour}`} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                      <span>{DAYS[h.day]} {formatHour(h.hour)}</span>
                      <div className="text-right">
                        <span className="font-bold text-emerald-500">${(h.revenue ?? 0).toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground ml-2">{(h.accept_rate ?? 0).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-500">
                  <Clock className="h-5 w-5" />
                  Worst Performing Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {worstHours.map((h, i) => (
                    <div key={`${h.day}-${h.hour}`} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                      <span>{DAYS[h.day]} {formatHour(h.hour)}</span>
                      <div className="text-right">
                        <span className="font-bold text-amber-500">{(h.accept_rate ?? 0).toFixed(1)}%</span>
                        <span className="text-xs text-muted-foreground ml-2">{h.pings ?? 0} pings</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
