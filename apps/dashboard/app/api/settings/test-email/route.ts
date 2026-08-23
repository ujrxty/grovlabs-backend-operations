import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const settings = await request.json()

    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
      return NextResponse.json({ success: false, message: 'SMTP settings incomplete' }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: parseInt(settings.smtpPort) || 587,
      secure: settings.smtpPort === '465',
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
      // Force IPv4 to avoid ENETUNREACH on IPv6
      dnsOptions: { family: 4 },
      connectionTimeout: 30000,
      greetingTimeout: 15000,
    } as any)

    // Verify connection
    await transporter.verify()

    // Send test email to the contact email
    const testEmail = settings.contactEmail || settings.smtpUser
    await transporter.sendMail({
      from: `"${settings.smtpFromName || settings.companyName}" <${settings.smtpFromEmail || settings.smtpUser}>`,
      to: testEmail,
      subject: `Test Email from ${settings.companyName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, ${settings.brandColor || '#8b5a2b'}, ${adjustColor(settings.brandColor || '#8b5a2b', -20)}); padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">${settings.companyName}</h1>
          </div>
          <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="margin: 0 0 16px; font-size: 18px; color: #1f2937;">SMTP Test Successful!</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Your email settings are configured correctly. This test email was sent via:
            </p>
            <ul style="color: #4b5563; line-height: 1.8;">
              <li><strong>Host:</strong> ${settings.smtpHost}</li>
              <li><strong>Port:</strong> ${settings.smtpPort}</li>
              <li><strong>From:</strong> ${settings.smtpFromEmail || settings.smtpUser}</li>
            </ul>
            <p style="color: #6b7280; font-size: 13px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
              You can now send invoices, statements, and alerts through your own email server.
            </p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true, message: `Test email sent to ${testEmail}` })
  } catch (error: any) {
    console.error('SMTP test failed:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to connect to SMTP server',
    }, { status: 500 })
  }
}

function adjustColor(hex: string, percent: number): string {
  try {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = Math.min(255, Math.max(0, (num >> 16) + percent))
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent))
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent))
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  } catch {
    return hex
  }
}
