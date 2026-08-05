export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/vendors/add-campaign-options
// Returns vendors that already have a Lead Purchase Agreement on file (eligible to have
// campaigns added without re-signing an LPA), the campaigns each already has an IO for,
// and the list of active campaigns available to add.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [vendorRows, campaigns] = await Promise.all([
      prisma.vendor_profile.findMany({
        where: { lead_purchase_agreements: { some: {} } },
        select: {
          id: true,
          company_name: true,
          contact_name: true,
          email: true,
          status: true,
          lead_purchase_agreements: { select: { status: true } },
          insertion_orders: {
            select: { campaign_id: true, campaign_ids: true, status: true },
          },
        },
        orderBy: { company_name: 'asc' },
      }),
      prisma.campaign.findMany({
        where: { is_active: true },
        select: {
          id: true,
          name: true,
          industry: true,
          payout: true,
          payout_type: true,
          payout_display: true,
        },
        orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      }),
    ])

    const vendors = (vendorRows ?? []).map((v) => {
      // Collect campaign ids the vendor already has an IO for (exclude terminated/voided).
      const existing = new Set<string>()
      for (const io of v.insertion_orders ?? []) {
        if (io.status === 'terminated' || io.status === 'voided') continue
        if (io.campaign_id) existing.add(io.campaign_id)
        if (io.campaign_ids) {
          for (const cid of io.campaign_ids.split(',').map((s) => s.trim()).filter(Boolean)) {
            existing.add(cid)
          }
        }
      }
      const hasActiveLpa = (v.lead_purchase_agreements ?? []).some((l) => l.status === 'active')
      return {
        id: v.id,
        company_name: v.company_name,
        contact_name: v.contact_name,
        email: v.email,
        status: v.status,
        hasActiveLpa,
        lpaCount: (v.lead_purchase_agreements ?? []).length,
        existingCampaignIds: Array.from(existing),
      }
    })

    const campaignList = (campaigns ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      industry: c.industry,
      payout: c.payout != null ? Number(c.payout) : null,
      payout_type: c.payout_type,
      payout_display: c.payout_display,
    }))

    return NextResponse.json({ vendors, campaigns: campaignList })
  } catch (error: any) {
    console.error('Add-campaign options error:', error)
    return NextResponse.json({ error: 'Failed to load options' }, { status: 500 })
  }
}
