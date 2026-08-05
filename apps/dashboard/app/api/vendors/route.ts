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
    const search = url.searchParams.get('search') ?? ''
    const status = url.searchParams.get('status') ?? ''
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = parseInt(url.searchParams.get('limit') ?? '20')

    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { company_name: { contains: search, mode: 'insensitive' as any } },
        { contact_name: { contains: search, mode: 'insensitive' as any } },
        { email: { contains: search, mode: 'insensitive' as any } },
      ]
    }

    const [vendors, total] = await Promise.all([
      prisma.vendor_profile.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.vendor_profile.count({ where }),
    ])

    return NextResponse.json({ vendors: vendors ?? [], total, pages: Math.ceil(total / limit) })
  } catch (error: any) {
    console.error('Vendors error:', error)
    return NextResponse.json({ error: 'Failed to load vendors' }, { status: 500 })
  }
}
