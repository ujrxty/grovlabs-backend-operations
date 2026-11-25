// CallGrid API client (replacing TrackDrive). While publishers move over, dashboard reports read both
// platforms: CallGrid calls come back in TrackDrive's call shape and under the TrackDrive buyer /
// traffic source ids the dashboard already keys on, so vendor reports, buyer reports and the
// scorecard keep working.
//
//   destination -> TrackDrive buyer    (each CallGrid destination's notes say "TrackDrive: <buyer name>")
//   vendor      -> TrackDrive traffic source (normalized name, "1 PM" -> "1025 - 1PM")
//   campaign    -> TrackDrive offer name (table below)
//
// No CALLGRID_API_KEY = disabled (TrackDrive only).

const CG = 'https://api.callgrid.com/api'
const TD_BASE_URL = `https://${process.env.TD_SUBDOMAIN || 'grovlabs'}.trackdrive.com/api/v1`

export const CAMPAIGN_TO_TD_OFFER: Record<string, string> = {
  'Plumbing Inbounds': 'Plumbing', 'Pest Control Inbounds': 'Pest Inbounds', 'HVAC Inbounds': 'HVAC',
  'HVAC Static Inbounds': 'HVAC - Static Inbound', 'Roofing Inbounds': 'Roofing', 'Windows Installation Inbounds': 'Windows Installation',
  'Bathroom Remodeling Inbounds': 'Bathroom Remodeling', 'Home Insurance Inbounds': 'Home Insurance Calls',
  'Auto Insurance Inbounds': 'Auto Inbounds Calls', 'Medicare Inbounds': 'Medicare Inbounds', 'ACA Inbounds': 'ACA Inbounds',
  'Final Expense Inbounds': 'Final Expense inbounds RTB', 'Pest Control CPL': 'Pest Control CPL', 'ACA Transfers': 'ACA Transfers',
  'SSDI Transfers': 'SSDI', 'Final Expense CPA': 'Final Expense',
}

export const callgridEnabled = () => !!process.env.CALLGRID_API_KEY

const norm = (s: any) => String(s || '').toLowerCase().replace(/^\d+\s*-\s*/, '').replace(/[^a-z0-9]/g, '')

async function cgGet(path: string, params: Record<string, any> = {}): Promise<any> {
  const url = new URL(CG + path)
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v))
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${process.env.CALLGRID_API_KEY}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (res.ok) return res.json()
    if ((res.status === 429 || res.status >= 500) && attempt < 5) { await new Promise((r) => setTimeout(r, 3000 * attempt)); continue }
    throw new Error(`CallGrid API error: ${res.status} ${path}`)
  }
}

async function tdList(endpoint: string, root: string): Promise<any[]> {
  const auth = 'Basic ' + Buffer.from(`${process.env.TD_PUBLIC_KEY || ''}:${process.env.TD_PRIVATE_KEY || ''}`).toString('base64')
  const out: any[] = []
  let cursor: string | null = null
  for (let page = 0; page < 20; page++) {
    const url = new URL(`${TD_BASE_URL}/${endpoint}`)
    url.searchParams.set('per_page', '200')
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetch(url.toString(), { headers: { Authorization: auth, Accept: 'application/json' }, cache: 'no-store' })
    if (!res.ok) break
    const j: any = await res.json()
    const rows: any[] = Array.isArray(j) ? j : j[root] || []
    out.push(...rows)
    cursor = j?.metadata?.next_cursor ? String(j.metadata.next_cursor) : null
    if (!cursor || !rows.length) break
  }
  return out
}

type Ref = { id: string; name: string }
let mapCache: { at: number; buyer: Map<string, Ref>; source: Map<string, Ref> } | null = null

