export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { CAMPAIGN_CATEGORIES, todayPhoenix } from '@/lib/sales-qa'

interface VendorAggRow {
  campaign_category: string | null
  vendor_name: string | null
  vendor_td_id: string | null
  total: number
  quotes_issued: number
  sale_completed: number
  quote_accepted_deferred: number
  quote_pending_approval: number
  quote_received_reviewing: number
  quote_declined: number
  no_quote_issued: number
  ft_high: number
  ft_medium: number
  ft_low: number
  ft_none: number
  revenue: number
  avg_duration: number
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const from = url.searchParams.get('from') || todayPhoenix()
    const to = url.searchParams.get('to') || todayPhoenix()
    const category = url.searchParams.get('category') || ''
    const buyer = url.searchParams.get('buyer') || ''

    const categoryClause = category
      ? Prisma.sql`AND campaign_category = ${category}`
      : Prisma.empty
    const buyerClause = buyer
      ? Prisma.sql`AND buyer_name = ${buyer}`
      : Prisma.empty

    const rows = await prisma.$queryRaw<VendorAggRow[]>(Prisma.sql`
      SELECT
        campaign_category,
        vendor_name,
        vendor_td_id,
        count(*)::int AS total,
        count(*) FILTER (WHERE quote_issued)::int AS quotes_issued,
        count(*) FILTER (WHERE outcome_category = 'sale_completed')::int AS sale_completed,
        count(*) FILTER (WHERE outcome_category = 'quote_accepted_deferred')::int AS quote_accepted_deferred,
        count(*) FILTER (WHERE outcome_category = 'quote_pending_approval')::int AS quote_pending_approval,
        count(*) FILTER (WHERE outcome_category = 'quote_received_reviewing')::int AS quote_received_reviewing,
        count(*) FILTER (WHERE outcome_category = 'quote_declined')::int AS quote_declined,
        count(*) FILTER (WHERE outcome_category = 'no_quote_issued')::int AS no_quote_issued,
        count(*) FILTER (WHERE follow_through_likelihood = 'high')::int AS ft_high,
        count(*) FILTER (WHERE follow_through_likelihood = 'medium')::int AS ft_medium,
        count(*) FILTER (WHERE follow_through_likelihood = 'low')::int AS ft_low,
        count(*) FILTER (WHERE follow_through_likelihood = 'none')::int AS ft_none,
        COALESCE(sum(revenue), 0)::float AS revenue,
        COALESCE(avg(duration), 0)::float AS avg_duration
      FROM sales_qa_review
      WHERE review_date >= ${from} AND review_date <= ${to}
        AND quote_issued = true AND quote_amount IS NOT NULL
      ${categoryClause}
      ${buyerClause}
      GROUP BY campaign_category, vendor_name, vendor_td_id
    `)

    // Distinct buyers across the whole table (stable dropdown, order by name).
    const buyerRows = await prisma.$queryRaw<{ buyer_name: string | null }[]>(Prisma.sql`
      SELECT DISTINCT buyer_name FROM sales_qa_review
      WHERE buyer_name IS NOT NULL AND buyer_name <> ''
      ORDER BY buyer_name
    `)
    const buyers = buyerRows.map((b) => b.buyer_name).filter((b): b is string => !!b)

    // Which categories to render as sections. If a specific category was
    // requested, show only that; otherwise show the three known ones.
    const cats = category ? [category] : [...CAMPAIGN_CATEGORIES]

    const buildOutcomes = (r: VendorAggRow) => ({
      sale_completed: r.sale_completed,
      quote_accepted_deferred: r.quote_accepted_deferred,
      quote_pending_approval: r.quote_pending_approval,
      quote_received_reviewing: r.quote_received_reviewing,
      quote_declined: r.quote_declined,
      no_quote_issued: r.no_quote_issued,
    })
    const buildFollowThrough = (r: VendorAggRow) => ({
      high: r.ft_high, medium: r.ft_medium, low: r.ft_low, none: r.ft_none,
    })

    const campaigns = cats.map((cat) => {
      const vendorRows = rows.filter((r) => (r.campaign_category ?? '') === cat)
      const vendors = vendorRows.map((r) => ({
        vendor_name: r.vendor_name || 'Unknown vendor',
        vendor_td_id: r.vendor_td_id,
        total: r.total,
        quotesIssued: r.quotes_issued,
        quoteRate: r.total > 0 ? r.quotes_issued / r.total : 0,
        outcomes: buildOutcomes(r),
        followThrough: buildFollowThrough(r),
        revenue: r.revenue,
        avgDuration: r.avg_duration,
      }))
      vendors.sort((a, b) => b.total - a.total || a.vendor_name.localeCompare(b.vendor_name))

      const agg = vendorRows.reduce(
        (acc, r) => {
          acc.total += r.total
          acc.quotesIssued += r.quotes_issued
          acc.revenue += r.revenue
          for (const k of Object.keys(acc.outcomes)) (acc.outcomes as any)[k] += (buildOutcomes(r) as any)[k]
          for (const k of Object.keys(acc.followThrough)) (acc.followThrough as any)[k] += (buildFollowThrough(r) as any)[k]
          return acc
        },
        {
          total: 0, quotesIssued: 0, revenue: 0,
          outcomes: { sale_completed: 0, quote_accepted_deferred: 0, quote_pending_approval: 0, quote_received_reviewing: 0, quote_declined: 0, no_quote_issued: 0 },
          followThrough: { high: 0, medium: 0, low: 0, none: 0 },
        },
      )

      return {
        category: cat,
        total: agg.total,
        quotesIssued: agg.quotesIssued,
        quoteRate: agg.total > 0 ? agg.quotesIssued / agg.total : 0,
        outcomes: agg.outcomes,
        followThrough: agg.followThrough,
        revenue: agg.revenue,
        vendors,
      }
    })

    // Overall summary across the rendered categories.
    const summary = campaigns.reduce(
      (acc, c) => {
        acc.total += c.total
        acc.quotesIssued += c.quotesIssued
        acc.revenue += c.revenue
        acc.sales += c.outcomes.sale_completed
        acc.highFollowThrough += c.followThrough.high
        acc.accepted += c.outcomes.quote_accepted_deferred
        acc.declined += c.outcomes.quote_declined
        acc.reviewing += c.outcomes.quote_received_reviewing
        acc.pending += c.outcomes.quote_pending_approval
        return acc
      },
      { total: 0, quotesIssued: 0, revenue: 0, sales: 0, highFollowThrough: 0, accepted: 0, declined: 0, reviewing: 0, pending: 0 },
    )

    // Headline funnel for the whole selected period: how quoted callers responded
    // to the price. Buckets are mutually exclusive and (with undecided) sum to total.
    const headline = {
      total_quotes_given: summary.total,
      sale_completed: summary.sales,
      buyer_intent: summary.accepted,
      quote_declined: summary.declined,
      undecided_reviewing: summary.reviewing + summary.pending,
    }

    return NextResponse.json({
      from, to, category: category || 'all', buyer: buyer || 'all', buyers,
      headline,
      summary: {
        total: summary.total,
        quotesIssued: summary.quotesIssued,
        quoteRate: summary.total > 0 ? summary.quotesIssued / summary.total : 0,
        sales: summary.sales,
        highFollowThrough: summary.highFollowThrough,
        revenue: summary.revenue,
      },
      campaigns,
    })
  } catch (error: any) {
    console.error('Sales QA summary error:', error)
    return NextResponse.json({ error: 'Failed to load sales monitoring data' }, { status: 500 })
  }
}
