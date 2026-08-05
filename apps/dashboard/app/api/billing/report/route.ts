export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const TD_BASE_URL = `https://${process.env.TD_SUBDOMAIN || 'bsbwinc'}.trackdrive.com/api/v1`

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
  traffic_source_payout: number
  payout: number
  revenue: number
  buyer_revenue: number
}

async function fetchAllConvertedCalls(
  trafficSourceId: string,
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
    url.searchParams.set('traffic_source_id', trafficSourceId)
    url.searchParams.set('created_at_from', formatTDDate(from))
    url.searchParams.set('created_at_to', formatTDDate(to))
    url.searchParams.set('time_zone', 'UTC')
    url.searchParams.set('columns', 'id,created_at,offer,offer_id,caller_number,caller_city,caller_country,total_duration,answered_duration,traffic_source_payout,payout,revenue,buyer_revenue')

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': getAuthHeader(), 'Accept': 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error(`TD API error: ${res.status}`)
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
    const vendorId = searchParams.get('vendorId') // vendor_profile ID
    const tdSourceId = searchParams.get('tdSourceId') // TrackDrive traffic_source_id
    const periodStart = searchParams.get('periodStart') // YYYY-MM-DD
    const periodEnd = searchParams.get('periodEnd') // YYYY-MM-DD

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'periodStart and periodEnd required' }, { status: 400 })
    }
    if (!tdSourceId && !vendorId) {
      return NextResponse.json({ error: 'tdSourceId or vendorId required' }, { status: 400 })
    }

    // Resolve TD source ID from vendor profile if needed
    let resolvedTdSourceId = tdSourceId
    let vendorInfo: any = null

    if (vendorId) {
      const vendor = await prisma.vendor_profile.findUnique({
        where: { id: vendorId },
        select: { id: true, company_name: true, contact_name: true, email: true, td_source_id: true, td_source_name: true },
      })
      if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
      resolvedTdSourceId = vendor.td_source_id
      vendorInfo = vendor
    }

    if (!resolvedTdSourceId) {
      return NextResponse.json({ error: 'No TrackDrive source ID found for vendor' }, { status: 400 })
    }

    // Parse dates
    const [sy, sm, sd] = periodStart.split('-').map(Number)
    const [ey, em, ed] = periodEnd.split('-').map(Number)
    const from = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0))
    const to = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999))

    // Fetch all converted calls
    const calls = await fetchAllConvertedCalls(resolvedTdSourceId, from, to)

    // Group by offer
    const byOffer = new Map<string, {
      offerId: number
      calls: number
      payout: number
      revenue: number
      totalDuration: number
      callDetails: {
        id: number
        date: string
        callerNumber: string
        city: string
        duration: number
        payout: number
        revenue: number
      }[]
    }>()

    let totalPayout = 0
    let totalRevenue = 0
    let totalCalls = 0

    for (const call of calls) {
      const offer = call.offer || 'Unknown'
      const pay = parseFloat(String(call.traffic_source_payout)) || parseFloat(String(call.payout)) || 0
      const rev = parseFloat(String(call.revenue)) || parseFloat(String(call.buyer_revenue)) || 0

      if (!byOffer.has(offer)) {
        byOffer.set(offer, { offerId: call.offer_id, calls: 0, payout: 0, revenue: 0, totalDuration: 0, callDetails: [] })
      }
      const entry = byOffer.get(offer)!
      entry.calls++
      entry.payout += pay
      entry.revenue += rev
      entry.totalDuration += (call.answered_duration || call.total_duration || 0)
      entry.callDetails.push({
        id: call.id,
        date: call.created_at,
        callerNumber: call.caller_number || '',
        city: call.caller_city || '',
        duration: call.answered_duration || call.total_duration || 0,
        payout: Math.round(pay * 100) / 100,
        revenue: Math.round(rev * 100) / 100,
      })

      totalPayout += pay
      totalRevenue += rev
      totalCalls++
    }

    // Sort call details by date
    for (const entry of byOffer.values()) {
      entry.callDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }

    const offerBreakdown = Array.from(byOffer.entries())
      .map(([offer, data]) => ({
        offer,
        offerId: data.offerId,
        calls: data.calls,
        payout: Math.round(data.payout * 100) / 100,
        revenue: Math.round(data.revenue * 100) / 100,
        avgDuration: data.calls > 0 ? Math.round(data.totalDuration / data.calls) : 0,
        avgPayout: data.calls > 0 ? Math.round((data.payout / data.calls) * 100) / 100 : 0,
        callDetails: data.callDetails,
      }))
      .sort((a, b) => b.payout - a.payout)

    // Determine payment due date based on billing period
    // 1st-15th payable on 31st/last day of month, 16th-30th payable on 16th of next month
    let paymentDueDate: string
    const startDay = from.getUTCDate()
    if (startDay <= 15) {
      // First half: due on last day of same month
      const lastDay = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0))
      paymentDueDate = lastDay.toISOString().split('T')[0]
    } else {
      // Second half: due on 16th of next month
      const nextMonth = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 16))
      paymentDueDate = nextMonth.toISOString().split('T')[0]
    }

    return NextResponse.json({
      vendor: vendorInfo,
      tdSourceId: resolvedTdSourceId,
      periodStart,
      periodEnd,
      paymentDueDate,
      totalCalls,
      totalPayout: Math.round(totalPayout * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      margin: Math.round((totalRevenue - totalPayout) * 100) / 100,
      offerBreakdown,
    })
  } catch (error: any) {
    console.error('Billing report error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
