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

    // Find agreement in local DB
    const agreement = await prisma.lead_purchase_agreement.findUnique({
      where: { sign_token: token?.trim?.() },
      include: {
        insertion_order: { select: { io_number: true, id: true } },
        vendor: { select: { id: true, email: true, company_name: true, contact_name: true } },
      },
    })

    if (!agreement) {
      return NextResponse.json({ success: false, error: 'Agreement not found' }, { status: 404 })
    }

    if (agreement?.status !== 'pending_vendor') {
      return NextResponse.json({ success: false, error: 'This agreement has already been signed or is not available for signing' }, { status: 400 })
    }

    // Update agreement in local DB
    await prisma.lead_purchase_agreement.update({
      where: { id: agreement?.id ?? '' },
      data: {
        vendor_signed_at: new Date(),
        vendor_sign_name: sign_name?.trim?.() ?? '',
        vendor_sign_ip: ip,
        status: 'pending_counter',
      },
    })

    // Submit signature to backend
    try {
      const backendRes = await fetch(`${BACKEND_URL}/onboarding/agreement/${token?.trim?.()}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign_name: sign_name?.trim?.() ?? '' }),
      })
      const backendData = await backendRes.json()
      console.log('Backend agreement sign response:', JSON.stringify(backendData))
    } catch (backendErr: any) {
      console.error('Backend agreement sign error:', backendErr?.message ?? backendErr)
    }

    // Get display company name
    let displayCompanyName = agreement?.vendor?.company_name ?? ''
    const latestApp = await prisma.vendor_application.findFirst({
      where: { vendor_id: agreement?.vendor?.id ?? agreement?.vendor_id ?? '' },
      orderBy: { created_at: 'desc' },
      select: { company_name: true },
    })
    if (latestApp?.company_name) {
      displayCompanyName = latestApp.company_name
    }

    // Call webhook to notify backend (triggers Telegram countersign button for agreement)
    try {
      await fetch(`${BACKEND_URL}/onboarding/webhook/agreement-signed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreement_id: agreement?.id ?? '' }),
      })
      console.log('Agreement-signed webhook called successfully')
    } catch (webhookErr: any) {
      console.error('Backend webhook error (agreement-signed):', webhookErr?.message ?? webhookErr)
    }

    // Send confirmation email to vendor
    const vendorContent = `
      <p style="color: #374151;">Your Lead Purchase Agreement has been successfully signed.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 6px 0; color: #374151;"><strong>IO Number:</strong> ${agreement?.insertion_order?.io_number ?? ''}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Vendor:</strong> ${displayCompanyName}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Signed By:</strong> ${sign_name?.trim?.() ?? ''}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Signed At:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' })}</p>
      </div>
      <p style="color: #374151;">An admin will countersign the agreement shortly. You will receive a confirmation once the agreement is fully executed.</p>
    `
    await sendNotificationEmail({
      notificationId: process.env.NOTIF_ID_IO_SIGNED_BY_VENDOR ?? '',
      subject: `Lead Purchase Agreement Signed: ${agreement?.insertion_order?.io_number ?? ''} - The Broken Wood Inc`,
      body: emailTemplate('Lead Purchase Agreement Signed', vendorContent),
      recipientEmail: agreement?.vendor?.email ?? '',
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Sign agreement error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to sign agreement' }, { status: 500 })
  }
}
