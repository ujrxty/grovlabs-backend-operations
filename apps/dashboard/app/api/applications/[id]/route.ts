export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const application = await prisma.vendor_application.findUnique({
      where: { id: params?.id },
      include: { campaign: true },
    })
    if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(application)
  } catch (error: any) {
    console.error('Application detail error:', error)
    return NextResponse.json({ error: 'Failed to load application' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { status } = body ?? {}

    const application = await prisma.vendor_application.update({
      where: { id: params?.id },
      data: { status },
    })
    return NextResponse.json(application)
  } catch (error: any) {
    console.error('Application update error:', error)
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await prisma.vendor_application.delete({ where: { id: params?.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Application delete error:', error)
    return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 })
  }
}
