import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    })
    const serialized = campaigns.map((c) => ({
      ...c,
      payout: c.payout?.toString() ?? '0',
    }))
    return NextResponse.json({ campaigns: serialized })
  } catch (error: any) {
    console.error('Failed to fetch campaigns:', error?.message)
    return NextResponse.json({ campaigns: [] })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const campaign = await prisma.campaign.create({
      data: {
        name: body.name?.trim(),
        industry: body.industry?.trim() || 'General',
        call_type: body.call_type || 'Inbound',
        description: body.description?.trim() || null,
        payout: parseFloat(body.payout) || 0,
        payout_display: body.payout_display?.trim() || null,
        payout_type: body.payout_type || 'per_call',
        billing_cycle: body.billing_cycle || 'weekly',
        min_duration: parseInt(body.min_duration) || null,
        geographic_focus: body.geographic_focus?.trim() || null,
        allowed_traffic: body.allowed_traffic?.trim() || null,
        restricted_traffic: body.restricted_traffic?.trim() || null,
        requirements: body.requirements?.trim() || null,
        compliance_notes: body.compliance_notes?.trim() || null,
        is_active: body.is_active ?? true,
        sort_order: parseInt(body.sort_order) || 0,
      },
    })
    return NextResponse.json({ success: true, campaign })
  } catch (error: any) {
    console.error('Failed to create campaign:', error?.message)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })

    const campaign = await prisma.campaign.update({
      where: { id: body.id },
      data: {
        name: body.name?.trim(),
        industry: body.industry?.trim() || 'General',
        call_type: body.call_type || 'Inbound',
        description: body.description?.trim() || null,
        payout: parseFloat(body.payout) || 0,
        payout_display: body.payout_display?.trim() || null,
        payout_type: body.payout_type || 'per_call',
        billing_cycle: body.billing_cycle || 'weekly',
        min_duration: parseInt(body.min_duration) || null,
        geographic_focus: body.geographic_focus?.trim() || null,
        allowed_traffic: body.allowed_traffic?.trim() || null,
        restricted_traffic: body.restricted_traffic?.trim() || null,
        requirements: body.requirements?.trim() || null,
        compliance_notes: body.compliance_notes?.trim() || null,
        is_active: body.is_active ?? true,
        sort_order: parseInt(body.sort_order) || 0,
      },
    })
    return NextResponse.json({ success: true, campaign })
  } catch (error: any) {
    console.error('Failed to update campaign:', error?.message)
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })

    await prisma.campaign.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete campaign:', error?.message)
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }
}
