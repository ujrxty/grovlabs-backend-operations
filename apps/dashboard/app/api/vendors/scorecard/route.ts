export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getVendorScorecard, type ScorecardVendor } from '@/lib/trackdrive'
import { getBusinessDateRange } from '@/lib/business-time'

// Alert thresholds (mirrors the Loss Monitor spec, applied at the vendor level)
const LOW_CONV_PCT = 15         // flag conversion rate below this %
const MIN_CALLS_FOR_CONV = 5    // ...only once vendor has this many calls
const LOW_RPC = 5              // flag RPC at or below $5
const MIN_CALLS_FOR_RPC = 10    // ...once vendor has 10+ calls
const SHORT_DUR = 60           // flag avg duration under 60s
const MIN_CALLS_FOR_DUR = 10
const HIGH_DUPE_PCT = 30       // flag duplicate rate above this %

export interface VendorAlert {
  trafficSourceId: string
  vendor: string
  severity: 'warning' | 'critical'
  messages: string[]
  revenue: number
  payout: number
  profit: number
}

function buildAlerts(vendors: ScorecardVendor[]): VendorAlert[] {
  const alerts: VendorAlert[] = []
  for (const v of vendors) {
    const messages: string[] = []
    let severity: 'warning' | 'critical' = 'warning'

    if (v.calls >= MIN_CALLS_FOR_CONV && v.convPct < LOW_CONV_PCT) {
      messages.push(`Very low conversion rate: ${v.convPct.toFixed(1)}%`)
    }
    if (v.calls >= MIN_CALLS_FOR_DUR && v.avgDuration < SHORT_DUR && v.conversions === 0) {
      messages.push(`Avg call duration only ${v.avgDuration}s with 0 conversions`)
      severity = 'critical'
    }
    if (v.calls >= MIN_CALLS_FOR_RPC && v.rpc <= LOW_RPC) {
      messages.push(`Low RPC: $${v.rpc.toFixed(2)} across ${v.calls} calls`)
    }
    if (v.dupePct > HIGH_DUPE_PCT) {
      messages.push(`High duplicate rate: ${v.dupePct.toFixed(1)}%`)
    }
    if (v.profit < 0) {
      messages.push(`Negative profit: -$${Math.abs(v.profit).toFixed(2)}`)
      severity = 'critical'
    }

    if (messages.length > 0) {
      alerts.push({
        trafficSourceId: v.trafficSourceId,
        vendor: v.vendor,
        severity,
        messages,
        revenue: v.revenue,
        payout: v.payout,
        profit: v.profit,
      })
    }
  }
  // critical first, then by lowest profit
  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
    return a.profit - b.profit
  })
}

function statusOf(v: ScorecardVendor): 'good' | 'neutral' | 'warning' {
  if (v.profit < 0 || (v.calls >= MIN_CALLS_FOR_CONV && v.convPct < LOW_CONV_PCT)) return 'warning'
  if (v.profit > 0 && v.conversions > 0) return 'good'
  return 'neutral'
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('range') || 'today'
    const customFrom = searchParams.get('from') || undefined
    const customTo = searchParams.get('to') || undefined

    const { from, to } = getBusinessDateRange(preset, customFrom, customTo)
    const vendors = await getVendorScorecard(from, to)

    const withStatus = vendors.map((v) => ({ ...v, status: statusOf(v) }))
    const alerts = buildAlerts(vendors)

    const totals = vendors.reduce(
      (acc, v) => {
        acc.calls += v.calls
        acc.conversions += v.conversions
        acc.revenue += v.revenue
        acc.payout += v.payout
        acc.profit += v.profit
        return acc
      },
      { calls: 0, conversions: 0, revenue: 0, payout: 0, profit: 0 },
    )

    const profitable = withStatus.filter((v) => v.profit > 0).length
    const unprofitable = withStatus.filter((v) => v.profit < 0).length

    return NextResponse.json({
      range: preset,
      from: from.toISOString(),
      to: to.toISOString(),
      summary: {
        activeVendors: vendors.length,
        totalCalls: totals.calls,
        totalConversions: totals.conversions,
        totalRevenue: Math.round(totals.revenue * 100) / 100,
        totalPayout: Math.round(totals.payout * 100) / 100,
        totalProfit: Math.round(totals.profit * 100) / 100,
        profitable,
        unprofitable,
        alertCount: alerts.length,
      },
      alerts,
      vendors: withStatus,
    })
  } catch (err: any) {
    console.error('Scorecard error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to build scorecard' }, { status: 500 })
  }
}
