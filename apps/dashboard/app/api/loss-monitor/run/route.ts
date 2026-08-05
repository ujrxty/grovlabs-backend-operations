export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { loadLossSettings, toLossSettings } from '@/lib/loss-monitor-settings'
import {
  computeLossAlerts, isWithinActiveHours, ALERT_TYPE_LABELS,
  type LossAlert, type AlertType,
} from '@/lib/loss-monitor'
import { getBusinessDateRange, businessHourNow, BUSINESS_TZ } from '@/lib/business-time'
import { getEmailConfig, EMAIL_CONFIG } from '@/lib/email-config'

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildEmailHtml(alerts: LossAlert[], dateLabel: string, totalCalls: number): string {
  const { primaryColor, accentColor, companyName } = EMAIL_CONFIG
  const byType = new Map<AlertType, LossAlert[]>()
  for (const a of alerts) {
    if (!byType.has(a.type)) byType.set(a.type, [])
    byType.get(a.type)!.push(a)
  }

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length

  let sections = ''
  for (const [type, list] of Array.from(byType.entries())) {
    const rows = list.map((a) => {
      const who = [a.vendor, a.campaign || a.buyer].filter(Boolean).join(' \u2192 ')
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#111;">${who || a.buyer || '\u2014'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#555;">${a.message}</td>
      </tr>`
    }).join('')
    sections += `
      <div style="margin-top:20px;">
        <h3 style="font-size:14px;margin:0 0 6px;color:${primaryColor};">${ALERT_TYPE_LABELS[type]} <span style="color:#999;font-weight:400;">(${list.length})</span></h3>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <thead><tr style="background:#f8f8fb;">
            <th style="text-align:left;padding:8px 10px;font-size:11px;color:#888;text-transform:uppercase;">Source</th>
            <th style="text-align:left;padding:8px 10px;font-size:11px;color:#888;text-transform:uppercase;">Issue</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:${primaryColor};border-radius:12px 12px 0 0;padding:20px 24px;">
        <h1 style="margin:0;color:#fff;font-size:20px;">\u26a0\ufe0f Loss Monitor Alert</h1>
        <p style="margin:4px 0 0;color:${accentColor};font-size:13px;">${dateLabel} \u00b7 ${totalCalls} calls reviewed</p>
      </div>
      <div style="background:#fff;border-radius:0 0 12px 12px;padding:24px;border:1px solid #eee;border-top:none;">
        <p style="font-size:14px;color:#333;margin:0 0 8px;">
          <strong>${alerts.length}</strong> issue(s) flagged${criticalCount ? ` \u2014 <span style="color:#dc2626;">${criticalCount} critical</span>` : ''}. Review below and reach out to the vendor or buyer as needed.
        </p>
        ${sections}
        <p style="font-size:12px;color:#999;margin-top:24px;border-top:1px solid #eee;padding-top:12px;">
          Sent automatically by ${companyName}. Adjust thresholds in the Loss Monitor tab.
        </p>
      </div>
    </div>
  </body></html>`
}

async function handle(req: Request): Promise<NextResponse> {
  // Auth: either a valid dashboard session OR the shared scheduler key.
  const url = new URL(req.url)
  const key = req.headers.get('x-loss-monitor-key') || url.searchParams.get('key')
  const force = url.searchParams.get('force') === '1'
  let authed = false
  if (key && process.env.LOSS_MONITOR_KEY && key === process.env.LOSS_MONITOR_KEY) authed = true
  if (!authed) {
    const session = await getServerSession(authOptions)
    if (session) authed = true
  }
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const row = await loadLossSettings()
    const settings = toLossSettings(row)
    const now = new Date()
    const hour = businessHourNow(now)

    if (!force) {
      if (!settings.alerts_enabled) {
        return NextResponse.json({ skipped: true, reason: 'alerts_disabled' })
      }
      if (!isWithinActiveHours(hour, settings.active_from_hour, settings.active_to_hour)) {
        return NextResponse.json({ skipped: true, reason: 'outside_active_hours', hour })
      }
    }

    const { from, to } = getBusinessDateRange('today')
    const result = await computeLossAlerts(from, to, settings)

    // Always record the check timestamp
    await prisma.loss_monitor_settings.update({
      where: { id: 'singleton' },
      data: { last_check_at: now },
    })

    if (result.alerts.length === 0) {
      return NextResponse.json({ sent: false, alerts: 0, checkedAt: now.toISOString() })
    }

    // Send one grouped email to all recipients
    const dateLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TZ, weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }).format(now) + ' ET'
    const html = buildEmailHtml(result.alerts, dateLabel, result.totalCalls)

    const recipients = settings.recipients.split(',').map((r) => r.trim()).filter(Boolean)
    const senderDomain = EMAIL_CONFIG.getSenderDomain(process.env.NEXTAUTH_URL)

    const sendResults: { email: string; ok: boolean }[] = []
    for (const email of recipients) {
      try {
        const resp = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deployment_token: process.env.ABACUSAI_API_KEY,
            app_id: process.env.WEB_APP_ID,
            notification_id: process.env.NOTIF_ID_LOSS_MONITOR_ALERT,
            subject: `\u26a0\ufe0f Loss Monitor: ${result.alerts.length} issue(s) flagged \u2014 ${dateLabel}`,
            body: html,
            is_html: true,
            recipient_email: email,
            reply_to: EMAIL_CONFIG.contactEmail,
            sender_email: `noreply@${senderDomain}`,
            sender_alias: `${EMAIL_CONFIG.companyName} Loss Monitor`,
          }),
        })
        const r = await resp.json()
        sendResults.push({ email, ok: !!r.success || !!r.notification_disabled })
      } catch (e: any) {
        console.error('Loss alert email failed for', email, e?.message)
        sendResults.push({ email, ok: false })
      }
    }

    await prisma.loss_monitor_settings.update({
      where: { id: 'singleton' },
      data: { last_alert_at: now },
    })

    return NextResponse.json({
      sent: true,
      alerts: result.alerts.length,
      recipients: sendResults,
      checkedAt: now.toISOString(),
    })
  } catch (err: any) {
    console.error('Loss monitor run error:', err?.message || err)
    return NextResponse.json({ error: 'Run failed' }, { status: 500 })
  }
}

export async function POST(req: Request) { return handle(req) }
export async function GET(req: Request) { return handle(req) }
