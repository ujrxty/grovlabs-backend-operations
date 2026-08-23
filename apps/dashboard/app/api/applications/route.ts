export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const applications = await prisma.vendor_application.findMany({
      include: { campaign: true },
      orderBy: { created_at: 'desc' },
    })
    return NextResponse.json(applications)
  } catch (error: any) {
    console.error('Applications list error:', error)
    return NextResponse.json({ error: 'Failed to load applications' }, { status: 500 })
  }
}
