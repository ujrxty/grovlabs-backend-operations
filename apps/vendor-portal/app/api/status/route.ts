export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl?.searchParams?.get?.('token')?.trim?.()
    if (!token) {
      return NextResponse.json({ success: false, error: 'Status token is required' }, { status: 400 })
    }

    // Find the application by status_token
    const app = await prisma.vendor_application.findUnique({
      where: { status_token: token },
      include: {
        campaign: { select: { name: true, industry: true } },
      },
    })

    if (!app) {
      return NextResponse.json({ success: false, error: 'Application not found. Please check your status token.' }, { status: 404 })
    }

    // If there's a group_token, find all related applications
    let applications: any[] = []
    if (app?.group_token) {
      const grouped = await prisma.vendor_application.findMany({
        where: { group_token: app.group_token },
        include: {
          campaign: { select: { name: true, industry: true } },
        },
        orderBy: { created_at: 'asc' },
      })
      applications = grouped ?? []
    } else {
      applications = [app]
    }

    // Look up IO by vendor_id (ONE IO per vendor, covers all campaigns)
    let ioInfo: { sign_token: string; status: string; campaign_ids: string | null; io_number: string } | null = null
    const vendorId = applications[0]?.vendor_id
    if (vendorId) {
      const io = await prisma.insertion_order.findFirst({
        where: { vendor_id: vendorId },
        select: { sign_token: true, status: true, campaign_ids: true, io_number: true },
        orderBy: { created_at: 'desc' },
      })
      if (io) {
        ioInfo = {
          sign_token: io.sign_token,
          status: io.status,
          campaign_ids: io.campaign_ids ?? null,
          io_number: io.io_number,
        }
      }
    }

    const result = (applications ?? []).map((a: any) => ({
      id: a?.id ?? '',
      company_name: a?.company_name ?? '',
      contact_name: a?.contact_name ?? '',
      email: a?.email ?? '',
      status: a?.status ?? 'pending',
      status_reason: a?.status_reason ?? null,
      campaign_name: a?.campaign?.name ?? '',
      campaign_industry: a?.campaign?.industry ?? '',
      created_at: a?.created_at?.toISOString?.() ?? '',
      reviewed_at: a?.reviewed_at?.toISOString?.() ?? null,
      group_token: a?.group_token ?? null,
    }))

    // Look up Lead Purchase Agreement by vendor_id
    let agreementInfo: { sign_token: string; status: string; io_number: string } | null = null
    if (vendorId) {
      const agreement = await prisma.lead_purchase_agreement.findFirst({
        where: { vendor_id: vendorId },
        include: { insertion_order: { select: { io_number: true } } },
        orderBy: { created_at: 'desc' },
      })
      if (agreement) {
        agreementInfo = {
          sign_token: agreement.sign_token,
          status: agreement.status,
          io_number: agreement.insertion_order?.io_number ?? '',
        }
      }
    }

    return NextResponse.json({
      success: true,
      applications: result,
      io: ioInfo ? {
        sign_token: ioInfo.sign_token,
        status: ioInfo.status,
        io_number: ioInfo.io_number,
        campaign_ids: ioInfo.campaign_ids,
      } : null,
      agreement: agreementInfo,
    })
  } catch (error: any) {
    console.error('Status API error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to fetch status' }, { status: 500 })
  }
}