async function maps() {
  if (mapCache && Date.now() - mapCache.at < 3600_000) return mapCache
  const [dests, vendors, tdBuyers, tdSources] = await Promise.all([
    cgGet('/destination').then((j) => j.data || j), cgGet('/vendor').then((j) => j.data || j),
    tdList('buyers', 'buyers'), tdList('traffic_sources', 'traffic_sources'),
  ])
  const buyer = new Map<string, Ref>()
  for (const d of dests) {
    const tdName = String(d.notes || '').match(/^TrackDrive: (.+)$/m)?.[1]?.trim()
    const hit = tdName ? tdBuyers.find((b: any) => String(b.name || '').trim() === tdName) : null
    buyer.set(d.id, hit ? { id: String(hit.id), name: String(hit.name) } : { id: `cg:${d.id}`, name: String(d.name).trim() })
  }
  const source = new Map<string, Ref>()
  for (const v of vendors) {
    const nv = norm(v.name)
    const hit = tdSources.find((t: any) => norm(t.name) === nv) || tdSources.find((t: any) => norm(t.name).includes(nv) || nv.includes(norm(t.name)))
    source.set(v.id, hit ? { id: String(hit.id), name: String(hit.name) } : { id: `cg:${v.id}`, name: String(v.name).trim() })
  }
  mapCache = { at: Date.now(), buyer, source }
  return mapCache
}

/** CallGrid calls created in [from, to) in TrackDrive's call shape, keyed to TrackDrive ids. */
export async function cgCallsAsTd(from: Date, to: Date): Promise<any[]> {
  if (!callgridEnabled()) return []
  const m = await maps()
  const raw: any[] = []
  let after: any = null
  for (let page = 0; page < 200; page++) {
    const j = await cgGet('/call', { startDate: from.toISOString(), endDate: to.toISOString(), maxItems: 500, useCursor: true, ...(after ? { searchAfter: JSON.stringify(after) } : {}) })
    raw.push(...(j.data || []))
    if (!j.hasMore || !j.nextCursor) break
    after = j.nextCursor
  }
  return raw.map((c) => {
    const b = c.DestinationId ? m.buyer.get(c.DestinationId) || { id: `cg:${c.DestinationId}`, name: c.DestinationName || 'Unknown buyer' } : null
    const s = m.source.get(c.VendorId) || { id: `cg:${c.VendorId}`, name: c.VendorName || 'Unknown Vendor' }
    const camp = String(c.CampaignName || '').trim()
    const converted = !!(c.paid || c.CallPaid || c.converted)
    const revenue = Number(c.revenue ?? c.RevenueAmount ?? 0) || 0
    const payout = Number(c.payout ?? c.PayoutAmount ?? 0) || 0
    return {
      platform: 'callgrid',
      id: `cg:${c.id}`,
      created_at: c.createdAt || c.UTCISODate,
      offer: CAMPAIGN_TO_TD_OFFER[camp] || camp || 'Unknown Campaign',
      offer_id: null,
      buyer: b?.name ?? null, buyer_id: b?.id ?? null,
      buyer_converted: converted,
      traffic_source: s.name, traffic_source_id: s.id,
      revenue, buyer_revenue: revenue, payout, traffic_source_payout: payout,
      total_duration: Number(c.CallDurationFromInbound ?? c.callDuration ?? 0) || 0,
      answered_duration: Number(c.CallDurationFromConnect ?? 0) || 0,
      connected_to: c.connected || c.CallConnected ? (b?.name || 'buyer') : null,
      traffic_source_repeat_caller: c.Repeat || c.Duplicate ? 'Repeat' : '',
      caller_number: c.CallerId || c.from || '',
      caller_city: c.InboundCity || '',
      caller_country: c.InboundCountryCode || 'US',
    }
  })
}

/** Same, but never throws: a CallGrid outage must not take TrackDrive reports down with it. */
export async function cgCallsSafe(from: Date, to: Date): Promise<any[]> {
  try { return await cgCallsAsTd(from, to) } catch (e: any) { console.error('CallGrid calls failed, TrackDrive only:', e.message); return [] }
}
