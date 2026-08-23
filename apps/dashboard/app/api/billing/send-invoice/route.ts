export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EMAIL_CONFIG } from '@/lib/email-config'

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
}

interface CallDetail {
  id: number
  date: string
  callerNumber: string
  city: string
  duration: number
  revenue: number
}

interface CampaignBreakdown {
  campaign: string
  calls: number
  revenue: number
  callDetails: CallDetail[]
}

interface InvoiceData {
  buyerName: string
  buyerEmail: string
  periodStart: string
  periodEnd: string
  dueDate?: string
  totalCalls: number
  totalRevenue: number
  campaignBreakdown: CampaignBreakdown[]
  invoiceNumber?: string
}

// ---------------------------------------------------------------------------
// Email HTML – Summary by Campaign only (no itemized calls)
// ---------------------------------------------------------------------------
function buildInvoiceHtml(data: InvoiceData): string {
  const { companyName, contactEmail, primaryColor, gradientStart, gradientEnd, accentColor, companyTagline } = EMAIL_CONFIG
  const periodLabel = `${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`

  // Campaign summary rows
  const campaignRows = data.campaignBreakdown.map(c => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${c.campaign}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">${c.calls}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; font-family: 'Courier New', monospace;">$${formatMoney(c.revenue)}</td>
    </tr>
  `).join('')

  const dueRow = data.dueDate ? `
          <tr>
            <td style="padding: 8px 0;"><span style="color: #6b7280;">Payment Due:</span></td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #374151;">${formatDate(data.dueDate)}</td>
          </tr>` : ''

  const invoiceNumRow = data.invoiceNumber ? `
          <tr>
            <td style="padding: 8px 0;"><span style="color: #6b7280;">Invoice #:</span></td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #374151;">${data.invoiceNumber}</td>
          </tr>` : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 680px; margin: 0 auto; padding: 32px 16px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${companyName}</h1>
      <p style="margin: 8px 0 0; color: ${accentColor}; font-size: 14px;">Invoice</p>
    </div>

    <!-- Body -->
    <div style="background: white; border-radius: 0 0 12px 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">

      <p style="font-size: 16px; color: #374151; margin: 0 0 24px;">Hi ${data.buyerName},</p>
      <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0 0 24px;">
        Please find your invoice below for converted calls delivered during <strong style="color: #374151;">${periodLabel}</strong>.
        Payment can be remitted per the total shown. Reply to this email or contact
        <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none; font-weight: 600;">${contactEmail}</a> with any questions.
      </p>

      <!-- Summary Box -->
      <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
          ${invoiceNumRow}
          <tr>
            <td style="padding: 8px 0;"><span style="color: #6b7280;">Billing Period:</span></td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #374151;">${periodLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><span style="color: #6b7280;">Converted Calls:</span></td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #374151;">${data.totalCalls}</td>
          </tr>
          ${dueRow}
          <tr>
            <td colspan="2" style="padding: 12px 0 0; border-top: 2px solid #e5e7eb;"></td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><span style="color: #374151; font-size: 18px; font-weight: 700;">Total Due:</span></td>
            <td style="padding: 4px 0; text-align: right; font-size: 24px; font-weight: 700; color: #059669; font-family: 'Courier New', monospace;">$${formatMoney(data.totalRevenue)}</td>
          </tr>
        </table>
      </div>

      <!-- Campaign Summary -->
      <h3 style="font-size: 16px; color: #374151; margin: 0 0 12px; font-weight: 600;">Summary by Campaign</h3>
      <div style="overflow-x: auto; margin-bottom: 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; border: 1px solid #e5e7eb; border-radius: 8px; border-collapse: separate; overflow: hidden;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Campaign</th>
              <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Calls</th>
              <th style="padding: 12px 16px; text-align: right; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Amount Due</th>
            </tr>
          </thead>
          <tbody>${campaignRows}</tbody>
          <tfoot>
            <tr style="background: #f0fdf4;">
              <td style="padding: 14px 16px; font-weight: 700; color: #374151;">Total</td>
              <td style="padding: 14px 16px; text-align: center; font-weight: 700; color: #374151;">${data.totalCalls}</td>
              <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #059669; font-size: 16px; font-family: 'Courier New', monospace;">$${formatMoney(data.totalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Footer -->
      <p style="font-size: 13px; color: #9ca3af; line-height: 1.5; margin: 24px 0 0;">
        Questions about this invoice? Contact <a href="mailto:${contactEmail}" style="color: ${primaryColor};">${contactEmail}</a>.
      </p>
    </div>

    <!-- Bottom Footer -->
    <div style="text-align: center; padding: 24px 0;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">${companyName} &bull; ${companyTagline}</p>
    </div>
  </div>
</body>
</html>
  `
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data: InvoiceData = await req.json()

    if (!data.buyerEmail) {
      return NextResponse.json({ error: 'Buyer email is required' }, { status: 400 })
    }

    // Support multiple recipients: split a comma- (or semicolon-) separated
    // string into individual addresses. The email gateway only accepts ONE
    // address per send, so we send the invoice to each recipient in a loop.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const recipients = Array.from(
      new Set(
        String(data.buyerEmail)
          .split(/[,;]/)
          .map((e) => e.trim())
          .filter((e) => e.length > 0)
      )
    )

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'Buyer email is required' }, { status: 400 })
    }

    const invalid = recipients.filter((e) => !emailRegex.test(e))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid email address${invalid.length > 1 ? 'es' : ''}: ${invalid.join(', ')}` },
        { status: 400 }
      )
    }

    const periodLabel = `${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`

    // Build email HTML with campaign summary
    const htmlBody = buildInvoiceHtml(data)

    const senderDomain = EMAIL_CONFIG.getSenderDomain(process.env.NEXTAUTH_URL)

    // 3. Send the invoice to each recipient (the gateway accepts one address
    //    per request, so we loop and aggregate the results).
    const sent: string[] = []
    const failed: { email: string; reason: string }[] = []
    let notificationsDisabled = false

    for (const recipient of recipients) {
      try {
        const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deployment_token: process.env.ABACUSAI_API_KEY,
            app_id: process.env.WEB_APP_ID,
            notification_id: process.env.NOTIF_ID_BUYER_INVOICE,
            subject: `Invoice - ${data.buyerName} - ${periodLabel}`,
            body: htmlBody,
            is_html: true,
            recipient_email: recipient,
            reply_to: EMAIL_CONFIG.contactEmail,
            sender_email: `noreply@${senderDomain}`,
            sender_alias: EMAIL_CONFIG.companyName,
          }),
        })

        const raw = await response.text()
        let result: any = null
        try {
          result = JSON.parse(raw)
        } catch {
          console.error('Send invoice: non-JSON response from email gateway', recipient, response.status, raw.slice(0, 300))
          failed.push({ email: recipient, reason: `gateway status ${response.status}` })
          continue
        }

        if (!response.ok || !result?.success) {
          if (result?.notification_disabled) {
            notificationsDisabled = true
            continue
          }
          console.error('Send invoice: email gateway error', recipient, response.status, JSON.stringify(result).slice(0, 300))
          failed.push({ email: recipient, reason: result?.message || `gateway status ${response.status}` })
          continue
        }

        sent.push(recipient)
      } catch (err: any) {
        console.error('Send invoice: send failed', recipient, err)
        failed.push({ email: recipient, reason: err?.message || 'send failed' })
      }
    }

    // All recipients failed
    if (sent.length === 0 && failed.length > 0) {
      return NextResponse.json(
        { error: `The invoice could not be sent. ${failed.map((f) => `${f.email} (${f.reason})`).join('; ')}` },
        { status: 502 }
      )
    }

    // None sent but notifications disabled
    if (sent.length === 0 && notificationsDisabled) {
      return NextResponse.json({ success: true, message: 'Invoice skipped (notifications disabled)' })
    }

    // Success (possibly partial)
    const recipientLabel = sent.length === 1 ? sent[0] : `${sent.length} recipients`
    let message = `Invoice sent to ${recipientLabel}`
    if (failed.length > 0) {
      message += ` — but failed for ${failed.map((f) => f.email).join(', ')}`
    }

    return NextResponse.json({ success: true, message, sent, failed: failed.map((f) => f.email) })
  } catch (error: any) {
    console.error('Send invoice error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send invoice' }, { status: 500 })
  }
}
