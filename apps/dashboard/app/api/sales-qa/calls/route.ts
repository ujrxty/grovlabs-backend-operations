export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { todayPhoenix } from '@/lib/sales-qa'

interface CallRow {
  trackdrive_call_id: string
  review_date: string
  vendor_name: string
  buyer_name: string | null
  campaign_name: string | null
  caller_city: string | null
  caller_state: string | null
  duration: number
  revenue: number | null
  quote_issued: boolean
  outcome_category: string
  follow_through_likelihood: string
  quote_type: string | null
  quote_amount: string | null
  payment_mentioned: boolean
  caller_response: string | null
  what_happened: string
  key_quote: string | null
  recording_url: string | null
  created_at: Date
}

// Per-call drill-down for a given campaign category + vendor within a date
// range. Loaded lazily when a leaderboard row is expanded.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const from = url.searchParams.get('from') || todayPhoenix()
    const to = url.searchParams.get('to') || todayPhoenix()
    const category = url.searchParams.get('category') || ''
    const vendor = url.searchParams.get('vendor') || ''
    const buyer = url.searchParams.get('buyer') || ''
    const buyerClause = buyer ? Prisma.sql`AND buyer_name = ${buyer}` : Prisma.empty

    if (!category || !vendor) {
      return NextResponse.json({ error: 'category and vendor are required' }, { status: 400 })
    }

    const rows = await prisma.$queryRaw<CallRow[]>(Prisma.sql`
      SELECT
        trackdrive_call_id, review_date, vendor_name, buyer_name, campaign_name,
        caller_city, caller_state, duration, revenue, quote_issued, outcome_category,
        follow_through_likelihood, quote_type, quote_amount, payment_mentioned,
        caller_response, what_happened, key_quote, recording_url, created_at
      FROM sales_qa_review
      WHERE review_date >= ${from} AND review_date <= ${to}
        AND quote_issued = true AND quote_amount IS NOT NULL
        AND campaign_category = ${category}
        AND vendor_name = ${vendor}
      ${buyerClause}
      ORDER BY created_at DESC
      LIMIT 500
    `)

    const calls = rows.map((r) => ({
      trackdrive_call_id: r.trackdrive_call_id,
      review_date: r.review_date,
      vendor_name: r.vendor_name,
      buyer_name: r.buyer_name,
      campaign_name: r.campaign_name,
      caller_city: r.caller_city,
      caller_state: r.caller_state,
      duration: r.duration,
      revenue: r.revenue,
      quote_issued: r.quote_issued,
      outcome_category: r.outcome_category,
      follow_through_likelihood: r.follow_through_likelihood,
      quote_type: r.quote_type,
      quote_amount: r.quote_amount,
      payment_mentioned: r.payment_mentioned,
      caller_response: r.caller_response,
      what_happened: r.what_happened,
      key_quote: r.key_quote,
      recording_url: r.recording_url,
    }))

    return NextResponse.json({ calls })
  } catch (error: any) {
    console.error('Sales QA calls error:', error)
    return NextResponse.json({ error: 'Failed to load calls' }, { status: 500 })
  }
}
