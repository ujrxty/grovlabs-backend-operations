export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyCode } from '@/lib/verification-store'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, code } = body ?? {}

    if (!token?.trim?.() || !code?.trim?.()) {
      return NextResponse.json({ success: false, error: 'Token and code are required' }, { status: 400 })
    }

    const result = verifyCode(token?.trim?.(), code?.trim?.())
    if (!result?.valid) {
      return NextResponse.json({ success: false, error: result?.error ?? 'Invalid code' }, { status: 400 })
    }

    // Fetch IO data with vendor
    const io = await prisma.insertion_order.findUnique({
      where: { sign_token: token?.trim?.() },
      include: {
        vendor: { select: { company_name: true } },
        campaign: { select: { id: true, name: true, payout: true, payout_display: true, payout_type: true, min_duration: true } },
      },
    })

    if (!io) {
      return NextResponse.json({ success: false, error: 'IO not found' }, { status: 404 })
    }

    // Get the actual vendor name from the latest application (more accurate than profile)
    let displayCompanyName = io?.vendor?.company_name ?? ''
    const latestApp = await prisma.vendor_application.findFirst({
      where: { vendor_id: io?.vendor_id ?? '' },
      orderBy: { created_at: 'desc' },
      select: { company_name: true },
    })
    if (latestApp?.company_name) {
      displayCompanyName = latestApp.company_name
    }

    // Get all campaigns from campaign_ids
    let campaigns: any[] = []
    if (io?.campaign_ids) {
      try {
        const ids = JSON.parse(io.campaign_ids)
        if (Array.isArray(ids) && ids.length > 0) {
          campaigns = await prisma.campaign.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, payout: true, payout_display: true, payout_type: true, min_duration: true },
          })
        }
      } catch {}
    }
    // Fallback to single campaign
    if (campaigns.length === 0 && io?.campaign) {
      campaigns = [io.campaign]
    }

    // Format campaigns for display
    const formattedCampaigns = campaigns.map((c: any) => {
      const isRTB = (c?.name ?? '').toLowerCase().includes('rtb')
      return {
        name: c?.name ?? '',
        payout: isRTB ? 'Variable' : (c?.payout_display ?? `$${c?.payout?.toString() ?? '0'}`),
        payout_type: c?.payout_type ?? '',
        min_duration: c?.min_duration ?? null,
      }
    })

    return NextResponse.json({
      success: true,
      io: {
        io_number: io?.io_number ?? '',
        company_name: displayCompanyName,
        campaigns: formattedCampaigns,
        // Keep legacy single-campaign fields for backward compat
        campaign_name: formattedCampaigns.map((c: any) => c.name).join(', '),
        payout: io?.payout?.toString?.() ?? '0',
        payout_type: io?.payout_type ?? '',
        billing_cycle: 'Bi-Weekly Net 15',
        min_duration: io?.min_duration ?? null,
        terms: io?.terms ?? '',
        special_terms: io?.special_terms ?? null,
        status: io?.status ?? '',
      },
    })
  } catch (error: any) {
    console.error('Verify code error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to verify code' }, { status: 500 })
  }
}