export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendNotificationEmail, emailTemplate } from '@/lib/email'

/**
 * POST /api/onboarding/webhook/application-rejected
 * Called by the backend QA agent when an application is rejected.
 * Body: { vendor_id: string, reason?: string }
 * 
 * This sends the vendor a rejection email with the reason.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vendor_id, reason } = body ?? {}

    if (!vendor_id?.trim?.()) {
      return NextResponse.json({ success: false, error: 'vendor_id is required' }, { status: 400 })
    }

    // Find the vendor
    const vendor = await prisma.vendor_profile.findUnique({
      where: { id: vendor_id.trim() },
    })
    if (!vendor) {
      return NextResponse.json({ success: false, error: 'Vendor not found' }, { status: 404 })
    }

    // Get the actual vendor name from the latest application
    let displayCompanyName = vendor?.company_name ?? ''
    const latestApp = await prisma.vendor_application.findFirst({
      where: { vendor_id: vendor_id.trim() },
      orderBy: { created_at: 'desc' },
      select: { company_name: true },
    })
    if (latestApp?.company_name) {
      displayCompanyName = latestApp.company_name
    }

    // Find rejected applications
    const rejectedApps = await prisma.vendor_application.findMany({
      where: { vendor_id: vendor_id.trim(), status: 'rejected' },
      include: { campaign: { select: { name: true } } },
    })

    const campaignNames = (rejectedApps ?? []).map((a: any) => a?.campaign?.name ?? '').filter(Boolean).join(', ')

    const reasonSection = reason?.trim?.() ? `
      <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fecaca;">
        <p style="color: #991b1b; font-weight: 600; margin: 0 0 8px 0;">Reason</p>
        <p style="color: #374151; margin: 0;">${reason.trim()}</p>
      </div>
    ` : ''

    const content = `
      <p style="color: #374151;">We appreciate your interest in partnering with GrovLabs Inc. After careful review, we were unable to approve your application at this time.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 6px 0; color: #374151;"><strong>Campaign(s):</strong> ${campaignNames || 'N/A'}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Company:</strong> ${displayCompanyName}</p>
      </div>
      ${reasonSection}
      <p style="color: #374151;">If you believe this was made in error or have additional information to share, please don't hesitate to reach out to us.</p>
    `

    await sendNotificationEmail({
      notificationId: process.env.NOTIF_ID_APPLICATION_STATUS_CHANGED ?? '',
      subject: `Application Update - GrovLabs Inc`,
      body: emailTemplate('Application Update', content),
      recipientEmail: vendor?.email ?? '',
    })

    console.log(`[webhook] application-rejected: sent rejection email to ${vendor?.email}`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Application rejected webhook error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
