export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendNotificationEmail, emailTemplate } from '@/lib/email'

/**
 * POST /api/onboarding/webhook/application-approved
 * Called by the backend QA agent when an application (or all apps for a vendor) is approved.
 * Body: { vendor_id: string }
 * 
 * This sends the vendor an approval email with the IO signing link.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vendor_id } = body ?? {}

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

    // Find approved applications for this vendor
    const approvedApps = await prisma.vendor_application.findMany({
      where: { vendor_id: vendor_id.trim(), status: 'approved' },
      include: { campaign: { select: { name: true, payout: true, payout_display: true, payout_type: true } } },
    })

    // Find the IO for this vendor
    const io = await prisma.insertion_order.findFirst({
      where: { vendor_id: vendor_id.trim() },
      orderBy: { created_at: 'desc' },
    })

    const appUrl = process.env.NEXTAUTH_URL ?? ''

    // Build campaign rows with RTB logic
    const campaignRows = (approvedApps ?? []).map((a: any) => {
      const name = a?.campaign?.name ?? ''
      const isRTB = name.toLowerCase().includes('rtb')
      const payoutStr = isRTB ? 'Variable' : (a?.campaign?.payout_display ?? `$${a?.campaign?.payout?.toString() ?? '0'}`)
      return `<p style="margin: 4px 0; color: #374151;">• ${name} — ${payoutStr}</p>`
    }).join('')

    // Find any application with a status_token to include status link
    const anyApp = approvedApps[0] ?? await prisma.vendor_application.findFirst({
      where: { vendor_id: vendor_id.trim() },
    })
    const statusToken = anyApp?.status_token ?? ''

    let ioSection = ''
    if (io?.sign_token) {
      ioSection = `
        <div style="background: #ecfdf5; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #a7f3d0;">
          <p style="color: #065f46; font-weight: 600; margin: 0 0 8px 0;">📝 Insertion Order Ready</p>
          <p style="color: #374151; margin: 0 0 12px 0;">Please review and sign your Insertion Order to finalize your vendor agreement.</p>
          <a href="${appUrl}/sign-io/${io.sign_token}" style="display: inline-block; background: #16a34a; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Sign Insertion Order →</a>
        </div>
      `
    }

    const content = `
      <p style="color: #374151;">Great news! Your application has been <strong style="color: #16a34a;">approved</strong> for the following campaign(s):</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 6px 0; color: #374151;"><strong>Company:</strong> ${displayCompanyName}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Payment Terms:</strong> Bi-Weekly Net 15</p>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 4px 0; color: #374151; font-weight: 600;">Campaigns:</p>
          ${campaignRows}
        </div>
      </div>
      ${ioSection}
      ${statusToken ? `<p style="color: #6b7280; font-size: 13px;">You can also check your status anytime at: <a href="${appUrl}/status?token=${statusToken}" style="color: #7c3aed;">${appUrl}/status</a></p>` : ''}
    `

    await sendNotificationEmail({
      notificationId: process.env.NOTIF_ID_APPLICATION_STATUS_CHANGED ?? '',
      subject: `Application Approved - GrovLabs Inc`,
      body: emailTemplate('Application Approved! 🎉', content),
      recipientEmail: vendor?.email ?? '',
    })

    console.log(`[webhook] application-approved: sent approval email to ${vendor?.email}`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Application approved webhook error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
