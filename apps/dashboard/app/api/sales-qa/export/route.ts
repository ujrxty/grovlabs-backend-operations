export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { categoryLabel, outcomeLabel, todayPhoenix, SALES_QA_TZ } from '@/lib/sales-qa'

interface ExportRow {
  review_date: string
  trackdrive_call_id: string
  caller_number: string | null
  campaign_category: string | null
  buyer_name: string | null
  campaign_name: string | null
  caller_state: string | null
  duration: number
  quote_issued: boolean
  quote_amount: string | null
  outcome_category: string
  revenue: number | null
}

function csvCell(value: any): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// Brief, buyer-facing CSV: a summary block (total billable calls, calls quoted,
// sales) followed by one compact row per call. Covers ALL billable calls in the
// range (not just quoted ones) so the total / quoted / sales counts are distinct.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const from = url.searchParams.get('from') || todayPhoenix()
    const to = url.searchParams.get('to') || todayPhoenix()
    const category = url.searchParams.get('category') || ''
    const buyer = url.searchParams.get('buyer') || ''

    const categoryClause = category ? Prisma.sql`AND campaign_category = ${category}` : Prisma.empty
    const buyerClause = buyer ? Prisma.sql`AND buyer_name = ${buyer}` : Prisma.empty

    const rows = await prisma.$queryRaw<ExportRow[]>(Prisma.sql`
      SELECT
        review_date, trackdrive_call_id, caller_number, campaign_category, buyer_name,
        campaign_name, caller_state, duration, quote_issued, quote_amount,
        outcome_category, revenue
      FROM sales_qa_review
      WHERE review_date >= ${from} AND review_date <= ${to}
      ${categoryClause}
      ${buyerClause}
      ORDER BY review_date ASC, created_at ASC
    `)

    const total = rows.length
    const quoted = rows.filter((r) => r.quote_issued && r.quote_amount).length
    const sales = rows.filter((r) => r.outcome_category === 'sale_completed').length
    const revenue = rows.reduce((acc, r) => acc + (r.revenue ?? 0), 0)

    const generated = new Intl.DateTimeFormat('en-US', {
      timeZone: SALES_QA_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date())

    const lines: string[] = []
    // Summary block
    lines.push(['Sales Monitor Export'].map(csvCell).join(','))
    lines.push(['Date range', `${from} to ${to}`].map(csvCell).join(','))
    lines.push(['Campaign', category ? categoryLabel(category) : 'All campaigns'].map(csvCell).join(','))
    lines.push(['Buyer', buyer || 'All buyers'].map(csvCell).join(','))
    lines.push(['Generated (ET)', generated].map(csvCell).join(','))
    lines.push('')
    lines.push(['Total billable calls', total].map(csvCell).join(','))
    lines.push(['Calls that received a quote', quoted].map(csvCell).join(','))
    lines.push(['Sales completed', sales].map(csvCell).join(','))
    lines.push(['Total revenue (USD)', revenue.toFixed(2)].map(csvCell).join(','))
    lines.push('')

    // Detail rows
    const headers = [
      'Caller ID', 'Date', 'Campaign', 'Buyer', 'State', 'Duration (s)',
      'Outcome', 'Received Quote', 'Quote Amount', 'Revenue (USD)',
    ]
    lines.push(headers.map(csvCell).join(','))
    for (const r of rows) {
      lines.push([
        r.caller_number,
        r.review_date,
        categoryLabel(r.campaign_category),
        r.buyer_name,
        r.caller_state,
        r.duration,
        outcomeLabel(r.outcome_category),
        r.quote_issued && r.quote_amount ? 'Yes' : 'No',
        r.quote_amount,
        typeof r.revenue === 'number' ? r.revenue.toFixed(2) : '',
      ].map(csvCell).join(','))
    }

    const csv = lines.join('\r\n')
    const buyerSlug = buyer ? '-' + buyer.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() : ''
    const filename = `sales-monitor${buyerSlug}-${from}_to_${to}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Sales QA export error:', error)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}
