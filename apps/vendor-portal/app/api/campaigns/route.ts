export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    })
    const serialized = (campaigns ?? []).map((c: any) => ({
      ...(c ?? {}),
      payout: c?.payout?.toString?.() ?? '0',
    }))
    return NextResponse.json({ success: true, campaigns: serialized })
  } catch (error: any) {
    console.error('Campaigns API error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}
