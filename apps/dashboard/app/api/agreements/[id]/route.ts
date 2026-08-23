export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await prisma.lead_purchase_agreement.delete({ where: { id: params?.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Agreement delete error:', error)
    return NextResponse.json({ error: 'Failed to delete agreement' }, { status: 500 })
  }
}
