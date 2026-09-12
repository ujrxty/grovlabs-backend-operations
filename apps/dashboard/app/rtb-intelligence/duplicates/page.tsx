'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { useRTBFilters } from '@/components/rtb/rtb-filter-context'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Copy } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface DuplicateStats {
  total_pings: number
  duplicates: number
  duplicate_rate: number
  by_traffic_source: { name: string; pings: number; duplicates: number; dup_rate: number }[]
  by_offer: { name: string; pings: number; duplicates: number; dup_rate: number }[]
}

export default function DuplicatesPage() {
  const { buildQueryString } = useRTBFilters()
  const [data, setData] = useState<DuplicateStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const qs = buildQueryString()
    try {
      const res = await fetch(`${QA_AGENT_URL}/pings/duplicates?${qs}`)
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

  const pieData = data ? [
    { name: 'Unique', value: data.total_pings - data.duplicates, color: '#22c55e' },
    { name: 'Duplicate', value: data.duplicates, color: '#f97316' },
  ] : []

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : data ? (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-orange-500">{data.duplicate_rate}%</div>
                <div className="text-sm text-muted-foreground">Duplicate Rate</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.duplicates.toLocaleString()} of {data.total_pings.toLocaleString()} pings
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold">{data.total_pings.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Pings</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="h-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={40}
                        dataKey="value"
                      >
                        {pieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Duplicates by Traffic Source</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Pings</TableHead>
                      <TableHead className="text-right">Duplicates</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_traffic_source.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium max-w-[200px] truncate">{row.name}</TableCell>
                        <TableCell className="text-right">{row.pings.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-orange-500">{row.duplicates.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.dup_rate}%</TableCell>
                      </TableRow>
                    ))}
                    {data.by_traffic_source.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No duplicates detected
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Duplicates by Offer</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Offer</TableHead>
                      <TableHead className="text-right">Pings</TableHead>
                      <TableHead className="text-right">Duplicates</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_offer.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium max-w-[200px] truncate">{row.name}</TableCell>
                        <TableCell className="text-right">{row.pings.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-orange-500">{row.duplicates.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.dup_rate}%</TableCell>
                      </TableRow>
                    ))}
                    {data.by_offer.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No duplicates detected
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="text-muted-foreground">No data available</div>
      )}
    </div>
  )
}
