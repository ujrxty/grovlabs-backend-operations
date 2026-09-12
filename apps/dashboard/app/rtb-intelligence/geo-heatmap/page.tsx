'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { Map, DollarSign, TrendingUp } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface GeoData {
  state: string
  total_pings: number
  accepted: number
  accept_rate: number
  total_revenue: number
  avg_bid: number
  top_buyer: string
}

const US_STATES: Record<string, { x: number; y: number }> = {
  WA: { x: 12, y: 8 }, OR: { x: 12, y: 18 }, CA: { x: 8, y: 35 }, NV: { x: 16, y: 30 },
  ID: { x: 22, y: 15 }, MT: { x: 32, y: 8 }, WY: { x: 32, y: 22 }, UT: { x: 24, y: 32 },
  AZ: { x: 22, y: 45 }, CO: { x: 35, y: 35 }, NM: { x: 32, y: 48 }, TX: { x: 45, y: 55 },
  OK: { x: 48, y: 42 }, KS: { x: 48, y: 32 }, NE: { x: 48, y: 22 }, SD: { x: 48, y: 12 },
  ND: { x: 48, y: 5 }, MN: { x: 58, y: 10 }, IA: { x: 58, y: 22 }, MO: { x: 58, y: 35 },
  AR: { x: 56, y: 45 }, LA: { x: 56, y: 58 }, MS: { x: 62, y: 52 }, AL: { x: 68, y: 48 },
  TN: { x: 70, y: 38 }, KY: { x: 72, y: 32 }, IL: { x: 64, y: 28 }, WI: { x: 64, y: 15 },
  MI: { x: 72, y: 15 }, IN: { x: 72, y: 28 }, OH: { x: 78, y: 28 }, WV: { x: 80, y: 32 },
  VA: { x: 84, y: 35 }, NC: { x: 85, y: 40 }, SC: { x: 82, y: 45 }, GA: { x: 78, y: 48 },
  FL: { x: 82, y: 60 }, PA: { x: 84, y: 22 }, NY: { x: 88, y: 15 }, NJ: { x: 90, y: 25 },
  DE: { x: 90, y: 30 }, MD: { x: 88, y: 32 }, CT: { x: 94, y: 18 }, RI: { x: 96, y: 18 },
  MA: { x: 96, y: 14 }, VT: { x: 92, y: 8 }, NH: { x: 94, y: 8 }, ME: { x: 98, y: 5 },
  AK: { x: 12, y: 65 }, HI: { x: 28, y: 68 },
}

export default function GeoHeatmapPage() {
  const [geoData, setGeoData] = useState<GeoData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedState, setSelectedState] = useState<GeoData | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${QA_AGENT_URL}/analytics/geo-heatmap?days=30`)
      if (res.ok) {
        const data = await res.json()
        setGeoData(Array.isArray(data) ? data : [])
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

  const getStateColor = (state: string) => {
    const data = geoData.find(g => g.state === state)
    if (!data) return 'fill-muted/30'
    const rate = data.accept_rate
    if (rate >= 60) return 'fill-emerald-500'
    if (rate >= 40) return 'fill-lime-500'
    if (rate >= 20) return 'fill-amber-500'
    return 'fill-red-500'
  }

  const getStateOpacity = (state: string) => {
    const data = geoData.find(g => g.state === state)
    if (!data) return 0.2
    const maxPings = geoData.length > 0 ? Math.max(...geoData.map(g => g.total_pings ?? 0)) : 1
    return 0.3 + ((data.total_pings ?? 0) / maxPings) * 0.7
  }

  const topStates = [...geoData].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 10)

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Geographic Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full aspect-[1.6/1] bg-muted/20 rounded-lg p-4">
                <svg viewBox="0 0 110 75" className="w-full h-full">
                  {Object.entries(US_STATES).map(([state, pos]) => {
                    const data = geoData.find(g => g.state === state)
                    return (
                      <g key={state}>
                        <rect
                          x={pos.x - 4}
                          y={pos.y - 3}
                          width={8}
                          height={6}
                          rx={1}
                          className={`${getStateColor(state)} cursor-pointer transition-all hover:scale-110`}
                          style={{ opacity: getStateOpacity(state) }}
                          onClick={() => data && setSelectedState(data)}
                        />
                        <text
                          x={pos.x}
                          y={pos.y + 1.5}
                          textAnchor="middle"
                          className="fill-foreground text-[2.5px] font-medium pointer-events-none"
                        >
                          {state}
                        </text>
                      </g>
                    )
                  })}
                </svg>
                <div className="absolute bottom-4 left-4 flex gap-2 text-xs">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500" /> 60%+</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-lime-500" /> 40-60%</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-500" /> 20-40%</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500" /> &lt;20%</div>
                </div>
              </div>

              {selectedState && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xl font-bold">{selectedState.state}</span>
                    <button onClick={() => setSelectedState(null)} className="text-muted-foreground hover:text-foreground">×</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Pings</div>
                      <div className="font-bold">{(selectedState.total_pings ?? 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Accept Rate</div>
                      <div className="font-bold text-emerald-500">{(selectedState.accept_rate ?? 0).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Revenue</div>
                      <div className="font-bold text-emerald-500">${(selectedState.total_revenue ?? 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Top Buyer</div>
                      <div className="font-bold">{selectedState.top_buyer ?? 'N/A'}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                Top States by Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topStates.map((s, i) => (
                  <div
                    key={s.state}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedState(s)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground w-5">{i + 1}.</span>
                      <span className="font-bold">{s.state}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-500">${(s.total_revenue ?? 0).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{(s.accept_rate ?? 0).toFixed(1)}% accept</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
