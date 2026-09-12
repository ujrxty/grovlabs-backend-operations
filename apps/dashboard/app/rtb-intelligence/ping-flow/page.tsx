'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RTBFilterBar } from '@/components/rtb/rtb-filter-bar'
import { useRTBFilters } from '@/components/rtb/rtb-filter-context'
import { Target, Users, Package, DollarSign } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface FlowNode {
  id: string
  type: 'publisher' | 'campaign' | 'buyer'
  name: string
  pings: number
  matched: number
  efficiency?: number
  bid_rate?: number
  avg_bid?: number
}

interface FlowEdge {
  source: string
  target: string
  pings: number
}

interface FlowData {
  nodes: FlowNode[]
  edges: FlowEdge[]
  stats: {
    total_pings: number
    total_bids: number
    bid_rate: number
    avg_bid: number
    rate_limited: number
  }
}

export default function PingFlowPage() {
  const { buildQueryString } = useRTBFilters()
  const [data, setData] = useState<FlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null)
  const [filter, setFilter] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const qs = buildQueryString()
    try {
      const res = await fetch(`${QA_AGENT_URL}/analytics/ping-flow?${qs}`)
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

  const filteredData = useMemo(() => {
    if (!data || !filter) return data
    const relevantEdges = data.edges.filter(e => e.source === filter || e.target === filter)
    const relevantNodeIds = new Set([filter, ...relevantEdges.map(e => e.source), ...relevantEdges.map(e => e.target)])
    return {
      ...data,
      nodes: data.nodes.filter(n => relevantNodeIds.has(n.id)),
      edges: relevantEdges,
    }
  }, [data, filter])

  const publishers = filteredData?.nodes.filter(n => n.type === 'publisher') || []
  const campaigns = filteredData?.nodes.filter(n => n.type === 'campaign') || []
  const buyers = filteredData?.nodes.filter(n => n.type === 'buyer') || []

  const getEdgeWidth = (pings: number) => {
    if (!data) return 1
    const maxPings = Math.max(...data.edges.map(e => e.pings))
    return Math.max(1, Math.min(8, (pings / maxPings) * 8))
  }

  const getNodeSize = (pings: number) => {
    if (!data) return 'w-32'
    const maxPings = Math.max(...data.nodes.map(n => n.pings))
    const ratio = pings / maxPings
    if (ratio > 0.7) return 'w-40'
    if (ratio > 0.4) return 'w-36'
    return 'w-32'
  }

  return (
    <div className="p-6 space-y-6">
      <RTBFilterBar />

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : data ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {filter && (
                <Button variant="outline" size="sm" onClick={() => setFilter(null)}>
                  Clear Filter ×
                </Button>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-500" /> Publisher</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-cyan-500" /> Campaign</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-lime-500" /> Buyer</span>
                <span className="text-xs">• click to isolate • edge width = volume</span>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Ping Flow Visualization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative min-h-[500px] bg-muted/10 rounded-lg p-6 overflow-x-auto">
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '800px' }}>
                  {filteredData?.edges.map((edge, i) => {
                    const sourceNode = filteredData.nodes.find(n => n.id === edge.source)
                    const targetNode = filteredData.nodes.find(n => n.id === edge.target)
                    if (!sourceNode || !targetNode) return null

                    const sourceIdx = sourceNode.type === 'publisher'
                      ? publishers.findIndex(n => n.id === edge.source)
                      : campaigns.findIndex(n => n.id === edge.source)
                    const targetIdx = targetNode.type === 'campaign'
                      ? campaigns.findIndex(n => n.id === edge.target)
                      : buyers.findIndex(n => n.id === edge.target)

                    const sourceX = sourceNode.type === 'publisher' ? 100 : 350
                    const targetX = targetNode.type === 'campaign' ? 350 : 600
                    const sourceY = 80 + sourceIdx * 100
                    const targetY = 80 + targetIdx * 100

                    return (
                      <path
                        key={i}
                        d={`M ${sourceX + 60} ${sourceY} C ${sourceX + 150} ${sourceY}, ${targetX - 90} ${targetY}, ${targetX} ${targetY}`}
                        fill="none"
                        stroke="rgb(132 204 22 / 0.3)"
                        strokeWidth={getEdgeWidth(edge.pings)}
                        strokeDasharray="4 2"
                      />
                    )
                  })}
                </svg>

                <div className="relative flex justify-between" style={{ minWidth: '800px' }}>
                  {/* Publishers Column */}
                  <div className="flex flex-col gap-4 z-10">
                    <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                      <Users className="h-3 w-3" /> PUBLISHERS
                    </div>
                    {publishers.map((node) => (
                      <div
                        key={node.id}
                        className={`${getNodeSize(node.pings)} p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          filter === node.id ? 'border-purple-500 bg-purple-500/20' : 'border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20'
                        }`}
                        onClick={() => setFilter(filter === node.id ? null : node.id)}
                      >
                        <div className="font-medium text-sm truncate">{node.name}</div>
                        <div className="text-xs text-muted-foreground">{(node.pings ?? 0).toLocaleString()} pings</div>
                        <div className="text-xs text-emerald-500">{(node.matched ?? 0).toLocaleString()} matched</div>
                      </div>
                    ))}
                  </div>

                  {/* Campaigns Column */}
                  <div className="flex flex-col gap-4 z-10">
                    <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                      <Package className="h-3 w-3" /> CAMPAIGNS
                    </div>
                    {campaigns.map((node) => (
                      <div
                        key={node.id}
                        className={`${getNodeSize(node.pings)} p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          filter === node.id ? 'border-cyan-500 bg-cyan-500/20' : 'border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20'
                        }`}
                        onClick={() => setFilter(filter === node.id ? null : node.id)}
                      >
                        <div className="font-medium text-sm truncate">{node.name}</div>
                        <div className="text-xs text-muted-foreground">{(node.pings ?? 0).toLocaleString()} pings</div>
                        <div className="text-xs text-emerald-500">{(node.matched ?? 0).toLocaleString()} matched</div>
                      </div>
                    ))}
                  </div>

                  {/* Buyers Column */}
                  <div className="flex flex-col gap-4 z-10">
                    <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> BUYERS
                    </div>
                    {buyers.map((node) => (
                      <div
                        key={node.id}
                        className={`${getNodeSize(node.pings)} p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          filter === node.id ? 'border-lime-500 bg-lime-500/20' : 'border-lime-500/50 bg-lime-500/10 hover:bg-lime-500/20'
                        }`}
                        onClick={() => setFilter(filter === node.id ? null : node.id)}
                      >
                        <div className="font-medium text-sm truncate">{node.name}</div>
                        <div className="text-xs text-muted-foreground">{(node.pings ?? 0).toLocaleString()} pings</div>
                        {node.efficiency !== undefined && (
                          <div className="text-xs">{(node.efficiency ?? 0).toFixed(0)} eff • {node.matched ?? 0} matched</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Pings Sent</div>
                <div className="text-2xl font-bold">{(data.stats?.total_pings ?? 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Bids Returned</div>
                <div className="text-2xl font-bold text-emerald-500">{(data.stats?.total_bids ?? 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Bid Rate</div>
                <div className="text-2xl font-bold text-cyan-500">{(data.stats?.bid_rate ?? 0).toFixed(1)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Avg Bid</div>
                <div className="text-2xl font-bold">${(data.stats?.avg_bid ?? 0).toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Campaign Pings</div>
                <div className="text-2xl font-bold">{campaigns.reduce((s, c) => s + (c.pings ?? 0), 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Rate Limited</div>
                <div className="text-2xl font-bold text-red-500">{(data.stats?.rate_limited ?? 0).toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
