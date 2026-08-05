export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Parse a YYYY-MM-DD (or ISO) date string to a UTC-anchored Date
function parseDate(v: string): Date {
  return new Date(v.length <= 10 ? v + 'T00:00:00Z' : v)
}

// GET /api/vendors/[id]/payments
//   ?periodStart=&periodEnd=  -> returns the single record for that period (or null)
//   (no params)               -> returns recent payment history for the vendor
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const periodStart = searchParams.get('periodStart')
    const periodEnd = searchParams.get('periodEnd')

    if (periodStart && periodEnd) {
      const ps = parseDate(periodStart)
      const pe = parseDate(periodEnd)

      // The exact record for this report's period (may be paid or unpaid or null)
      const record = await prisma.vendor_payment_record.findUnique({
        where: {
          vendor_id_period_start_period_end: { vendor_id: params.id, period_start: ps, period_end: pe },
        },
      })

      // Ledger: any PAID records whose period falls fully inside [ps, pe] but is NOT the exact same range.
      // These are sub-period payments already made, so their amounts must be subtracted from this report
      // to avoid double-paying the vendor.
      const contained = await prisma.vendor_payment_record.findMany({
        where: {
          vendor_id: params.id,
          status: 'paid',
          period_start: { gte: ps },
          period_end: { lte: pe },
          NOT: { AND: [{ period_start: ps }, { period_end: pe }] },
        },
        orderBy: { period_start: 'asc' },
      })
      const alreadyPaid = contained.reduce((sum, r) => sum + Number(r.amount), 0)

      return NextResponse.json({ record, alreadyPaid, paidPeriods: contained })
    }

    const history = await prisma.vendor_payment_record.findMany({
      where: { vendor_id: params.id },
      orderBy: { period_start: 'desc' },
      take: 24,
    })
    return NextResponse.json({ history })
  } catch (error: any) {
    console.error('Get payments error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load payments' }, { status: 500 })
  }
}

// POST /api/vendors/[id]/payments — upsert a payment record for a billing period
// body: { periodStart, periodEnd, amount, status ('paid'|'unpaid'), paidMethod?, paidReference?, notes? }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { periodStart, periodEnd } = body
    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'periodStart and periodEnd are required' }, { status: 400 })
    }

    const vendor = await prisma.vendor_profile.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const ps = parseDate(periodStart)
    const pe = parseDate(periodEnd)

    const status = body.status === 'paid' ? 'paid' : 'unpaid'

    // `fullAmount` is the report's total payout for this period. We store only the NET-NEW amount being
    // settled now (full total minus any sub-period payments already made inside this range), so the ledger
    // never double-counts. `amount` is accepted as a fallback for backward compatibility.
    const fullAmount =
      typeof body.fullAmount === 'number'
        ? body.fullAmount
        : parseFloat(body.fullAmount ?? '') || (typeof body.amount === 'number' ? body.amount : parseFloat(body.amount || '0') || 0)

    // Recompute already-paid sub-periods on the server for safety
    let netAmount = fullAmount
    if (status === 'paid') {
      const contained = await prisma.vendor_payment_record.findMany({
        where: {
          vendor_id: params.id,
          status: 'paid',
          period_start: { gte: ps },
          period_end: { lte: pe },
          NOT: { AND: [{ period_start: ps }, { period_end: pe }] },
        },
        select: { amount: true },
      })
      const alreadyPaid = contained.reduce((sum, r) => sum + Number(r.amount), 0)
      netAmount = Math.max(0, fullAmount - alreadyPaid)
    }
    const amount = netAmount
    const paidMethod = body.paidMethod ? String(body.paidMethod).trim() : null
    const paidReference = body.paidReference ? String(body.paidReference).trim() : null
    const notes = body.notes ? String(body.notes).trim() : null
    // When marking paid, stamp paid_at (respect an explicit paidAt if supplied); clear it when unpaid
    const paidAt = status === 'paid' ? (body.paidAt ? parseDate(body.paidAt) : new Date()) : null

    const record = await prisma.vendor_payment_record.upsert({
      where: {
        vendor_id_period_start_period_end: { vendor_id: params.id, period_start: ps, period_end: pe },
      },
      update: {
        amount,
        status,
        paid_at: paidAt,
        paid_method: paidMethod,
        paid_reference: paidReference,
        notes,
      },
      create: {
        vendor_id: params.id,
        period_start: ps,
        period_end: pe,
        amount,
        status,
        paid_at: paidAt,
        paid_method: paidMethod,
        paid_reference: paidReference,
        notes,
      },
    })

    return NextResponse.json({ record })
  } catch (error: any) {
    console.error('Upsert payment error:', error)
    return NextResponse.json({ error: error.message || 'Failed to save payment' }, { status: 500 })
  }
}
