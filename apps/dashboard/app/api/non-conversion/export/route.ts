export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildNonConversionWhere } from '@/lib/non-conversion-query'
import { enrichReviews } from '@/lib/non-conversion-enrich'
import { outcomeLabel, faultSideLabel } from '@/lib/non-conversion'

function csvCell(value: any): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const where = buildNonConversionWhere(url.searchParams)

    const rawRows = await prisma.non_conversion_review.findMany({
      where,
      orderBy: [{ duration: 'asc' }, { created_at: 'desc' }],
      take: 10000,
    })
    const rows = await enrichReviews(rawRows)

    const headers = [
      'Review Date',
      'Caller ID',
      'City',
      'State',
      'Number Called',
      'Vendor',
      'Buyer',
      'Campaign',
      'Duration (s)',
      'Call Status',
      'Fault Side',
      'Outcome Reason',
      'What Happened',
      'Fix Suggestion',
      'Recording URL',
    ]

    const lines = [headers.map(csvCell).join(',')]
    for (const r of rows) {
      lines.push([
        r.review_date,
        r.caller_number,
        r.caller_city,
        r.caller_state,
        r.number_called,
        r.vendor_name,
        r.buyer_name,
        r.campaign_name,
        r.duration,
        r.call_status,
        faultSideLabel(r.fault_side),
        outcomeLabel(r.outcome_reason),
        r.what_happened,
        r.fix_suggestion,
        r.recording_url,
      ].map(csvCell).join(','))
    }

    const csv = lines.join('\r\n')
    const dateLabel = url.searchParams.get('date') || url.searchParams.get('date_from') || 'export'

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="non-conversion-qa-${dateLabel}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('Non-conversion export error:', error)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}
