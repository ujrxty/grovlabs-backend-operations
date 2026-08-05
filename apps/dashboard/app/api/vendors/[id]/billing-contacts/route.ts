export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/vendors/[id]/billing-contacts — list saved billing contacts for a vendor
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const contacts = await prisma.vendor_billing_contact.findMany({
      where: { vendor_id: params.id },
      orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    })
    return NextResponse.json({ contacts })
  } catch (error: any) {
    console.error('List billing contacts error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load contacts' }, { status: 500 })
  }
}

// POST /api/vendors/[id]/billing-contacts — add (or update) a billing contact
// body: { email: string, label?: string, is_default?: boolean }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const email = String(body.email || '').trim()
    const label = body.label ? String(body.label).trim() : null
    const isDefault = body.is_default === undefined ? true : Boolean(body.is_default)

    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }

    // Ensure the vendor exists
    const vendor = await prisma.vendor_profile.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const contact = await prisma.vendor_billing_contact.upsert({
      where: { vendor_id_email: { vendor_id: params.id, email } },
      update: { label, is_default: isDefault },
      create: { vendor_id: params.id, email, label, is_default: isDefault },
    })

    return NextResponse.json({ contact })
  } catch (error: any) {
    console.error('Add billing contact error:', error)
    return NextResponse.json({ error: error.message || 'Failed to save contact' }, { status: 500 })
  }
}

// DELETE /api/vendors/[id]/billing-contacts?contactId=... — remove a billing contact
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const contactId = searchParams.get('contactId')
    if (!contactId) return NextResponse.json({ error: 'contactId is required' }, { status: 400 })

    // Scope delete to this vendor to avoid cross-vendor deletes
    await prisma.vendor_billing_contact.deleteMany({ where: { id: contactId, vendor_id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete billing contact error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete contact' }, { status: 500 })
  }
}
