export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTDCallsCount, getTDOffers, getTDTrafficSources, getTDRevenueForPeriod } from '@/lib/trackdrive'
import { zonedToUtc, nowParts } from '@/lib/business-time'

// Day-based presets are anchored to the business timezone (US Eastern) rather
// than UTC, so "Today" reflects the Eastern calendar day. The returned bounds
// are absolute UTC instants, so TrackDrive queries (formatted as UTC) stay correct.
function getDateRange(preset: string, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const now = new Date()
  const { year, month, day, dow } = nowParts(now) // month is 1-based here
  const m0 = month - 1 // 0-based month for arithmetic

  const startDay = (y: number, mo0: number, d: number) => zonedToUtc(y, mo0 + 1, d, 0, 0, 0, 0)
  const endDay = (y: number, mo0: number, d: number) => zonedToUtc(y, mo0 + 1, d, 23, 59, 59, 999)

  switch (preset) {
    case 'last_30m':
      return { from: new Date(now.getTime() - 30 * 60 * 1000), to: now }
    case 'last_6h':
      return { from: new Date(now.getTime() - 6 * 60 * 60 * 1000), to: now }
    case 'last_12h':
      return { from: new Date(now.getTime() - 12 * 60 * 60 * 1000), to: now }
    case 'today':
      return { from: startDay(year, m0, day), to: now }
    case 'yesterday':
      return { from: startDay(year, m0, day - 1), to: endDay(year, m0, day - 1) }
    case 'this_week':
      return { from: startDay(year, m0, day - dow), to: now }
    case 'last_week':
      return { from: startDay(year, m0, day - dow - 7), to: endDay(year, m0, day - dow - 1) }
    case 'this_month':
      return { from: startDay(year, m0, 1), to: now }
    case 'last_month':
      return { from: startDay(year, m0 - 1, 1), to: endDay(year, m0, 0) }
    case 'this_quarter': {
      const q = Math.floor(m0 / 3)
      return { from: startDay(year, q * 3, 1), to: now }
    }
    case 'last_6_months':
      return { from: startDay(year, m0 - 6, day), to: now }
    case 'this_year':
      return { from: startDay(year, 0, 1), to: now }
    case 'last_year':
      return { from: startDay(year - 1, 0, 1), to: endDay(year - 1, 11, 31) }
    case 'custom': {
      if (customFrom && customTo) {
        const [fy, fm, fd] = customFrom.split('-').map(Number)
        const [ty, tm, td] = customTo.split('-').map(Number)
        return { from: zonedToUtc(fy, fm, fd, 0, 0, 0, 0), to: zonedToUtc(ty, tm, td, 23, 59, 59, 999) }
      }
      return { from: startDay(year, m0, day), to: now }
    }
    default:
      return { from: startDay(year, m0, day), to: now }
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('range') || 'today'
    const customFrom = searchParams.get('from') || undefined
    const customTo = searchParams.get('to') || undefined

    const { from, to } = getDateRange(preset, customFrom, customTo)
    const dateFilter = { gte: from, lte: to }

    // Fetch TrackDrive data and local DB data in parallel
    const [
      tdCalls,
      tdOffers,
      tdSources,
      tdRevenue,
      flaggedCalls,
      analyzedCalls,
      pendingApps,
      recentFlags,
    ] = await Promise.all([
      getTDCallsCount(from, to).catch((e) => {
        console.error('TD calls error:', e)
        return { total: 0, converted: 0 }
      }),
      getTDOffers().catch((e) => {
        console.error('TD offers error:', e)
        return { active: 0, paused: 0, total: 0, offers: [] }
      }),
      getTDTrafficSources().catch((e) => {
        console.error('TD sources error:', e)
        return { active: 0, paused: 0, total: 0 }
      }),
      getTDRevenueForPeriod(from, to).catch((e) => {
        console.error('TD revenue error:', e)
        return { revenue: 0, payout: 0, conversions: 0, byBuyer: [], byOffer: [] }
      }),
      // Local DB data for QA metrics
      prisma.qa_analysis.count({ where: { is_flagged: true, analyzed_at: dateFilter } }),
      prisma.qa_analysis.count({ where: { analyzed_at: dateFilter } }),
      prisma.vendor_application.count({ where: { status: 'pending' } }),
      prisma.flag.findMany({
        where: { created_at: dateFilter },
        take: 10,
        orderBy: { created_at: 'desc' },
        include: {
          call: { select: { trackdrive_call_id: true, campaign_name: true, duration: true, caller_number: true } },
        },
      }),
    ])

    return NextResponse.json({
      // TrackDrive date-filtered data
      totalCalls: tdCalls.total,
      conversions: tdCalls.converted,
      activeOffers: tdOffers.active,
      pausedOffers: tdOffers.paused,
      totalOffers: tdOffers.total,
      activeVendors: tdSources.active,
      pausedVendors: tdSources.paused,
      totalVendors: tdSources.total,
      // Revenue for selected date range (summed from actual converted call records)
      revenue: tdRevenue.revenue,
      payout: tdRevenue.payout,
      revenueConversions: tdRevenue.conversions,
      revenueByBuyer: tdRevenue.byBuyer,
      revenueByOffer: tdRevenue.byOffer,
      // Local DB QA data
      flaggedCalls,
      analyzedCalls,
      pendingApps,
      rangeLabel: preset,
      rangeFrom: from.toISOString(),
      rangeTo: to.toISOString(),
      recentFlags: recentFlags?.map((f: any) => ({
        id: f?.id,
        flag_type: f?.flag_type,
        severity: f?.severity,
        details: f?.details,
        created_at: f?.created_at,
        call_id: f?.call?.trackdrive_call_id ?? 'N/A',
        campaign: f?.call?.campaign_name ?? 'N/A',
        duration: f?.call?.duration ?? 0,
      })) ?? [],
    })
  } catch (error: any) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
