export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const vendor = await prisma.vendor_profile.findUnique({
      where: { id: params?.id },
      include: {
        applications: { include: { campaign: true }, orderBy: { created_at: 'desc' } },
        insertion_orders: {
          include: {
            campaign: true,
            lead_purchase_agreements: {
              select: { id: true, status: true, vendor_signed_at: true, vendor_sign_name: true, counter_signed_at: true, counter_sign_by: true, created_at: true },
              orderBy: { created_at: 'desc' as const },
              take: 1,
            },
          },
          orderBy: { created_at: 'desc' },
        },
      },
    })
    if (!vendor) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(vendor)
  } catch (error: any) {
    console.error('Vendor detail error:', error)
    return NextResponse.json({ error: 'Failed to load vendor' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { company_name, contact_name, email, phone, website, status } = body ?? {}

    const data: any = {}
    if (company_name !== undefined) data.company_name = company_name
    if (contact_name !== undefined) data.contact_name = contact_name
    if (email !== undefined) data.email = email
    if (phone !== undefined) data.phone = phone
    if (website !== undefined) data.website = website
    if (status !== undefined) data.status = status

    const vendor = await prisma.vendor_profile.update({
      where: { id: params?.id },
      data,
    })
    return NextResponse.json(vendor)
  } catch (error: any) {
    console.error('Vendor update error:', error)
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Delete related records first
    await prisma.lead_purchase_agreement.deleteMany({ where: { insertion_order: { vendor_id: params?.id } } })
    await prisma.insertion_order.deleteMany({ where: { vendor_id: params?.id } })
    await prisma.vendor_application.deleteMany({ where: { vendor_id: params?.id } })
    await prisma.vendor_profile.delete({ where: { id: params?.id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Vendor delete error:', error)
    return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 })
  }
}
