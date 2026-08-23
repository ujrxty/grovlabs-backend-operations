export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const TD_BASE_URL = `https://${process.env.TD_SUBDOMAIN || 'grovlabs'}.trackdrive.com/api/v1`

function getAuthHeader(): string {
  const pub = process.env.TD_PUBLIC_KEY || ''
  const prv = process.env.TD_PRIVATE_KEY || ''
  const encoded = Buffer.from(`${pub}:${prv}`).toString('base64')
  return `Basic ${encoded}`
}

function formatTDDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

interface CallRow {
  id: number
  created_at: string
  offer: string
  offer_id: number
  caller_number: string
  caller_city: string
  caller_country: string
  total_duration: number
  answered_duration: number
  revenue: number
  buyer_revenue: number
}

async function fetchAllConvertedCallsForBuyer(
  buyerId: string,
  from: Date,
  to: Date
): Promise<CallRow[]> {
  const allCalls: CallRow[] = []
  let page = 1
  const perPage = 250

  while (true) {
    const url = new URL(`${TD_BASE_URL}/calls`)
    url.searchParams.set('per_page', String(perPage))
    url.searchParams.set('page', String(page))
    url.searchParams.set('buyer_converted', 'true')
    url.searchParams.set('root', 'false')
    url.searchParams.set('buyer_id', buyerId)
    url.searchParams.set('created_at_from', formatTDDate(from))
    url.searchParams.set('created_at_to', formatTDDate(to))
    url.searchParams.set('time_zone', 'UTC')
    url.searchParams.set('columns', 'id,created_at,offer,offer_id,caller_number,caller_city,caller_country,total_duration,answered_duration,revenue,buyer_revenue')

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': getAuthHeader(), 'Accept': 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error(`TD API error (buyer report): ${res.status}`)
      break
    }

    const calls = await res.json()
    if (!calls || !Array.isArray(calls) || calls.length === 0) break

    allCalls.push(...calls)
    if (calls.length < perPage) break
    page++
    if (page > 30) break // Safety: max 7500 calls
  }

  return allCalls
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    // Accept a single buyerId or multiple comma-separated buyerIds
    const buyerIdsParam = searchParams.get('buyerIds') || searchParams.get('buyerId') || ''
    const buyerIds = buyerIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
    const periodStart = searchParams.get('periodStart') // YYYY-MM-DD
    const periodEnd = searchParams.get('periodEnd') // YYYY-MM-DD

    if (buyerIds.length === 0) {
      return NextResponse.json({ error: 'buyerId required' }, { status: 400 })
    }
    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'periodStart and periodEnd required' }, { status: 400 })
    }

    // Parse dates
    const [sy, sm, sd] = periodStart.split('-').map(Number)
    const [ey, em, ed] = periodEnd.split('-').map(Number)
    const from = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0))
    const to = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999))

    // Fetch calls for each selected buyer and combine (dedupe by call id)
    const callsById = new Map<number, CallRow>()
    for (const bid of buyerIds) {
      const buyerCalls = await fetchAllConvertedCallsForBuyer(bid, from, to)
      for (const c of buyerCalls) {
        callsById.set(c.id, c)
      }
    }
    const calls = Array.from(callsById.values())

    // Group by campaign (offer)
    const byCampaign = new Map<string, {
      offerId: number
      calls: number
      revenue: number
      totalDuration: number
      callDetails: {
        id: number
        date: string
        callerNumber: string
        city: string
        duration: number
        revenue: number
      }[]
    }>()

    let totalRevenue = 0
    let totalCalls = 0

    for (const call of calls) {
      const campaign = call.offer || 'Unknown'
      const rev = parseFloat(String(call.revenue)) || parseFloat(String(call.buyer_revenue)) || 0

      if (!byCampaign.has(campaign)) {
        byCampaign.set(campaign, { offerId: call.offer_id, calls: 0, revenue: 0, totalDuration: 0, callDetails: [] })
      }
      const entry = byCampaign.get(campaign)!
      entry.calls++
      entry.revenue += rev
      entry.totalDuration += (call.answered_duration || call.total_duration || 0)
      entry.callDetails.push({
        id: call.id,
        date: call.created_at,
        callerNumber: call.caller_number || '',
        city: call.caller_city || '',
        duration: call.answered_duration || call.total_duration || 0,
        revenue: Math.round(rev * 100) / 100,
      })

      totalRevenue += rev
      totalCalls++
    }

    // Sort call details by date within each campaign
    for (const entry of byCampaign.values()) {
      entry.callDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }

    const campaignBreakdown = Array.from(byCampaign.entries())
      .map(([campaign, data]) => ({
        campaign,
        offerId: data.offerId,
        calls: data.calls,
        revenue: Math.round(data.revenue * 100) / 100,
        avgDuration: data.calls > 0 ? Math.round(data.totalDuration / data.calls) : 0,
        avgRevenue: data.calls > 0 ? Math.round((data.revenue / data.calls) * 100) / 100 : 0,
        callDetails: data.callDetails,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({
      buyerIds,
      periodStart,
      periodEnd,
      totalCalls,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      campaignBreakdown,
    })
  } catch (error: any) {
    console.error('Buyer report error:', error)
    return NextResponse.json({ error: 'Failed to generate buyer report' }, { status: 500 })
  }
}
