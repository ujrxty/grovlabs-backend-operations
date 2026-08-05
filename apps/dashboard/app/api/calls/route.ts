export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const flagged = url.searchParams.get('flagged')
    const campaign = url.searchParams.get('campaign') ?? ''
    const affiliateId = url.searchParams.get('affiliate_id') ?? ''
    const dateFrom = url.searchParams.get('date_from') ?? ''
    const dateTo = url.searchParams.get('date_to') ?? ''
    const search = url.searchParams.get('search') ?? ''
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = parseInt(url.searchParams.get('limit') ?? '20')

    const where: any = {}
    if (flagged === 'true') {
      where.qa_analysis = { is_flagged: true }
    }
    if (campaign) where.campaign_name = campaign
    if (affiliateId) where.affiliate_id = affiliateId
    if (dateFrom || dateTo) {
      where.created_at = {}
      if (dateFrom) where.created_at.gte = new Date(dateFrom)
      if (dateTo) where.created_at.lte = new Date(dateTo + 'T23:59:59Z')
    }
    if (search) {
      where.OR = [
        { trackdrive_call_id: { contains: search, mode: 'insensitive' as any } },
        { caller_number: { contains: search, mode: 'insensitive' as any } },
      ]
    }

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          affiliate: { select: { name: true, trackdrive_id: true } },
          qa_analysis: true,
          transcript: true,
        },
      }),
      prisma.call.count({ where }),
    ])

    return NextResponse.json({ calls: calls ?? [], total, pages: Math.ceil(total / limit) })
  } catch (error: any) {
    console.error('Calls error:', error)
    return NextResponse.json({ error: 'Failed to load calls' }, { status: 500 })
  }
}
