export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/billing/buyer-contacts?buyerId=  OR  ?buyerIds=a,b,c
// Returns saved billing contacts for one or more buyers
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const raw = searchParams.get('buyerIds') || searchParams.get('buyerId') || ''
    const buyerIds = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (buyerIds.length === 0) return NextResponse.json({ contacts: [] })

    const contacts = await prisma.buyer_billing_contact.findMany({
      where: { td_buyer_id: { in: buyerIds } },
      orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    })
    return NextResponse.json({ contacts })
  } catch (error: any) {
    console.error('List buyer contacts error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load contacts' }, { status: 500 })
  }
}

// POST /api/billing/buyer-contacts — add (or update) a buyer billing contact
// body: { buyerId: string, email: string, label?: string, is_default?: boolean }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const buyerId = String(body.buyerId || '').trim()
    const email = String(body.email || '').trim()
    const label = body.label ? String(body.label).trim() : null
    const isDefault = body.is_default === undefined ? true : Boolean(body.is_default)

    if (!buyerId) return NextResponse.json({ error: 'buyerId is required' }, { status: 400 })
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }

    const contact = await prisma.buyer_billing_contact.upsert({
      where: { td_buyer_id_email: { td_buyer_id: buyerId, email } },
      update: { label, is_default: isDefault },
      create: { td_buyer_id: buyerId, email, label, is_default: isDefault },
    })
    return NextResponse.json({ contact })
  } catch (error: any) {
    console.error('Add buyer contact error:', error)
    return NextResponse.json({ error: error.message || 'Failed to save contact' }, { status: 500 })
  }
}

// DELETE /api/billing/buyer-contacts?contactId=...
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const contactId = searchParams.get('contactId')
    if (!contactId) return NextResponse.json({ error: 'contactId is required' }, { status: 400 })

    await prisma.buyer_billing_contact.deleteMany({ where: { id: contactId } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete buyer contact error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete contact' }, { status: 500 })
  }
}
