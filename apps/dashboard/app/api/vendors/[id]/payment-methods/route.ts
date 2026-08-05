export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encryptJson, decryptJson } from '@/lib/crypto'

// Fields that may live inside the encrypted details blob (all optional strings).
const DETAIL_FIELDS = [
  'bank_name',
  'account_name',
  'account_type', // checking | savings
  'routing_number',
  'account_number',
  'swift_code',
  'bank_address',
  'paypal_email',
  'zelle_handle',
  'payee_name',
  'mailing_address',
  'other_details',
  'instructions',
] as const

type Details = Record<string, string>

function cleanDetails(input: any): Details {
  const out: Details = {}
  if (input && typeof input === 'object') {
    for (const key of DETAIL_FIELDS) {
      const v = input[key]
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        out[key] = String(v).trim()
      }
    }
  }
  return out
}

function last4(v?: string): string {
  if (!v) return ''
  const digits = v.replace(/\s+/g, '')
  return digits.slice(-4)
}

function maskEmail(email?: string): string {
  if (!email || !email.includes('@')) return email || ''
  const [user, domain] = email.split('@')
  const shown = user.slice(0, 2)
  return `${shown}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`
}

// Build a short, non-sensitive preview string stored in plaintext for list display.
function buildMask(methodType: string, d: Details): string {
  switch (methodType) {
    case 'wire':
    case 'ach': {
      const acct = last4(d.account_number)
      const bank = d.bank_name ? `${d.bank_name} ` : ''
      return acct ? `${bank}••••${acct}` : bank.trim() || (methodType === 'wire' ? 'Wire transfer' : 'ACH transfer')
    }
    case 'paypal':
      return maskEmail(d.paypal_email) || 'PayPal'
    case 'zelle': {
      const h = d.zelle_handle || ''
      if (h.includes('@')) return maskEmail(h)
      if (h) return `••••${last4(h)}`
      return 'Zelle'
    }
    case 'check':
      return d.payee_name ? `Check to ${d.payee_name}` : 'Paper check'
    default:
      return d.instructions ? d.instructions.slice(0, 24) : 'Other'
  }
}

function publicRow(row: any) {
  return {
    id: row.id,
    method_type: row.method_type,
    label: row.label,
    is_default: row.is_default,
    mask: row.mask,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// GET /api/vendors/[id]/payment-methods            -> masked list
// GET /api/vendors/[id]/payment-methods?reveal=ID  -> full decrypted details for one method
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const reveal = searchParams.get('reveal')

    if (reveal) {
      const row = await prisma.vendor_payment_method.findFirst({
        where: { id: reveal, vendor_id: params.id },
      })
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const details = decryptJson<Details>(row.details_encrypted) || {}
      return NextResponse.json({ ...publicRow(row), details })
    }

    const rows = await prisma.vendor_payment_method.findMany({
      where: { vendor_id: params.id },
      orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    })
    return NextResponse.json({ methods: rows.map(publicRow) })
  } catch (error: any) {
    console.error('List payment methods error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load payment methods' }, { status: 500 })
  }
}

// POST /api/vendors/[id]/payment-methods
// body: { id?, method_type, label?, is_default?, details: {...} }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const methodType = String(body.method_type || '').trim().toLowerCase()
    const validTypes = ['wire', 'ach', 'paypal', 'zelle', 'check', 'other']
    if (!validTypes.includes(methodType)) {
      return NextResponse.json({ error: 'Invalid payment method type' }, { status: 400 })
    }

    // Ensure the vendor exists (payment methods require a local vendor profile).
    const vendor = await prisma.vendor_profile.findUnique({ where: { id: params.id } })
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const label = body.label ? String(body.label).trim() : null
    const isDefault = Boolean(body.is_default)
    const details = cleanDetails(body.details)

    if (Object.keys(details).length === 0) {
      return NextResponse.json({ error: 'Please enter at least one payment detail' }, { status: 400 })
    }

    const mask = buildMask(methodType, details)
    const details_encrypted = encryptJson(details)

    let saved
    if (body.id) {
      saved = await prisma.vendor_payment_method.update({
        where: { id: String(body.id) },
        data: { method_type: methodType, label, is_default: isDefault, mask, details_encrypted },
      })
    } else {
      saved = await prisma.vendor_payment_method.create({
        data: { vendor_id: params.id, method_type: methodType, label, is_default: isDefault, mask, details_encrypted },
      })
    }

    // Only one default per vendor.
    if (isDefault) {
      await prisma.vendor_payment_method.updateMany({
        where: { vendor_id: params.id, id: { not: saved.id } },
        data: { is_default: false },
      })
    }

    return NextResponse.json({ method: publicRow(saved) })
  } catch (error: any) {
    console.error('Save payment method error:', error)
    return NextResponse.json({ error: error.message || 'Failed to save payment method' }, { status: 500 })
  }
}

// DELETE /api/vendors/[id]/payment-methods?methodId=ID
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const methodId = searchParams.get('methodId')
    if (!methodId) return NextResponse.json({ error: 'methodId is required' }, { status: 400 })

    await prisma.vendor_payment_method.deleteMany({
      where: { id: methodId, vendor_id: params.id },
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete payment method error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete payment method' }, { status: 500 })
  }
}
