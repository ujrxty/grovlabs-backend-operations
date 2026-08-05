export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { enrichReviews } from '@/lib/non-conversion-enrich'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const review = await prisma.non_conversion_review.findUnique({
      where: { id: params.id },
    })
    if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const [enriched] = await enrichReviews([review])
    return NextResponse.json({
      review: {
        ...enriched,
        created_at: enriched.created_at?.toISOString?.() ?? String(enriched.created_at),
      },
    })
  } catch (error: any) {
    console.error('Non-conversion detail error:', error)
    return NextResponse.json({ error: 'Failed to load review' }, { status: 500 })
  }
}
