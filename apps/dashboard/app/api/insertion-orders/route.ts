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
    const status = url.searchParams.get('status') ?? ''
    const search = url.searchParams.get('search') ?? ''
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = parseInt(url.searchParams.get('limit') ?? '20')

    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { io_number: { contains: search, mode: 'insensitive' as any } },
        { vendor: { company_name: { contains: search, mode: 'insensitive' as any } } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.insertion_order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          vendor: { select: { company_name: true, contact_name: true } },
          campaign: { select: { name: true, industry: true } },
          lead_purchase_agreements: {
            select: { id: true, status: true, vendor_signed_at: true, counter_signed_at: true, created_at: true },
            orderBy: { created_at: 'desc' as const },
            take: 1,
          },
        },
      }),
      prisma.insertion_order.count({ where }),
    ])

    const serialized = (orders ?? []).map((o: any) => ({
      ...o,
      payout: o?.payout?.toString?.() ?? '0',
    }))

    return NextResponse.json({ orders: serialized, total, pages: Math.ceil(total / limit) })
  } catch (error: any) {
    console.error('IO error:', error)
    return NextResponse.json({ error: 'Failed to load insertion orders' }, { status: 500 })
  }
}
