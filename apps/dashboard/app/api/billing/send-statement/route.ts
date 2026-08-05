export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EMAIL_CONFIG } from '@/lib/email-config'

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  // Accept both plain 'YYYY-MM-DD' and full ISO datetime strings (e.g. from the DB)
  const s = String(dateStr).slice(0, 10)
  const d = new Date(s + 'T00:00:00Z')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

interface OfferBreakdown {
  offer: string
  calls: number
  payout: number
  avgDuration: number
  avgPayout: number
  callDetails: { id: number; date: string; callerNumber: string; city: string; duration: number; payout: number }[]
}

interface PaidPeriod {
  periodStart: string
  periodEnd: string
  amount: number
  paidAt: string | null
}

interface StatementData {
  vendorName: string
  vendorEmail: string
  periodStart: string
  periodEnd: string
  paymentDueDate: string
  totalCalls: number
  totalPayout: number
  totalRevenue: number
  margin: number
  offerBreakdown: OfferBreakdown[]
  alreadyPaid?: number
  balanceDue?: number
  paidPeriods?: PaidPeriod[]
}

function buildEmailHtml(data: StatementData): string {
  const periodLabel = `${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`

  // Ledger: how much of this period was already paid in earlier settlements,
  // and the remaining balance the vendor should actually invoice for.
  const alreadyPaid = Math.max(0, Number(data.alreadyPaid) || 0)
  const hasPartialPayments = alreadyPaid > 0.005
  const balanceDue = hasPartialPayments
    ? Math.max(0, Math.round(((data.balanceDue ?? (data.totalPayout - alreadyPaid))) * 100) / 100)
    : data.totalPayout
  // The figure the vendor should invoice / be paid = the outstanding balance.
  const invoiceAmount = hasPartialPayments ? balanceDue : data.totalPayout

  // Optional breakdown of earlier payments already applied to this period.
  const paidPeriodRows = (data.paidPeriods || [])
    .map(
      (p) => `
    <tr>
      <td style="padding: 8px 0; color: #6b7280;">${formatDate(p.periodStart)} - ${formatDate(p.periodEnd)}${p.paidAt ? ` <span style=\"color:#9ca3af;\">(paid ${formatDate(String(p.paidAt).slice(0, 10))})</span>` : ''}</td>
      <td style="padding: 8px 0; text-align: right; font-family: 'Courier New', monospace; color: #374151;">$${formatMoney(Number(p.amount) || 0)}</td>
    </tr>`
    )
    .join('')

  const alreadyPaidSection = hasPartialPayments
    ? `
      <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #bfdbfe;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #1e40af; font-weight: 700;">Payments Already Applied to This Period</p>
        <p style="margin: 0 0 12px; font-size: 13px; color: #1e40af; line-height: 1.5;">
          Part of this billing period has already been paid. Those amounts are shown below and have been
          subtracted from your balance due, so please invoice only for the outstanding balance.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
          ${paidPeriodRows}
          <tr>
            <td style="padding: 10px 0 0; border-top: 1px solid #bfdbfe; color: #1e40af; font-weight: 700;">Total Already Paid</td>
            <td style="padding: 10px 0 0; border-top: 1px solid #bfdbfe; text-align: right; font-weight: 700; color: #1e40af; font-family: 'Courier New', monospace;">$${formatMoney(alreadyPaid)}</td>
          </tr>
        </table>
      </div>`
    : ''

  // Build offer rows
  const offerRows = data.offerBreakdown.map(offer => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${offer.offer}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">${offer.calls}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: 'Courier New', monospace;">${formatDuration(offer.avgDuration)}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; font-family: 'Courier New', monospace;">$${formatMoney(offer.avgPayout)}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; font-family: 'Courier New', monospace;">$${formatMoney(offer.payout)}</td>
    </tr>
  `).join('')

  const { companyName, contactEmail, primaryColor, gradientStart, gradientEnd, accentColor, companyTagline } = EMAIL_CONFIG

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 680px; margin: 0 auto; padding: 32px 16px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${companyName}</h1>
      <p style="margin: 8px 0 0; color: ${accentColor}; font-size: 14px;">Vendor Billing Statement</p>
    </div>

    <!-- Body -->
    <div style="background: white; border-radius: 0 0 12px 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">

      <!-- Greeting -->
      <p style="font-size: 16px; color: #374151; margin: 0 0 24px;">Hi ${data.vendorName},</p>
      <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0 0 24px;">
        Below is your billing statement for the period <strong style="color: #374151;">${periodLabel}</strong>.
        Please review the details and send an invoice to <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none; font-weight: 600;">${contactEmail}</a> for the total amount shown below.
      </p>

      <!-- Summary Box -->
      <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
          <tr>
            <td style="padding: 8px 0;"><span style="color: #6b7280;">Billing Period:</span></td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #374151;">${periodLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><span style="color: #6b7280;">Converted Calls:</span></td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #374151;">${data.totalCalls}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><span style="color: #6b7280;">Payment Due:</span></td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #374151;">${formatDate(data.paymentDueDate)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 12px 0 0; border-top: 2px solid #e5e7eb;"></td>
          </tr>
          ${hasPartialPayments ? `
          <tr>
            <td style="padding: 4px 0;"><span style="color: #6b7280;">Total Payout:</span></td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #374151; font-family: 'Courier New', monospace;">$${formatMoney(data.totalPayout)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><span style="color: #6b7280;">Already Paid:</span></td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #2563eb; font-family: 'Courier New', monospace;">- $${formatMoney(alreadyPaid)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 8px 0 0; border-top: 1px solid #e5e7eb;"></td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><span style="color: #374151; font-size: 18px; font-weight: 700;">Balance Due:</span></td>
            <td style="padding: 4px 0; text-align: right; font-size: 24px; font-weight: 700; color: #059669; font-family: 'Courier New', monospace;">$${formatMoney(balanceDue)}</td>
          </tr>
          ` : `
          <tr>
            <td style="padding: 4px 0;"><span style="color: #374151; font-size: 18px; font-weight: 700;">Total Payout:</span></td>
            <td style="padding: 4px 0; text-align: right; font-size: 24px; font-weight: 700; color: #059669; font-family: 'Courier New', monospace;">$${formatMoney(data.totalPayout)}</td>
          </tr>
          `}
        </table>
      </div>

      ${alreadyPaidSection}

      <!-- Offer Breakdown -->
      <h3 style="font-size: 16px; color: #374151; margin: 0 0 12px; font-weight: 600;">Breakdown by Campaign</h3>
      <div style="overflow-x: auto; margin-bottom: 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; border: 1px solid #e5e7eb; border-radius: 8px; border-collapse: separate; overflow: hidden;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Campaign</th>
              <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Calls</th>
              <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Avg Duration</th>
              <th style="padding: 12px 16px; text-align: right; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Avg Payout</th>
              <th style="padding: 12px 16px; text-align: right; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Total Payout</th>
            </tr>
          </thead>
          <tbody>
            ${offerRows}
          </tbody>
          <tfoot>
            <tr style="background: #f0fdf4;">
              <td style="padding: 14px 16px; font-weight: 700; color: #374151;">Total</td>
              <td style="padding: 14px 16px; text-align: center; font-weight: 700; color: #374151;">${data.totalCalls}</td>
              <td style="padding: 14px 16px;"></td>
              <td style="padding: 14px 16px;"></td>
              <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #059669; font-size: 16px; font-family: 'Courier New', monospace;">$${formatMoney(data.totalPayout)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Invoice Instructions -->
      <div style="background: #fef3c7; border-radius: 8px; padding: 16px; border: 1px solid #fbbf24; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
          <strong>Invoice Instructions:</strong> Please send your invoice for <strong>$${formatMoney(invoiceAmount)}</strong>${hasPartialPayments ? ` (the outstanding balance after $${formatMoney(alreadyPaid)} already paid)` : ''} to
          <a href="mailto:${contactEmail}" style="color: ${primaryColor}; font-weight: 600;">${contactEmail}</a>
          with the subject line: <em>"Invoice - ${data.vendorName} - ${periodLabel}"</em>
        </p>
      </div>

      <!-- Footer -->
      <p style="font-size: 13px; color: #9ca3af; line-height: 1.5; margin: 0;">
        If you have any questions about this statement, please contact <a href="mailto:${contactEmail}" style="color: ${primaryColor};">${contactEmail}</a>.
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
    const data: StatementData = await req.json()

    if (!data.vendorEmail) {
      return NextResponse.json({ error: 'Vendor email is required' }, { status: 400 })
    }

    // Support multiple recipients: split a comma- (or semicolon-) separated
    // string into individual addresses. The email gateway only accepts ONE
    // address per send, so we send the statement to each recipient in a loop.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const recipients = Array.from(
      new Set(
        String(data.vendorEmail)
          .split(/[,;]/)
          .map((e) => e.trim())
          .filter((e) => e.length > 0)
      )
    )

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'Vendor email is required' }, { status: 400 })
    }

    const invalid = recipients.filter((e) => !emailRegex.test(e))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid email address${invalid.length > 1 ? 'es' : ''}: ${invalid.join(', ')}` },
        { status: 400 }
      )
    }

    const periodLabel = `${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`
    const htmlBody = buildEmailHtml(data)

    const senderDomain = EMAIL_CONFIG.getSenderDomain(process.env.NEXTAUTH_URL)

    // Send the statement to each recipient (the gateway accepts one address
    // per request, so we loop and aggregate the results).
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
            notification_id: process.env.NOTIF_ID_VENDOR_BILLING_STATEMENT,
            subject: `Billing Statement - ${data.vendorName} - ${periodLabel}`,
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
          console.error('Send statement: non-JSON response from email gateway', recipient, response.status, raw.slice(0, 300))
          failed.push({ email: recipient, reason: `gateway status ${response.status}` })
          continue
        }

        if (!response.ok || !result?.success) {
          if (result?.notification_disabled) {
            notificationsDisabled = true
            continue
          }
          console.error('Send statement: email gateway error', recipient, response.status, JSON.stringify(result).slice(0, 300))
          failed.push({ email: recipient, reason: result?.message || `gateway status ${response.status}` })
          continue
        }

        sent.push(recipient)
      } catch (err: any) {
        console.error('Send statement: send failed', recipient, err)
        failed.push({ email: recipient, reason: err?.message || 'send failed' })
      }
    }

    // All recipients failed
    if (sent.length === 0 && failed.length > 0) {
      return NextResponse.json(
        { error: `The statement could not be sent. ${failed.map((f) => `${f.email} (${f.reason})`).join('; ')}` },
        { status: 502 }
      )
    }

    // None sent but notifications disabled
    if (sent.length === 0 && notificationsDisabled) {
      return NextResponse.json({ success: true, message: 'Statement skipped (notifications disabled)' })
    }

    // Success (possibly partial)
    const recipientLabel = sent.length === 1 ? sent[0] : `${sent.length} recipients`
    let message = `Statement sent to ${recipientLabel}`
    if (failed.length > 0) {
      message += ` — but failed for ${failed.map((f) => f.email).join(', ')}`
    }

    return NextResponse.json({ success: true, message, sent, failed: failed.map((f) => f.email) })
  } catch (error: any) {
    console.error('Send statement error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send statement' }, { status: 500 })
  }
}
