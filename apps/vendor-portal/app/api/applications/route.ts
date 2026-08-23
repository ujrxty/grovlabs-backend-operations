export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendNotificationEmail, emailTemplate } from '@/lib/email'
import crypto from 'crypto'

const BACKEND_URL = process.env.QA_AGENT_URL || 'http://localhost:3003'

function generateToken(): string {
  return crypto.randomBytes(8).toString('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      company_name,
      contact_name,
      email,
      phone,
      website,
      estimated_volume,
      experience,
      referred_by,
      comments,
      company_address,
      company_state,
      company_country,
      entity_type,
      tcpa_agreed,
      terms_agreed,
      campaign_ids,
    } = body ?? {}

    // Validation
    if (!company_name?.trim?.()) return NextResponse.json({ success: false, error: 'Company name is required' }, { status: 400 })
    if (!contact_name?.trim?.()) return NextResponse.json({ success: false, error: 'Contact name is required' }, { status: 400 })
    if (!email?.trim?.() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '')) return NextResponse.json({ success: false, error: 'Valid email is required' }, { status: 400 })
    if (!phone?.trim?.()) return NextResponse.json({ success: false, error: 'Phone is required' }, { status: 400 })
    if (!estimated_volume) return NextResponse.json({ success: false, error: 'Estimated volume is required' }, { status: 400 })
    if (!tcpa_agreed) return NextResponse.json({ success: false, error: 'TCPA agreement is required' }, { status: 400 })
    if (!terms_agreed) return NextResponse.json({ success: false, error: 'Terms agreement is required' }, { status: 400 })
    if (!campaign_ids || !Array.isArray(campaign_ids) || campaign_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one campaign must be selected' }, { status: 400 })
    }

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')?.[0]?.trim?.() ?? request.headers.get('x-real-ip') ?? 'unknown'

    // Generate tokens
    const groupToken = campaign_ids.length > 1 ? generateToken() : null
    const firstStatusToken = generateToken()

    // Verify campaigns exist
    const campaigns = await prisma.campaign.findMany({
      where: { id: { in: campaign_ids }, is_active: true },
      select: { id: true, name: true },
    })

    if ((campaigns?.length ?? 0) === 0) {
      return NextResponse.json({ success: false, error: 'No valid campaigns selected' }, { status: 400 })
    }

    // Create applications
    const applications = []
    for (let i = 0; i < (campaigns?.length ?? 0); i++) {
      const campaign = campaigns?.[i]
      const statusToken = i === 0 ? firstStatusToken : generateToken()
      const app = await prisma.vendor_application.create({
        data: {
          company_name: company_name?.trim?.() ?? '',
          contact_name: contact_name?.trim?.() ?? '',
          email: email?.trim?.()?.toLowerCase?.() ?? '',
          phone: phone?.trim?.() ?? '',
          website: website?.trim?.() || null,
          traffic_types: 'N/A', // Not collected per requirement
          estimated_volume: estimated_volume ?? '',
          experience: experience?.trim?.() || null,
          referred_by: referred_by?.trim?.() || null,
          comments: comments?.trim?.() || null,
          company_address: company_address?.trim?.() || null,
          company_state: company_state?.trim?.() || null,
          company_country: company_country?.trim?.() || null,
          entity_type: entity_type?.trim?.() || null,
          campaign_id: campaign?.id ?? '',
          status: 'pending',
          tcpa_agreed: true,
          terms_agreed: true,
          agreed_ip: ip,
          agreed_at: new Date(),
          status_token: statusToken,
          group_token: groupToken,
        },
      })
      applications.push({ ...(app ?? {}), campaign_name: campaign?.name ?? '' })
    }

    const appUrl = process.env.NEXTAUTH_URL ?? ''
    const campaignNames = (campaigns ?? []).map((c: any) => c?.name ?? '').join(', ')
    // Truncate for email subject (long subjects can cause email delivery failures)
    const campaignCount = campaigns?.length ?? 0
    const subjectCampaigns = campaignCount > 3
      ? `${(campaigns ?? []).slice(0, 3).map((c: any) => c?.name ?? '').join(', ')} + ${campaignCount - 3} more`
      : campaignNames

    // Send confirmation to vendor
    const vendorContent = `
      <p style="color: #374151; line-height: 1.6;">Thank you for submitting your vendor application to GrovLabs Inc.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 6px 0; color: #374151;"><strong>Company:</strong> ${company_name}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Campaign(s):</strong> ${campaignNames}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Status Token:</strong> <span style="font-family: monospace; background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-weight: bold; color: #7c3aed;">${firstStatusToken}</span></p>
      </div>
      <p style="color: #374151;">You can check your application status anytime using the link below:</p>
      <p><a href="${appUrl}/status?token=${firstStatusToken}" style="color: #7c3aed; font-weight: 600;">Check Application Status</a></p>
    `
    const vendorEmailResult = await sendNotificationEmail({
      notificationId: process.env.NOTIF_ID_APPLICATION_RECEIVED_VENDOR_CONFIRMATION ?? '',
      subject: `Application Received — ${subjectCampaigns} — GrovLabs Inc`,
      body: emailTemplate('Application Received', vendorContent),
      recipientEmail: email?.trim?.()?.toLowerCase?.() ?? '',
    })
    console.log('Vendor confirmation email result:', JSON.stringify(vendorEmailResult))

    // Send admin notification email with status token
    const adminContent = `
      <p style="color: #374151;">A new vendor application has been submitted on the portal.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 6px 0; color: #374151;"><strong>Company:</strong> ${company_name?.trim?.() ?? ''}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Contact:</strong> ${contact_name?.trim?.() ?? ''}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Email:</strong> ${email?.trim?.() ?? ''}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Phone:</strong> ${phone?.trim?.() ?? ''}</p>
        ${website?.trim?.() ? `<p style="margin: 6px 0; color: #374151;"><strong>Website:</strong> ${website.trim()}</p>` : ''}
        ${company_address?.trim?.() ? `<p style="margin: 6px 0; color: #374151;"><strong>Address:</strong> ${company_address.trim()}</p>` : ''}
        ${company_state?.trim?.() ? `<p style="margin: 6px 0; color: #374151;"><strong>State / Region:</strong> ${company_state.trim()}</p>` : ''}
        ${company_country?.trim?.() ? `<p style="margin: 6px 0; color: #374151;"><strong>Country:</strong> ${company_country.trim()}</p>` : ''}
        ${entity_type?.trim?.() ? `<p style="margin: 6px 0; color: #374151;"><strong>Entity Type:</strong> ${entity_type.trim()}</p>` : ''}
        <p style="margin: 6px 0; color: #374151;"><strong>Campaign(s):</strong> ${campaignNames}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Estimated Volume:</strong> ${estimated_volume ?? 'N/A'}</p>
        ${experience?.trim?.() ? `<p style="margin: 6px 0; color: #374151;"><strong>Experience:</strong> ${experience.trim()}</p>` : ''}
        ${referred_by?.trim?.() ? `<p style="margin: 6px 0; color: #374151;"><strong>Referred By:</strong> ${referred_by.trim()}</p>` : ''}
        ${comments?.trim?.() ? `<p style="margin: 6px 0; color: #374151;"><strong>Comments:</strong> ${comments.trim()}</p>` : ''}
      </div>
      <div style="background: #faf5ff; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e9d5ff;">
        <p style="margin: 0 0 6px 0; color: #6b21a8; font-weight: 600;">Vendor Status Token</p>
        <p style="margin: 0; font-family: monospace; font-size: 16px; font-weight: bold; color: #7c3aed; background: #ede9fe; display: inline-block; padding: 4px 12px; border-radius: 4px;">${firstStatusToken}</p>
        <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">Use this token to check the vendor's status: <a href="${appUrl}/status?token=${firstStatusToken}" style="color: #7c3aed;">${appUrl}/status?token=${firstStatusToken}</a></p>
      </div>
    `
    const adminEmailResult = await sendNotificationEmail({
      notificationId: process.env.NOTIF_ID_NEW_APPLICATION_ADMIN_ALERT ?? '',
      subject: `New Vendor Application: ${company_name?.trim?.() ?? 'Unknown'} — ${subjectCampaigns} (${campaignCount} campaign${campaignCount !== 1 ? 's' : ''})`,
      body: emailTemplate('New Vendor Application', adminContent),
      recipientEmail: 'sammyabdel@thebrokenwood.com',
    })
    console.log('Admin notification email result:', JSON.stringify(adminEmailResult))

    // Notify backend QA agent (triggers Telegram approve/reject buttons)
    const applicationIds = (applications ?? []).map((a: any) => a?.id ?? '').filter(Boolean)
    try {
      await fetch(`${BACKEND_URL}/onboarding/webhook/application-created`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_ids: applicationIds }),
      })
    } catch (webhookErr: any) {
      console.error('Backend webhook error (application-created):', webhookErr?.message ?? webhookErr)
      // Non-blocking — application is already saved
    }

    return NextResponse.json({
      success: true,
      status_token: firstStatusToken,
      application_count: campaigns?.length ?? 0,
    })
  } catch (error: any) {
    console.error('Application submit error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to submit application' }, { status: 500 })
  }
}
