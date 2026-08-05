export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { todayPhoenix, daysAgoPhoenix } from '@/lib/sales-qa'

interface GroupRow {
  campaign_category: string
  review_month: string
  total_quotes_given: number
  sale_completed: number
  buyer_intent: number
  quote_declined: number
  undecided_reviewing: number
  revenue: number
}

// Captures a daily point-in-time snapshot of the sales funnel, grouped by
// campaign + calendar month, for the trailing ~92 days. Because the external QA
// service re-reviews and overwrites past calls (no history kept), this builds an
// audit trail so re-classifications become visible over time.
// Auth: a valid dashboard session OR the shared scheduler key.
async function handle(req: Request): Promise<NextResponse> {
  const url = new URL(req.url)
  const key = req.headers.get('x-snapshot-key') || url.searchParams.get('key')
  let authed = false
  if (key && process.env.SNAPSHOT_CAPTURE_KEY && key === process.env.SNAPSHOT_CAPTURE_KEY) authed = true
  if (!authed) {
    const session = await getServerSession(authOptions)
    if (session) authed = true
  }
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const today = todayPhoenix()
    const cutoff = daysAgoPhoenix(92)

    // Same quote-only scope and bucket mapping as the Sales Monitor headline.
    const groups = await prisma.$queryRaw<GroupRow[]>(Prisma.sql`
      SELECT
        campaign_category,
        substring(review_date, 1, 7) AS review_month,
        count(*)::int AS total_quotes_given,
        count(*) FILTER (WHERE outcome_category = 'sale_completed')::int AS sale_completed,
        count(*) FILTER (WHERE outcome_category = 'quote_accepted_deferred')::int AS buyer_intent,
        count(*) FILTER (WHERE outcome_category = 'quote_declined')::int AS quote_declined,
        count(*) FILTER (WHERE outcome_category IN ('quote_received_reviewing', 'quote_pending_approval'))::int AS undecided_reviewing,
        COALESCE(sum(revenue), 0)::float AS revenue
      FROM sales_qa_review
      WHERE review_date >= ${cutoff} AND review_date <= ${today}
        AND quote_issued = true AND quote_amount IS NOT NULL
        AND campaign_category IS NOT NULL AND campaign_category <> ''
      GROUP BY campaign_category, substring(review_date, 1, 7)
    `)

    let written = 0
    for (const g of groups) {
      await prisma.sales_qa_snapshot.upsert({
        where: {
          snapshot_date_review_month_campaign_category: {
            snapshot_date: today,
            review_month: g.review_month,
            campaign_category: g.campaign_category,
          },
        },
        create: {
          snapshot_date: today,
          review_month: g.review_month,
          campaign_category: g.campaign_category,
          total_quotes_given: g.total_quotes_given,
          sale_completed: g.sale_completed,
          buyer_intent: g.buyer_intent,
          quote_declined: g.quote_declined,
          undecided_reviewing: g.undecided_reviewing,
          revenue: g.revenue,
        },
        update: {
          total_quotes_given: g.total_quotes_given,
          sale_completed: g.sale_completed,
          buyer_intent: g.buyer_intent,
          quote_declined: g.quote_declined,
          undecided_reviewing: g.undecided_reviewing,
          revenue: g.revenue,
        },
      })
      written++
    }

    return NextResponse.json({ ok: true, snapshot_date: today, groups: written })
  } catch (error: any) {
    console.error('Sales QA snapshot capture error:', error)
    return NextResponse.json({ error: 'Failed to capture snapshot' }, { status: 500 })
  }
}

export async function POST(req: Request) { return handle(req) }
export async function GET(req: Request) { return handle(req) }
