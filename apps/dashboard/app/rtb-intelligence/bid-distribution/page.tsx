'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { useRTBFilters } from '@/components/rtb/rtb-filter-context'
import { TrendingUp, DollarSign } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface BidDistribution {
  buyer: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
  avg: number
  count: number
}

export default function BidDistributionPage() {
  const { buildQueryString } = useRTBFilters()
  const [data, setData] = useState<BidDistribution[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredBuyer, setHoveredBuyer] = useState<BidDistribution | null>(null)

  const fetchData = useCallback(async () => {
    const qs = buildQueryString()
    try {
      const res = await fetch(`${QA_AGENT_URL}/analytics/bid-distribution?${qs}`)
      if (res.ok) {
        const json = await res.json()
        setData(Array.isArray(json) ? json : [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [buildQueryString])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const maxBid = data.length > 0 ? Math.max(...data.map(d => d.max ?? 0), 1) : 1
  const scale = (value: number) => (value / maxBid) * 100

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Bid Distribution by Buyer
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            box = Q1-Q3 • line = median • whisker = min-max
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-6">
              <div className="relative">
                <div className="flex justify-between text-xs text-muted-foreground mb-2 px-32">
                  <span>$0</span>
                  <span>${(maxBid / 4).toFixed(0)}</span>
                  <span>${(maxBid / 2).toFixed(0)}</span>
                  <span>${((maxBid * 3) / 4).toFixed(0)}</span>
                  <span>${maxBid.toFixed(0)}</span>
                </div>
                <div className="absolute left-32 right-0 top-8 bottom-0 flex flex-col justify-evenly pointer-events-none">
                  {[0, 25, 50, 75, 100].map(p => (
                    <div key={p} className="border-l border-dashed border-muted/30 h-full" style={{ marginLeft: `${p}%` }} />
                  ))}
                </div>

                {data.map((d, i) => (
                  <div
                    key={d.buyer}
                    className="flex items-center gap-4 py-3 hover:bg-muted/20 rounded px-2 cursor-pointer group"
                    onMouseEnter={() => setHoveredBuyer(d)}
                    onMouseLeave={() => setHoveredBuyer(null)}
                  >
                    <div className="w-28 text-sm font-medium truncate">{d.buyer}</div>
                    <div className="flex-1 relative h-8">
                      {/* Whisker line (min to max) */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-muted-foreground/50"
                        style={{
                          left: `${scale(d.min)}%`,
                          width: `${scale(d.max - d.min)}%`,
                        }}
                      />
                      {/* Min whisker cap */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-muted-foreground/50"
                        style={{ left: `${scale(d.min)}%` }}
                      />
                      {/* Max whisker cap */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-muted-foreground/50"
                        style={{ left: `${scale(d.max)}%` }}
                      />
                      {/* Box (Q1 to Q3) */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-6 bg-emerald-500/30 border border-emerald-500 rounded"
                        style={{
                          left: `${scale(d.q1)}%`,
                          width: `${scale(d.q3 - d.q1)}%`,
                        }}
                      />
                      {/* Median line */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-6 bg-amber-500"
                        style={{ left: `${scale(d.median)}%` }}
                      />
                    </div>
                    <div className="w-20 text-right text-sm">
                      <span className="text-muted-foreground">${(d.min ?? 0).toFixed(0)}</span>
                      <span className="mx-1">-</span>
                      <span className="font-bold text-emerald-500">${(d.max ?? 0).toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {hoveredBuyer && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-lg">{hoveredBuyer.buyer}</span>
                    <span className="text-sm text-muted-foreground">{hoveredBuyer.count} bids</span>
                  </div>
                  <div className="grid grid-cols-6 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Min</div>
                      <div className="font-bold">${(hoveredBuyer.min ?? 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Q1</div>
                      <div className="font-bold">${(hoveredBuyer.q1 ?? 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Median</div>
                      <div className="font-bold text-amber-500">${(hoveredBuyer.median ?? 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Q3</div>
                      <div className="font-bold">${(hoveredBuyer.q3 ?? 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Max</div>
                      <div className="font-bold">${(hoveredBuyer.max ?? 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Average</div>
                      <div className="font-bold text-emerald-500">${(hoveredBuyer.avg ?? 0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6 text-xs text-muted-foreground pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-4 bg-emerald-500/30 border border-emerald-500 rounded" />
                  <span>Q1-Q3 (middle 50%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-0.5 h-4 bg-amber-500" />
                  <span>Median</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-muted-foreground/50" />
                  <span>Min-Max range</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
