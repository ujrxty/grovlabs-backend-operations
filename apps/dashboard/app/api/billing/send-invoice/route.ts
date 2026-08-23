export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { invoiceEmail } from '@/lib/email-templates'
import { Resend } from 'resend'

interface CampaignBreakdown {
  campaign: string
  calls: number
  revenue: number
}

interface InvoiceData {
  buyerName: string
  buyerEmail: string
  periodStart: string
  periodEnd: string
  totalCalls: number
  totalRevenue: number
  campaignBreakdown: CampaignBreakdown[]
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

    const formatDate = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    const periodLabel = `${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}`

    // Build email HTML using the new dark theme template
    const htmlBody = invoiceEmail({
      buyerName: data.buyerName,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      totalCalls: data.totalCalls,
      totalRevenue: data.totalRevenue,
      campaigns: data.campaignBreakdown.map(c => ({
        name: c.campaign,
        calls: c.calls,
        amount: c.revenue,
      })),
    })

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Email service not configured (RESEND_API_KEY missing)' }, { status: 500 })
    }

    const resend = new Resend(apiKey)
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@grovlabs.com'
    const fromName = process.env.SMTP_FROM_NAME || 'GrovLabs'

    // Send to all recipients at once (Resend supports arrays)
    const { data: emailData, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: recipients,
      replyTo: 'uj@grovlabs.com',
      subject: `Invoice – ${data.buyerName} – ${periodLabel}`,
      html: htmlBody,
    })

    if (error) {
      console.error('Send invoice error:', error)
      return NextResponse.json({ error: error.message || 'Failed to send invoice' }, { status: 502 })
    }

    const recipientLabel = recipients.length === 1 ? recipients[0] : `${recipients.length} recipients`
    return NextResponse.json({ success: true, message: `Invoice sent to ${recipientLabel}`, messageId: emailData?.id })
  } catch (error: any) {
    console.error('Send invoice error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send invoice' }, { status: 500 })
  }
}
