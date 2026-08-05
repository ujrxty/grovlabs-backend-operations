export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildNonConversionWhere } from '@/lib/non-conversion-query'
import { enrichReviews } from '@/lib/non-conversion-enrich'
import { nextQaRun, isQaActiveNow, QA_START_HOUR, QA_END_HOUR, QA_TZ_LABEL } from '@/lib/non-conversion-schedule'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const where = buildNonConversionWhere(url.searchParams)
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = parseInt(url.searchParams.get('limit') ?? '25')

    const [reviews, total, byFault, byBuyerReason, byVendorReason, buyersRaw, vendorsRaw, campaignsRaw, lastWrite] =
      await Promise.all([
        prisma.non_conversion_review.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ duration: 'asc' }, { created_at: 'desc' }],
        }),
        prisma.non_conversion_review.count({ where }),
        prisma.non_conversion_review.groupBy({
          by: ['fault_side'],
          where,
          _count: { _all: true },
        }),
        prisma.non_conversion_review.groupBy({
          by: ['buyer_name', 'outcome_reason'],
          where,
          _count: { _all: true },
        }),
        prisma.non_conversion_review.groupBy({
          by: ['vendor_name', 'outcome_reason'],
          where,
          _count: { _all: true },
        }),
        // Facet options are scoped to the selected date range only (ignore other filters)
        prisma.non_conversion_review.findMany({
          where: dateOnly(url.searchParams),
          distinct: ['buyer_name'],
          select: { buyer_name: true },
        }),
        prisma.non_conversion_review.findMany({
          where: dateOnly(url.searchParams),
          distinct: ['vendor_name'],
          select: { vendor_name: true },
        }),
        prisma.non_conversion_review.findMany({
          where: dateOnly(url.searchParams),
          distinct: ['campaign_name'],
          select: { campaign_name: true },
        }),
        // Global last-written timestamp = when the QA bot last added data.
        prisma.non_conversion_review.aggregate({ _max: { created_at: true } }),
      ])

    // Summary counts by fault side
    const summary = { total, buyer: 0, vendor: 0, external: 0, neutral: 0 }
    for (const row of byFault) {
      const side = row.fault_side as 'buyer' | 'vendor' | 'external' | 'neutral'
      const count = row._count?._all ?? 0
      if (side in summary) (summary as any)[side] = count
    }

    const byBuyer = groupBreakdown(byBuyerReason, 'buyer_name')
    const byVendor = groupBreakdown(byVendorReason, 'vendor_name')

    const facets = {
      buyers: buyersRaw.map((r) => r.buyer_name).filter(Boolean).sort(),
      vendors: vendorsRaw.map((r) => r.vendor_name).filter(Boolean).sort(),
      campaigns: campaignsRaw.map((r) => r.campaign_name).filter(Boolean).sort(),
    }

    const enriched = await enrichReviews(reviews)

    const lastDataAt = lastWrite?._max?.created_at ?? null
    const schedule = {
      lastDataAt: lastDataAt ? lastDataAt.toISOString() : null,
      nextRunAt: nextQaRun().toISOString(),
      activeNow: isQaActiveNow(),
      startHour: QA_START_HOUR,
      endHour: QA_END_HOUR,
      tzLabel: QA_TZ_LABEL,
    }

    return NextResponse.json({
      reviews: enriched.map(serialize),
      total,
      pages: Math.ceil(total / limit) || 1,
      summary,
      byBuyer,
      byVendor,
      facets,
      schedule,
    })
  } catch (error: any) {
    console.error('Non-conversion list error:', error)
    return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 })
  }
}

function dateOnly(params: URLSearchParams): any {
  const p = new URLSearchParams()
  const date = params.get('date')
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')
  if (date) p.set('date', date)
  if (dateFrom) p.set('date_from', dateFrom)
  if (dateTo) p.set('date_to', dateTo)
  return buildNonConversionWhere(p)
}

function groupBreakdown(rows: any[], key: string) {
  const map = new Map<string, { name: string; total: number; reasons: { reason: string; count: number }[] }>()
  for (const row of rows) {
    const name = row[key] ?? 'Unknown'
    const count = row._count?._all ?? 0
    if (!map.has(name)) map.set(name, { name, total: 0, reasons: [] })
    const entry = map.get(name)!
    entry.total += count
    entry.reasons.push({ reason: row.outcome_reason, count })
  }
  const result = Array.from(map.values())
  result.forEach((e) => e.reasons.sort((a, b) => b.count - a.count))
  result.sort((a, b) => b.total - a.total)
  return result
}

function serialize(r: any) {
  return {
    ...r,
    created_at: r.created_at?.toISOString?.() ?? String(r.created_at),
  }
}
