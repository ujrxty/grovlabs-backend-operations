// TrackDrive API client for grovlabs.trackdrive.com

const TD_BASE_URL = `https://${process.env.TD_SUBDOMAIN || 'grovlabs'}.trackdrive.com/api/v1`

function getAuthHeader(): string {
  const pub = process.env.TD_PUBLIC_KEY || ''
  const prv = process.env.TD_PRIVATE_KEY || ''
  const encoded = Buffer.from(`${pub}:${prv}`).toString('base64')
  return `Basic ${encoded}`
}

interface TDRequestOptions {
  endpoint: string
  params?: Record<string, string | number | boolean | undefined>
}

async function tdFetch<T = any>({ endpoint, params }: TDRequestOptions): Promise<T> {
  const url = new URL(`${TD_BASE_URL}/${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, String(val))
      }
    })
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`TrackDrive API error: ${res.status} ${res.statusText}`, text)
    throw new Error(`TrackDrive API error: ${res.status}`)
  }

  return res.json()
}

// ---- Date formatting helper ----
function formatTDDate(date: Date): string {
  // Format as UTC: "2026-06-16 00:00:00"
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

// ---- API Methods ----

export interface TDCallsResponse {
  calls: any[]
  metadata: {
    total_count: number
    total_pages: number
    page: number
    per_page: number
    next_cursor?: number
  }
}

export async function getTDCallsCount(from: Date, to: Date): Promise<{ total: number; converted: number }> {
  // Get total calls count
  const totalRes = await tdFetch<TDCallsResponse>({
    endpoint: 'calls',
    params: {
      per_page: 1,
      columns: 'id',
      created_at_from: formatTDDate(from),
      created_at_to: formatTDDate(to),
      time_zone: 'UTC',
    },
  })

  // Get converted calls count
  const convertedRes = await tdFetch<TDCallsResponse>({
    endpoint: 'calls',
    params: {
      per_page: 1,
      columns: 'id',
      created_at_from: formatTDDate(from),
      created_at_to: formatTDDate(to),
      time_zone: 'UTC',
      buyer_converted: 'true',
    },
  })

  return {
    total: totalRes?.metadata?.total_count ?? 0,
    converted: convertedRes?.metadata?.total_count ?? 0,
  }
}

// Revenue per-call data: converted calls have revenue, buyer_revenue, payout, traffic_source_payout populated
// We paginate through converted calls for a date range and sum revenue
export interface TDRevenueResult {
  revenue: number        // Total buyer_revenue (what buyers pay)
  payout: number         // Total traffic_source_payout (what vendors earn)
  conversions: number    // Count of converted calls
  byBuyer: { name: string; revenue: number; payout: number; conversions: number }[]
  byOffer: { name: string; revenue: number; payout: number; conversions: number }[]
}

export async function getTDRevenueForPeriod(from: Date, to: Date): Promise<TDRevenueResult> {
  const buyerMap = new Map<string, { revenue: number; payout: number; conversions: number }>()
  const offerMap = new Map<string, { revenue: number; payout: number; conversions: number }>()
  let totalRevenue = 0
  let totalPayout = 0
  let totalConversions = 0
  let page = 1
  const perPage = 250

  // Paginate through all converted calls in the date range
  while (true) {
    const calls = await tdFetch<any[]>({
      endpoint: 'calls',
      params: {
        per_page: perPage,
        page,
        buyer_converted: 'true',
        root: 'false',
        columns: 'id,revenue,buyer_revenue,payout,traffic_source_payout,buyer,offer',
        created_at_from: formatTDDate(from),
        created_at_to: formatTDDate(to),
        time_zone: 'UTC',
      },
    })

    if (!calls || calls.length === 0) break

    for (const call of calls) {
      const rev = parseFloat(call.revenue) || parseFloat(call.buyer_revenue) || 0
      const pay = parseFloat(call.payout) || parseFloat(call.traffic_source_payout) || 0
      totalRevenue += rev
      totalPayout += pay
      totalConversions++

      // Group by buyer
      const buyerName = call.buyer || 'Unknown'
      const existing = buyerMap.get(buyerName) || { revenue: 0, payout: 0, conversions: 0 }
      existing.revenue += rev
      existing.payout += pay
      existing.conversions++
      buyerMap.set(buyerName, existing)

      // Group by offer
      const offerName = call.offer || 'Unknown'
      const existingOffer = offerMap.get(offerName) || { revenue: 0, payout: 0, conversions: 0 }
      existingOffer.revenue += rev
      existingOffer.payout += pay
      existingOffer.conversions++
      offerMap.set(offerName, existingOffer)
    }

    if (calls.length < perPage) break
    page++
    // Safety: max 20 pages (5000 converted calls)
    if (page > 20) break
  }

  const byBuyer = Array.from(buyerMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)

  const byOffer = Array.from(offerMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)

  return {
    revenue: Math.round(totalRevenue * 100) / 100,
    payout: Math.round(totalPayout * 100) / 100,
    conversions: totalConversions,
    byBuyer,
    byOffer,
  }
}

export interface TDOfferSummary {
  id: number
  name: string
  paused: boolean
}

export async function getTDOffers(): Promise<{ active: number; paused: number; total: number; offers: TDOfferSummary[] }> {
  const res = await tdFetch<TDOfferSummary[]>({
    endpoint: 'offers',
    params: {
      per_page: 100,
      root: 'false',
      columns: 'id,name,paused',
    },
  })

  const offers = res ?? []
  const active = offers.filter((o) => !o.paused).length
  const paused = offers.filter((o) => o.paused).length

  return { active, paused, total: offers.length, offers }
}

export interface TDTrafficSourceSummary {
  id: number
  company_name: string
  first_name: string
  last_name: string
  paused: boolean | null
}

export async function getTDTrafficSources(): Promise<{ active: number; paused: number; total: number }> {
  const res = await tdFetch<TDTrafficSourceSummary[]>({
    endpoint: 'traffic_sources',
    params: {
      per_page: 100,
      root: 'false',
      columns: 'id,company_name,paused',
    },
  })

  const sources = res ?? []
  const active = sources.filter((s) => !s.paused).length
  const paused = sources.filter((s) => s.paused === true).length

  return { active, paused, total: sources.length }
}

// ---- Vendor Scorecard ----
// Fetches ALL calls (converted and not) for a period, grouped by vendor
// (traffic source) and, within each vendor, by campaign (offer). Computes the
// full performance picture: calls, conversions, conv%, revenue, payout, profit,
// RPC (revenue / TOTAL calls), dupe%, avg duration, and no-answer counts.

export interface ScorecardCampaign {
  campaign: string
  buyer: string
  calls: number
  conversions: number
  convPct: number
  revenue: number
  payout: number
  profit: number
  rpc: number
  dupePct: number
  avgDuration: number
  noAnswers: number
}

export interface ScorecardVendor {
  trafficSourceId: string
  vendor: string
  calls: number
  conversions: number
  convPct: number
  revenue: number
  payout: number
  profit: number
  rpc: number
  dupePct: number
  avgDuration: number
  noAnswers: number
  connectedCalls: number
  campaigns: ScorecardCampaign[]
}

interface RawAgg {
  calls: number
  conversions: number
  revenue: number
  payout: number
  durationSum: number
  duplicates: number
  noAnswers: number
  connected: number
}

function newAgg(): RawAgg {
  return { calls: 0, conversions: 0, revenue: 0, payout: 0, durationSum: 0, duplicates: 0, noAnswers: 0, connected: 0 }
}

export async function getVendorScorecard(from: Date, to: Date): Promise<ScorecardVendor[]> {
  // vendorKey -> { name, agg, campaigns: Map<campaignKey, {campaign,buyer,agg}> }
  const vendors = new Map<string, {
    name: string
    agg: RawAgg
    campaigns: Map<string, { campaign: string; buyer: string; agg: RawAgg }>
  }>()

  let page = 1
  const perPage = 250

  while (true) {
    const calls = await tdFetch<any[]>({
      endpoint: 'calls',
      params: {
        per_page: perPage,
        page,
        root: 'false',
        columns: 'id,traffic_source,traffic_source_id,offer,buyer,buyer_converted,connected_to,total_duration,answered_duration,revenue,buyer_revenue,payout,traffic_source_payout,traffic_source_repeat_caller',
        created_at_from: formatTDDate(from),
        created_at_to: formatTDDate(to),
        time_zone: 'UTC',
      },
    })

    if (!calls || calls.length === 0) break

    for (const call of calls) {
      const vName = call.traffic_source || 'Unknown Vendor'
      const vId = String(call.traffic_source_id ?? vName)
      const cName = call.offer || 'Unknown Campaign'
      const buyer = call.buyer || '—'
      const converted = !!call.buyer_converted
      const rev = converted ? (parseFloat(call.revenue) || parseFloat(call.buyer_revenue) || 0) : 0
      const pay = converted ? (parseFloat(call.traffic_source_payout) || parseFloat(call.payout) || 0) : 0
      const dur = Number(call.answered_duration) || Number(call.total_duration) || 0
      const isDup = call.traffic_source_repeat_caller === 'Repeat'
      const isConnected = !!call.connected_to
      const isNoAnswer = !isConnected

      if (!vendors.has(vId)) {
        vendors.set(vId, { name: vName, agg: newAgg(), campaigns: new Map() })
      }
      const v = vendors.get(vId)!
      const cKey = `${cName}|||${buyer}`
      if (!v.campaigns.has(cKey)) {
        v.campaigns.set(cKey, { campaign: cName, buyer, agg: newAgg() })
      }
      const c = v.campaigns.get(cKey)!

      for (const a of [v.agg, c.agg]) {
        a.calls++
        if (converted) a.conversions++
        a.revenue += rev
        a.payout += pay
        a.durationSum += dur
        if (isDup) a.duplicates++
        if (isNoAnswer) a.noAnswers++
        if (isConnected) a.connected++
      }
    }

    if (calls.length < perPage) break
    page++
    if (page > 40) break // Safety: max 10,000 calls
  }

  const round2 = (n: number) => Math.round(n * 100) / 100

  const result: ScorecardVendor[] = Array.from(vendors.entries()).map(([vId, v]) => {
    const a = v.agg
    const campaigns: ScorecardCampaign[] = Array.from(v.campaigns.values()).map((c) => {
      const ca = c.agg
      return {
        campaign: c.campaign,
        buyer: c.buyer,
        calls: ca.calls,
        conversions: ca.conversions,
        convPct: ca.calls ? round2((ca.conversions / ca.calls) * 100) : 0,
        revenue: round2(ca.revenue),
        payout: round2(ca.payout),
        profit: round2(ca.revenue - ca.payout),
        rpc: ca.calls ? round2(ca.revenue / ca.calls) : 0,
        dupePct: ca.calls ? round2((ca.duplicates / ca.calls) * 100) : 0,
        avgDuration: ca.calls ? Math.round(ca.durationSum / ca.calls) : 0,
        noAnswers: ca.noAnswers,
      }
    }).sort((x, y) => y.revenue - x.revenue || y.calls - x.calls)

    return {
      trafficSourceId: vId,
      vendor: v.name,
      calls: a.calls,
      conversions: a.conversions,
      convPct: a.calls ? round2((a.conversions / a.calls) * 100) : 0,
      revenue: round2(a.revenue),
      payout: round2(a.payout),
      profit: round2(a.revenue - a.payout),
      rpc: a.calls ? round2(a.revenue / a.calls) : 0,
      dupePct: a.calls ? round2((a.duplicates / a.calls) * 100) : 0,
      avgDuration: a.calls ? Math.round(a.durationSum / a.calls) : 0,
      noAnswers: a.noAnswers,
      connectedCalls: a.connected,
      campaigns,
    }
  }).sort((x, y) => y.revenue - x.revenue || y.calls - x.calls)

  return result
}
