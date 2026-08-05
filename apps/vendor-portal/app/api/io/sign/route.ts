export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendNotificationEmail, emailTemplate } from '@/lib/email'

const BACKEND_URL = 'https://bsbwqa.abacusai.app'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, sign_name } = body ?? {}

    if (!token?.trim?.()) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 })
    }
    if (!sign_name?.trim?.()) {
      return NextResponse.json({ success: false, error: 'Full name is required' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')?.[0]?.trim?.() ?? request.headers.get('x-real-ip') ?? 'unknown'

    // Find IO
    const io = await prisma.insertion_order.findUnique({
      where: { sign_token: token?.trim?.() },
      include: {
        vendor: { select: { company_name: true, email: true, contact_name: true, id: true } },
        campaign: { select: { id: true, name: true, payout: true, payout_display: true, payout_type: true } },
      },
    })

    if (!io) {
      return NextResponse.json({ success: false, error: 'IO not found' }, { status: 404 })
    }

    if (io?.status !== 'pending_vendor') {
      return NextResponse.json({ success: false, error: 'This IO has already been signed or is not available for signing' }, { status: 400 })
    }

    // Update IO in local DB
    await prisma.insertion_order.update({
      where: { id: io?.id ?? '' },
      data: {
        vendor_signed_at: new Date(),
        vendor_sign_name: sign_name?.trim?.() ?? '',
        vendor_sign_ip: ip,
        status: 'pending_counter',
      },
    })

    // Also submit signature to backend service
    let agreementSignUrl = ''
    let agreementSignToken = ''
    try {
      const backendRes = await fetch(`${BACKEND_URL}/onboarding/io/${token?.trim?.()}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign_name: sign_name?.trim?.() ?? '', agree: true }),
      })
      const backendData = await backendRes.json()
      console.log('Backend IO sign response:', JSON.stringify(backendData))
      agreementSignUrl = backendData?.agreement_sign_url ?? ''
      agreementSignToken = backendData?.agreement_sign_token ?? ''
    } catch (backendErr: any) {
      console.error('Backend sign error:', backendErr?.message ?? backendErr)
    }

    // Get the actual vendor name from the latest application
    let displayCompanyName = io?.vendor?.company_name ?? ''
    const latestApp = await prisma.vendor_application.findFirst({
      where: { vendor_id: io?.vendor?.id ?? io?.vendor_id ?? '' },
      orderBy: { created_at: 'desc' },
      select: { company_name: true },
    })
    if (latestApp?.company_name) {
      displayCompanyName = latestApp.company_name
    }

    // Get all campaigns
    let campaignDetails: any[] = []
    if (io?.campaign_ids) {
      try {
        const ids = JSON.parse(io.campaign_ids)
        if (Array.isArray(ids) && ids.length > 0) {
          campaignDetails = await prisma.campaign.findMany({
            where: { id: { in: ids } },
            select: { name: true, payout: true, payout_display: true, payout_type: true },
          })
        }
      } catch {}
    }
    if (campaignDetails.length === 0 && io?.campaign) {
      campaignDetails = [io.campaign]
    }

    // Build campaign rows for email
    const campaignRows = campaignDetails.map((c: any) => {
      const isRTB = (c?.name ?? '').toLowerCase().includes('rtb')
      const payoutStr = isRTB ? 'Variable' : (c?.payout_display ?? `$${c?.payout?.toString() ?? '0'}`)
      return `<p style="margin: 4px 0; color: #374151;">\u2022 ${c?.name ?? ''} — ${payoutStr}</p>`
    }).join('')

    const vendorContent = `
      <p style="color: #374151;">Your Insertion Order has been successfully signed.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 6px 0; color: #374151;"><strong>IO Number:</strong> ${io?.io_number ?? ''}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Vendor:</strong> ${displayCompanyName}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Signed By:</strong> ${sign_name?.trim?.() ?? ''}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Signed At:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' })}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Payment Terms:</strong> Bi-Weekly Net 15</p>
      </div>
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 8px 0; color: #374151; font-weight: 600;">Campaigns:</p>
        ${campaignRows}
      </div>
      <p style="color: #374151;">An Admin will be in touch shortly to provide DIDs and Posting specs.</p>
    `
    await sendNotificationEmail({
      notificationId: process.env.NOTIF_ID_IO_SIGNED_BY_VENDOR ?? '',
      subject: `IO Signed: ${io?.io_number ?? ''} - The Broken Wood Inc`,
      body: emailTemplate('Insertion Order Signed', vendorContent),
      recipientEmail: io?.vendor?.email ?? '',
    })

    // Notify backend QA agent (triggers Telegram countersign button)
    try {
      await fetch(`${BACKEND_URL}/onboarding/webhook/io-signed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ io_id: io?.id ?? '' }),
      })
    } catch (webhookErr: any) {
      console.error('Backend webhook error (io-signed):', webhookErr?.message ?? webhookErr)
    }

    // Build agreement URL - prefer the portal's own agreement page
    const appUrl = process.env.NEXTAUTH_URL ?? ''
    const portalAgreementUrl = agreementSignToken ? `${appUrl}/agreement/sign/${agreementSignToken}` : ''

    return NextResponse.json({
      success: true,
      agreement_sign_url: portalAgreementUrl || agreementSignUrl,
      agreement_sign_token: agreementSignToken,
    })
  } catch (error: any) {
    console.error('Sign IO error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to sign IO' }, { status: 500 })
  }
}