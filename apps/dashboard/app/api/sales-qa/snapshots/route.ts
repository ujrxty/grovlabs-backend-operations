export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// History for the audit-trail popup. Returns the stored daily snapshots
// (bounded), plus the distinct months and campaigns available for filtering.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const category = url.searchParams.get('category') || ''
    const month = url.searchParams.get('month') || ''

    const rows = await prisma.sales_qa_snapshot.findMany({
      where: {
        ...(category ? { campaign_category: category } : {}),
        ...(month ? { review_month: month } : {}),
      },
      orderBy: [
        { review_month: 'desc' },
        { campaign_category: 'asc' },
        { snapshot_date: 'desc' },
      ],
      take: 3000,
    })

    // Full filter option lists (independent of the current filter).
    const all = await prisma.sales_qa_snapshot.findMany({
      select: { review_month: true, campaign_category: true },
      distinct: ['review_month', 'campaign_category'],
    })
    const months = Array.from(new Set(all.map((r) => r.review_month))).sort().reverse()
    const campaigns = Array.from(new Set(all.map((r) => r.campaign_category))).sort()

    return NextResponse.json({ rows, months, campaigns })
  } catch (error: any) {
    console.error('Sales QA snapshots error:', error)
    return NextResponse.json({ error: 'Failed to load snapshot history' }, { status: 500 })
  }
}
