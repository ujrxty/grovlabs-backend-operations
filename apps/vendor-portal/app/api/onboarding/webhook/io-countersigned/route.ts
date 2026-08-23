export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendNotificationEmail, emailTemplate } from '@/lib/email'

/**
 * POST /api/onboarding/webhook/io-countersigned
 * Called by the backend QA agent after the admin countersigns the IO.
 * Body: { io_id: string }
 * 
 * This updates the local IO status to 'active' and sends the vendor a welcome email.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { io_id } = body ?? {}

    if (!io_id?.trim?.()) {
      return NextResponse.json({ success: false, error: 'io_id is required' }, { status: 400 })
    }

    // Find the IO
    const io = await prisma.insertion_order.findUnique({
      where: { id: io_id.trim() },
      include: {
        vendor: { select: { id: true, company_name: true, email: true, contact_name: true } },
        campaign: { select: { id: true, name: true, payout: true, payout_display: true, payout_type: true } },
      },
    })

    if (!io) {
      return NextResponse.json({ success: false, error: 'IO not found' }, { status: 404 })
    }

    // Update IO to active status
    await prisma.insertion_order.update({
      where: { id: io_id.trim() },
      data: {
        status: 'active',
        counter_signed_at: new Date(),
        counter_sign_by: 'UJ, CEO - GrovLabs Inc',
      },
    })

    // Get the actual vendor name from the latest application
    let displayCompanyName = io?.vendor?.company_name ?? ''
    const latestApp = await prisma.vendor_application.findFirst({
      where: { vendor_id: io?.vendor?.id ?? io?.vendor_id ?? '' },
      orderBy: { created_at: 'desc' },
      select: { company_name: true, contact_name: true },
    })
    if (latestApp?.company_name) {
      displayCompanyName = latestApp.company_name
    }
    const displayContactName = latestApp?.contact_name ?? io?.vendor?.contact_name ?? ''

    // Get all campaign details
    let campaignDetails: any[] = []
    if (io?.campaign_ids) {
      try {
        const campaignIdArr = JSON.parse(io.campaign_ids)
        if (Array.isArray(campaignIdArr) && campaignIdArr.length > 0) {
          campaignDetails = await prisma.campaign.findMany({
            where: { id: { in: campaignIdArr } },
            select: { name: true, payout: true, payout_display: true, payout_type: true },
          })
        }
      } catch {}
    }
    if (campaignDetails.length === 0 && io?.campaign) {
      campaignDetails = [io.campaign]
    }

    // Build campaign rows
    const campaignRows = campaignDetails.map((c: any) => {
      const isRTB = (c?.name ?? '').toLowerCase().includes('rtb')
      const payoutStr = isRTB ? 'Variable' : (c?.payout_display ?? `$${c?.payout?.toString() ?? '0'}`)
      return `<p style="margin: 4px 0; color: #065f46;">\u2022 ${c?.name ?? ''} — ${payoutStr}</p>`
    }).join('')

    // Send welcome email to vendor
    const content = `
      <p style="color: #374151;">Welcome to GrovLabs vendor network, ${displayContactName || displayCompanyName}! 🎉</p>
      <p style="color: #374151;">Your Insertion Order has been <strong style="color: #16a34a;">fully executed</strong>. You are now an active vendor partner.</p>

      <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 16px 0; border: 1px solid #a7f3d0;">
        <p style="margin: 6px 0; color: #065f46;"><strong>IO Number:</strong> ${io?.io_number ?? ''}</p>
        <p style="margin: 6px 0; color: #065f46;"><strong>Vendor:</strong> ${displayCompanyName}</p>
        <p style="margin: 6px 0; color: #065f46;"><strong>Payment Terms:</strong> Bi-Weekly Net 15</p>
        <p style="margin: 6px 0; color: #065f46;"><strong>Status:</strong> ✅ Active</p>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #a7f3d0;">
          <p style="margin: 0 0 4px 0; color: #065f46; font-weight: 600;">Campaigns:</p>
          ${campaignRows}
        </div>
      </div>

      <h3 style="color: #1f2937; margin: 24px 0 12px 0;">What's Next?</h3>
      <p style="color: #374151;">Please add us on the platforms below so we can get your campaigns set up and provide you with DIDs and posting specs:</p>

      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 16px 0; border: 1px solid #bae6fd;">
        <p style="margin: 0 0 12px 0; color: #0c4a6e; font-weight: 700; font-size: 15px;">📞 Contact Information</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #374151; vertical-align: top; width: 40%;"><strong>UJ</strong></td>
            <td style="padding: 6px 0; color: #374151;">CEO / Campaign Manager</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Email:</td>
            <td style="padding: 4px 0; color: #374151; font-weight: 600;">uj@grovlabs.com</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">WhatsApp:</td>
            <td style="padding: 4px 0; color: #374151; font-weight: 600;">+1 (754) 344-0773</td>
          </tr>
        </table>
      </div>

      <p style="color: #374151; margin-top: 16px;">We look forward to a successful partnership!</p>
    `

    await sendNotificationEmail({
      notificationId: process.env.NOTIF_ID_IO_FULLY_EXECUTED ?? '',
      subject: `Welcome to GrovLabs! IO ${io?.io_number ?? ''} Fully Executed`,
      body: emailTemplate('Welcome to GrovLabs! 🎉', content),
      recipientEmail: io?.vendor?.email ?? '',
    })

    console.log(`[webhook] io-countersigned: updated IO ${io?.io_number} to active, sent welcome email to ${io?.vendor?.email}`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('IO countersigned webhook error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
