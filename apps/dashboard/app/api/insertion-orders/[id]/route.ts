export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const order = await prisma.insertion_order.findUnique({
      where: { id: params?.id },
      include: {
        vendor: true,
        campaign: true,
        lead_purchase_agreements: {
          select: { id: true, status: true, vendor_signed_at: true, vendor_sign_name: true, counter_signed_at: true, counter_sign_by: true, created_at: true },
          orderBy: { created_at: 'desc' as const },
        },
      },
    })
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      ...order,
      payout: order?.payout?.toString?.() ?? '0',
    })
  } catch (error: any) {
    console.error('IO detail error:', error)
    return NextResponse.json({ error: 'Failed to load IO' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Delete related LPAs first
    await prisma.lead_purchase_agreement.deleteMany({ where: { io_id: params?.id } })
    // Delete the IO
    await prisma.insertion_order.delete({ where: { id: params?.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('IO delete error:', error)
    return NextResponse.json({ error: 'Failed to delete IO' }, { status: 500 })
  }
}
