import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const settings = await request.json()

    // Use Resend if provider is resend
    if (settings.smtpProvider === 'resend') {
      if (!settings.resendApiKey) {
        return NextResponse.json({ success: false, message: 'Resend API key is required' }, { status: 400 })
      }

      const resend = new Resend(settings.resendApiKey)
      const testEmail = settings.contactEmail || 'delivered@resend.dev'

      const { data, error } = await resend.emails.send({
        from: `${settings.smtpFromName || settings.companyName} <${settings.smtpFromEmail || 'noreply@grovlabs.com'}>`,
        to: testEmail,
        subject: `Test Email from ${settings.companyName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, ${settings.brandColor || '#8b5a2b'}, ${adjustColor(settings.brandColor || '#8b5a2b', -20)}); padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px;">${settings.companyName}</h1>
            </div>
            <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <h2 style="margin: 0 0 16px; font-size: 18px; color: #1f2937;">Email Test Successful!</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                Your Resend email settings are configured correctly.
              </p>
              <p style="color: #6b7280; font-size: 13px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                You can now send emails through Resend.
              </p>
            </div>
          </div>
        `,
      })

      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: `Test email sent to ${testEmail}` })
    }

    // SMTP path (kept for backward compatibility but likely won't work on Render)
    return NextResponse.json({
      success: false,
      message: 'SMTP is blocked on this platform. Please use Resend instead.'
    }, { status: 400 })

  } catch (error: any) {
    console.error('Email test failed:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to send email',
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
