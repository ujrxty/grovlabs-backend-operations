export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { enrichReviews } from '@/lib/non-conversion-enrich'

// The two "turned away" outcomes to hunt for patterns in: a buyer bid
// on the ping but then couldn't actually service the call (no carrier available),
// or rejected it as out of its coverage area. Clustering these by
// Buyer -> State -> Area code surfaces the repeatable dead zones.
const GAP_REASONS = ['no_carrier_available', 'buyer_rejected_out_of_area']

const BUSINESS_TZ = 'America/New_York'

// Extract the 3-digit North American area code from a caller number in any of
// the common formats (+1XXXXXXXXXX, 1XXXXXXXXXX, XXXXXXXXXX, (XXX) XXX-XXXX).
function parseAreaCode(num: string | null | undefined): string | null {
  if (!num) return null
  let digits = String(num).replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  if (digits.length < 10) return null
  const area = digits.slice(0, 3)
  if (!/^[2-9]\d{2}$/.test(area)) return null
  return area
}

// Hour of day (0-23) in the business timezone for a given timestamp.
function hourInBusinessTz(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ, hour: 'numeric', hour12: false,
  }).formatToParts(d)
  const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0'
  let h = parseInt(hourPart, 10)
  if (h === 24) h = 0
  return h
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const params = url.searchParams
    const date = params.get('date') ?? ''
    const dateFrom = params.get('date_from') ?? ''
    const dateTo = params.get('date_to') ?? ''
    const buyer = params.get('buyer') ?? ''
    const state = params.get('state') ?? ''

    const where: any = { outcome_reason: { in: GAP_REASONS } }
    if (date) {
      where.review_date = date
    } else if (dateFrom || dateTo) {
      where.review_date = {}
      if (dateFrom) where.review_date.gte = dateFrom
      if (dateTo) where.review_date.lte = dateTo
    }
    if (buyer) where.buyer_name = buyer

    const rows = await prisma.non_conversion_review.findMany({
      where,
      select: {
        id: true,
        trackdrive_call_id: true,
        buyer_name: true,
        vendor_name: true,
        campaign_name: true,
        caller_number: true,
        caller_city: true,
        caller_state: true,
        outcome_reason: true,
        duration: true,
        recording_url: true,
        review_date: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    })

    const enriched = await enrichReviews(rows as any[])

    // Apply the state filter AFTER enrichment (caller_state is often backfilled).
    const filtered = state
      ? enriched.filter((r) => (r.caller_state ?? '').toUpperCase() === state.toUpperCase())
      : enriched

    // ---- Cluster: Buyer -> State -> Area code ----
    type Cluster = {
      key: string
      buyer: string
      state: string
      areaCode: string
      city: string | null
      count: number
      noCarrier: number
      outOfArea: number
      cityCounts: Record<string, number>
      calls: any[]
    }
    const clusterMap = new Map<string, Cluster>()
    const hourBuckets: number[] = Array.from({ length: 24 }, () => 0)
    const stateMap = new Map<string, number>()
    const buyerSet = new Set<string>()
    const stateSet = new Set<string>()
    const areaSet = new Set<string>()
    let noCarrierTotal = 0
    let outOfAreaTotal = 0

    for (const r of filtered) {
      const buyerName = r.buyer_name || 'Unknown buyer'
      const st = (r.caller_state || '').toUpperCase() || 'Unknown'
      const area = parseAreaCode(r.caller_number) || 'Unknown'
      const key = `${buyerName}|${st}|${area}`

      if (!clusterMap.has(key)) {
        clusterMap.set(key, {
          key, buyer: buyerName, state: st, areaCode: area, city: null,
          count: 0, noCarrier: 0, outOfArea: 0, cityCounts: {}, calls: [],
        })
      }
      const c = clusterMap.get(key)!
      c.count += 1
      if (r.outcome_reason === 'no_carrier_available') { c.noCarrier += 1; noCarrierTotal += 1 }
      if (r.outcome_reason === 'buyer_rejected_out_of_area') { c.outOfArea += 1; outOfAreaTotal += 1 }
      if (r.caller_city) c.cityCounts[r.caller_city] = (c.cityCounts[r.caller_city] ?? 0) + 1
      c.calls.push({
        id: r.id,
        trackdrive_call_id: r.trackdrive_call_id,
        caller_number: r.caller_number ?? null,
        caller_city: r.caller_city ?? null,
        caller_state: r.caller_state ?? null,
        vendor_name: r.vendor_name ?? null,
        campaign_name: r.campaign_name ?? null,
        outcome_reason: r.outcome_reason,
        duration: r.duration ?? 0,
        recording_url: r.recording_url ?? null,
        review_date: r.review_date,
        created_at: r.created_at?.toISOString?.() ?? String(r.created_at),
      })

      // time-of-day pattern
      if (r.created_at) hourBuckets[hourInBusinessTz(new Date(r.created_at))] += 1
      // state ranking
      if (st !== 'Unknown') stateMap.set(st, (stateMap.get(st) ?? 0) + 1)

      buyerSet.add(buyerName)
      if (st !== 'Unknown') stateSet.add(st)
      if (area !== 'Unknown') areaSet.add(area)
    }

    const clusters = Array.from(clusterMap.values()).map((c) => {
      // representative city = most frequently seen city in the cluster
      let city: string | null = null
      let best = 0
      for (const [name, n] of Object.entries(c.cityCounts)) {
        if (n > best) { best = n; city = name }
      }
      const { cityCounts, ...rest } = c
      return { ...rest, city }
    })
    clusters.sort((a, b) => b.count - a.count || a.buyer.localeCompare(b.buyer))

    const byState = Array.from(stateMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    const byHour = hourBuckets.map((count, hour) => ({ hour, count }))

    // Facet lists for the filter dropdowns (scoped to date range + gap reasons only)
    const facetBuyers = Array.from(buyerSet).filter((b) => b !== 'Unknown buyer').sort()
    const facetStates = Array.from(stateSet).sort()

    return NextResponse.json({
      summary: {
        total: filtered.length,
        noCarrier: noCarrierTotal,
        outOfArea: outOfAreaTotal,
        buyers: buyerSet.size,
        states: stateSet.size,
        areaCodes: areaSet.size,
      },
      clusters,
      byState,
      byHour,
      facets: { buyers: facetBuyers, states: facetStates },
    })
  } catch (error: any) {
    console.error('Coverage gaps error:', error)
    return NextResponse.json({ error: 'Failed to load coverage gaps' }, { status: 500 })
  }
}
