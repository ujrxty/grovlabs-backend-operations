export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const TD_BASE_URL = `https://${process.env.TD_SUBDOMAIN || 'grovlabs'}.trackdrive.com/api/v1`

function getAuthHeader(): string {
  const pub = process.env.TD_PUBLIC_KEY || ''
  const prv = process.env.TD_PRIVATE_KEY || ''
  const encoded = Buffer.from(`${pub}:${prv}`).toString('base64')
  return `Basic ${encoded}`
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'vendors'

    if (action === 'vendors') {
      // 1. Get all TrackDrive traffic sources
      const url = new URL(`${TD_BASE_URL}/traffic_sources`)
      url.searchParams.set('per_page', '100')
      url.searchParams.set('root', 'false')
      url.searchParams.set('columns', 'id,user_traffic_source_id,first_name,last_name,company_name,paused,last_call_at,calls_count')

      const tdRes = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthHeader(), 'Accept': 'application/json' },
        cache: 'no-store',
      })

      const tdSources = tdRes.ok ? await tdRes.json() : []

      // 2. Get all local vendor profiles with TD source IDs
      const localVendors = await prisma.vendor_profile.findMany({
        where: { td_source_id: { not: null } },
        select: {
          id: true,
          company_name: true,
          contact_name: true,
          email: true,
          td_source_id: true,
          td_source_name: true,
          status: true,
        },
      })

      // Build a map of TD source ID -> local vendor
      const localByTdId = new Map<string, typeof localVendors[0]>()
      for (const v of localVendors) {
        if (v.td_source_id) localByTdId.set(v.td_source_id, v)
      }

      // 3. Merge: all TD sources, enriched with local vendor data where available
      const vendors = (Array.isArray(tdSources) ? tdSources : []).map((ts: any) => {
        const local = localByTdId.get(String(ts.id))
        const name = [ts.first_name, ts.last_name].filter(Boolean).join(' ').trim()
        return {
          id: local?.id || null, // local vendor_profile ID (null if not in DB)
          td_source_id: String(ts.id),
          company_name: local?.company_name || ts.company_name || name || 'Unknown',
          contact_name: local?.contact_name || name || '',
          email: local?.email || '',
          td_source_name: ts.company_name || name,
          status: local?.status || (ts.paused === true ? 'paused' : ts.paused === false ? 'active' : 'active'),
          paused: ts.paused,
          lastCallAt: ts.last_call_at || null,
          callsCount: ts.calls_count || 0,
          hasLocalProfile: !!local,
        }
      }).sort((a: any, b: any) => a.company_name.localeCompare(b.company_name))

      return NextResponse.json({ vendors })
    }

    if (action === 'buyers') {
      // Get all TrackDrive buyers
      const url = new URL(`${TD_BASE_URL}/buyers`)
      url.searchParams.set('per_page', '200')
      url.searchParams.set('columns', 'id,user_buyer_id,name,company_name,email,number,paused,last_call_at')

      const tdRes = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthHeader(), 'Accept': 'application/json' },
        cache: 'no-store',
      })

      const tdJson = tdRes.ok ? await tdRes.json() : null
      const tdBuyers = Array.isArray(tdJson?.buyers) ? tdJson.buyers : Array.isArray(tdJson) ? tdJson : []

      const buyers = tdBuyers.map((b: any) => ({
        td_buyer_id: String(b.id),
        user_buyer_id: b.user_buyer_id || '',
        name: b.name || b.company_name || 'Unknown',
        email: b.email || '',
        number: b.number || '',
        paused: b.paused === true,
        lastCallAt: b.last_call_at || null,
      })).sort((a: any, b: any) => a.name.localeCompare(b.name))

      return NextResponse.json({ buyers })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('Billing API error:', error)
    return NextResponse.json({ error: 'Failed to load billing data' }, { status: 500 })
  }
}
