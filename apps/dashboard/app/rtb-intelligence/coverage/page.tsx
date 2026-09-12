'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { useRTBFilters } from '@/components/rtb/rtb-filter-context'
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface StateCoverage {
  state: string
  pings: number
  accepted: number
  rejected: number
  accept_rate: number
  total_bid: number
  avg_bid: number
  coverage_score: number
}

const US_STATES: Record<string, { x: number; y: number }> = {
  WA: { x: 12, y: 8 }, OR: { x: 10, y: 18 }, CA: { x: 8, y: 35 }, NV: { x: 15, y: 30 },
  ID: { x: 20, y: 15 }, MT: { x: 28, y: 10 }, WY: { x: 30, y: 22 }, UT: { x: 22, y: 32 },
  AZ: { x: 20, y: 45 }, CO: { x: 32, y: 35 }, NM: { x: 28, y: 48 }, ND: { x: 42, y: 10 },
  SD: { x: 42, y: 18 }, NE: { x: 42, y: 28 }, KS: { x: 44, y: 38 }, OK: { x: 46, y: 46 },
  TX: { x: 44, y: 58 }, MN: { x: 52, y: 14 }, IA: { x: 52, y: 26 }, MO: { x: 54, y: 38 },
  AR: { x: 54, y: 48 }, LA: { x: 56, y: 58 }, WI: { x: 58, y: 18 }, IL: { x: 60, y: 32 },
  MS: { x: 60, y: 52 }, MI: { x: 68, y: 20 }, IN: { x: 66, y: 32 }, KY: { x: 68, y: 40 },
  TN: { x: 66, y: 46 }, AL: { x: 66, y: 54 }, OH: { x: 72, y: 32 }, WV: { x: 76, y: 38 },
  VA: { x: 80, y: 40 }, NC: { x: 82, y: 46 }, SC: { x: 80, y: 52 }, GA: { x: 74, y: 54 },
  FL: { x: 78, y: 65 }, PA: { x: 80, y: 28 }, NY: { x: 84, y: 22 }, NJ: { x: 88, y: 32 },
  CT: { x: 90, y: 26 }, RI: { x: 92, y: 24 }, MA: { x: 92, y: 20 }, VT: { x: 88, y: 14 },
  NH: { x: 90, y: 12 }, ME: { x: 94, y: 8 }, MD: { x: 84, y: 36 }, DE: { x: 88, y: 36 },
  DC: { x: 86, y: 38 }, AK: { x: 12, y: 65 }, HI: { x: 25, y: 70 },
}

export default function CoveragePage() {
  const { buildQueryString } = useRTBFilters()
  const [data, setData] = useState<StateCoverage[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const qs = buildQueryString()
    try {
      const res = await fetch(`${QA_AGENT_URL}/pings/stats/coverage?${qs}`)
      if (res.ok) setData(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [buildQueryString])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const stateMap = new Map(data.map(s => [s.state, s]))
  const maxPings = Math.max(...data.map(s => s.pings), 1)

  const getStateColor = (state: string) => {
    const s = stateMap.get(state)
    if (!s || s.pings === 0) return 'bg-muted/30 text-muted-foreground'
    const intensity = s.pings / maxPings
    if (s.accept_rate >= 30) {
      if (intensity > 0.5) return 'bg-emerald-500 text-white'
      return 'bg-emerald-500/60 text-white'
    }
    if (s.accept_rate >= 10) {
      if (intensity > 0.5) return 'bg-amber-500 text-white'
      return 'bg-amber-500/60 text-white'
    }
    if (intensity > 0.5) return 'bg-red-500 text-white'
    return 'bg-red-500/60 text-white'
  }

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">US State Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full h-[400px] bg-muted/20 rounded-lg overflow-hidden">
                {Object.entries(US_STATES).map(([state, pos]) => {
                  const stateData = stateMap.get(state)
                  return (
                    <div
                      key={state}
                      className={cn(
                        'absolute w-10 h-8 rounded flex items-center justify-center text-xs font-medium cursor-default transition-transform hover:scale-110',
                        getStateColor(state)
                      )}
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                      title={stateData
                        ? `${state}: ${stateData.pings} pings, ${stateData.accept_rate}% accept, $${stateData.avg_bid.toFixed(2)} avg`
                        : `${state}: No data`
                      }
                    >
                      {state}
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> High accept (&gt;30%)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" /> Medium (10-30%)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Low (&lt;10%)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted" /> No data</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Pings</TableHead>
                    <TableHead className="text-right">Accepted</TableHead>
                    <TableHead className="text-right">Rejected</TableHead>
                    <TableHead className="text-right">Accept Rate</TableHead>
                    <TableHead className="text-right">Total Bid</TableHead>
                    <TableHead className="text-right">Avg Bid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.state}>
                      <TableCell className="font-medium">{row.state}</TableCell>
                      <TableCell className="text-right">{row.pings.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-emerald-500">{row.accepted.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-500">{row.rejected.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn(row.accept_rate >= 30 ? 'text-emerald-500' : row.accept_rate < 10 ? 'text-red-500' : '')}>
                          {row.accept_rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">${row.total_bid.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">${row.avg_bid.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
