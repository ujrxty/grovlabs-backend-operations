/**
 * GrovLabs Professional Email Templates
 * Dark theme with lime green accents matching the dashboard
 */

export const BRAND = {
  name: 'GrovLabs',
  tagline: 'Performance Marketing',
  contactEmail: 'uj@grovlabs.com',
  contactPhone: '+1 (754) 344-0773',
  website: 'grovlabs.com',
  // Colors matching dashboard theme
  lime: '#a3e635',
  limeDark: '#84cc16',
  dark: '#0a0a0a',
  darkCard: '#141414',
  darkBorder: '#262626',
  textPrimary: '#fafafa',
  textMuted: '#a1a1aa',
  success: '#22c55e',
  warning: '#f59e0b',
}

interface EmailOptions {
  preheader?: string
  showFooterContact?: boolean
}

/**
 * Base email wrapper - dark theme
 */
export function emailWrapper(content: string, options: EmailOptions = {}): string {
  const { preheader = '', showFooterContact = true } = options

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>GrovLabs</title>
  <!--[if mso]>
  <style type="text/css">
    table, td { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.dark}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.dark};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display: inline-flex; align-items: center;">
                      <div style="width: 40px; height: 40px; background: ${BRAND.lime}; border-radius: 10px; display: inline-block; text-align: center; line-height: 40px; margin-right: 12px;">
                        <span style="font-size: 20px; font-weight: 700; color: ${BRAND.dark};">G</span>
                      </div>
                      <div style="display: inline-block; vertical-align: middle;">
                        <span style="font-size: 20px; font-weight: 700; color: ${BRAND.textPrimary}; letter-spacing: -0.5px;">GrovLabs</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${BRAND.darkCard}; border-radius: 16px; border: 1px solid ${BRAND.darkBorder}; overflow: hidden;">
                <tr>
                  <td style="padding: 40px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${showFooterContact ? `
                <tr>
                  <td style="padding-bottom: 16px; border-bottom: 1px solid ${BRAND.darkBorder};">
                    <p style="margin: 0 0 8px; font-size: 13px; color: ${BRAND.textMuted};">Questions? Reach out anytime:</p>
                    <p style="margin: 0; font-size: 13px;">
                      <a href="mailto:${BRAND.contactEmail}" style="color: ${BRAND.lime}; text-decoration: none; font-weight: 500;">${BRAND.contactEmail}</a>
                      <span style="color: ${BRAND.darkBorder}; margin: 0 8px;">|</span>
                      <span style="color: ${BRAND.textMuted};">${BRAND.contactPhone}</span>
                    </p>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding-top: 16px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: ${BRAND.textMuted};">
                      © ${new Date().getFullYear()} ${BRAND.name} · ${BRAND.tagline}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Styled heading
 */
export function heading(text: string, subtitle?: string): string {
  return `
    <h1 style="margin: 0 0 ${subtitle ? '8px' : '24px'}; font-size: 24px; font-weight: 700; color: ${BRAND.textPrimary}; letter-spacing: -0.5px;">${text}</h1>
    ${subtitle ? `<p style="margin: 0 0 24px; font-size: 15px; color: ${BRAND.textMuted};">${subtitle}</p>` : ''}
  `
}

/**
 * Paragraph text
 */
export function text(content: string, muted = false): string {
  return `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: ${muted ? BRAND.textMuted : BRAND.textPrimary};">${content}</p>`
}

/**
 * Highlight box (for key info)
 */
export function highlightBox(content: string, type: 'lime' | 'success' | 'warning' = 'lime'): string {
  const colors = {
    lime: { bg: 'rgba(163, 230, 53, 0.1)', border: 'rgba(163, 230, 53, 0.3)', text: BRAND.lime },
    success: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', text: BRAND.success },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: BRAND.warning },
  }
  const c = colors[type]

  return `
    <div style="background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 12px; padding: 20px; margin: 24px 0;">
      ${content}
    </div>
  `
}

/**
 * Info row (label: value)
 */
export function infoRow(label: string, value: string, highlight = false): string {
  return `
    <tr>
      <td style="padding: 8px 0; font-size: 14px; color: ${BRAND.textMuted}; width: 40%;">${label}</td>
      <td style="padding: 8px 0; font-size: 14px; color: ${highlight ? BRAND.lime : BRAND.textPrimary}; font-weight: ${highlight ? '600' : '500'}; text-align: right;">${value}</td>
    </tr>
  `
}

/**
 * Info table wrapper
 */
export function infoTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`
}

/**
 * Primary CTA button
 */
export function button(text: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background: ${BRAND.lime}; border-radius: 8px;">
          <a href="${href}" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 600; color: ${BRAND.dark}; text-decoration: none; letter-spacing: 0.3px;">${text}</a>
        </td>
      </tr>
    </table>
  `
}

/**
 * Divider
 */
export function divider(): string {
  return `<hr style="border: none; border-top: 1px solid ${BRAND.darkBorder}; margin: 24px 0;">`
}

/**
 * Amount display (for invoices)
 */
export function amountDisplay(label: string, amount: string, large = false): string {
  return `
    <div style="text-align: ${large ? 'center' : 'right'}; ${large ? 'padding: 24px 0;' : ''}">
      <p style="margin: 0 0 4px; font-size: 12px; color: ${BRAND.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">${label}</p>
      <p style="margin: 0; font-size: ${large ? '36px' : '24px'}; font-weight: 700; color: ${BRAND.success}; font-family: 'Courier New', monospace;">${amount}</p>
    </div>
  `
}

/**
 * Campaign/item row for tables
 */
export function tableRow(cols: string[], isHeader = false, isTotal = false): string {
  const bg = isHeader ? BRAND.darkBorder : isTotal ? 'rgba(163, 230, 53, 0.1)' : 'transparent'
  const weight = isHeader || isTotal ? '600' : '400'
  const color = isTotal ? BRAND.lime : BRAND.textPrimary

  return `
    <tr style="background: ${bg};">
      ${cols.map((col, i) => `
        <td style="padding: 12px 16px; font-size: 13px; font-weight: ${weight}; color: ${i === cols.length - 1 && isTotal ? BRAND.success : color}; ${i === 0 ? 'text-align: left;' : 'text-align: right;'} ${!isHeader ? `border-bottom: 1px solid ${BRAND.darkBorder};` : ''}">${col}</td>
      `).join('')}
    </tr>
  `
}

/**
 * Data table wrapper
 */
export function dataTable(headerCols: string[], rows: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${BRAND.darkBorder}; border-radius: 8px; overflow: hidden; margin: 16px 0;">
      <thead>
        ${tableRow(headerCols, true)}
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `
}

// =============================================================================
// Pre-built Email Templates
// =============================================================================

/**
 * Invoice email template
 */
export function invoiceEmail(data: {
  buyerName: string
  periodStart: string
  periodEnd: string
  totalCalls: number
  totalRevenue: number
  campaigns: { name: string; calls: number; amount: number }[]
}): string {
  const formatMoney = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formatDate = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

  const periodLabel = `${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}`

  const campaignRows = data.campaigns.map(c =>
    tableRow([c.name, c.calls.toString(), formatMoney(c.amount)])
  ).join('')

  const content = `
    ${heading('Invoice', periodLabel)}

    ${text(`Hi ${data.buyerName},`)}
    ${text('Please find your invoice below for converted calls delivered during this period.')}

    ${highlightBox(`
      ${infoTable(`
        ${infoRow('Billing Period', periodLabel)}
        ${infoRow('Converted Calls', data.totalCalls.toString())}
      `)}
      ${divider()}
      ${amountDisplay('Total Due', formatMoney(data.totalRevenue), true)}
    `, 'lime')}

    <h3 style="margin: 24px 0 12px; font-size: 16px; font-weight: 600; color: ${BRAND.textPrimary};">Breakdown by Campaign</h3>

    ${dataTable(['Campaign', 'Calls', 'Amount'],
      campaignRows + tableRow(['Total', data.totalCalls.toString(), formatMoney(data.totalRevenue)], false, true)
    )}

    ${text('Payment can be remitted per the total shown. Reply to this email with any questions.', true)}
  `

  return emailWrapper(content, { preheader: `Invoice for ${periodLabel} - ${formatMoney(data.totalRevenue)} due` })
}

/**
 * Welcome / IO Executed email
 */
export function welcomeEmail(data: {
  vendorName: string
  contactName: string
  ioNumber: string
  campaigns: { name: string; payout: string }[]
}): string {
  const campaignList = data.campaigns.map(c =>
    `<li style="margin: 8px 0; color: ${BRAND.textPrimary};"><strong>${c.name}</strong> — <span style="color: ${BRAND.lime};">${c.payout}</span></li>`
  ).join('')

  const content = `
    ${heading('Welcome to GrovLabs! 🎉')}

    ${text(`Hey ${data.contactName || data.vendorName},`)}
    ${text('Your Insertion Order has been <strong style="color: ' + BRAND.success + ';">fully executed</strong>. You are now an active vendor partner.')}

    ${highlightBox(`
      ${infoTable(`
        ${infoRow('IO Number', data.ioNumber, true)}
        ${infoRow('Vendor', data.vendorName)}
        ${infoRow('Payment Terms', 'Bi-Weekly Net 15')}
        ${infoRow('Status', '✅ Active', true)}
      `)}
    `, 'success')}

    <h3 style="margin: 24px 0 12px; font-size: 16px; font-weight: 600; color: ${BRAND.textPrimary};">Your Campaigns</h3>
    <ul style="margin: 0; padding-left: 20px;">${campaignList}</ul>

    ${divider()}

    <h3 style="margin: 24px 0 12px; font-size: 16px; font-weight: 600; color: ${BRAND.textPrimary};">What's Next?</h3>
    ${text('Reach out so we can get your campaigns set up and provide you with DIDs and posting specs.')}

    ${highlightBox(`
      <p style="margin: 0 0 8px; font-weight: 600; color: ${BRAND.textPrimary};">UJ — CEO / Campaign Manager</p>
      ${infoTable(`
        ${infoRow('Email', BRAND.contactEmail)}
        ${infoRow('WhatsApp', BRAND.contactPhone)}
      `)}
    `, 'lime')}

    ${text('Looking forward to a great partnership!')}
  `

  return emailWrapper(content, { preheader: `Welcome! Your IO ${data.ioNumber} is now active.` })
}

/**
 * IO/Agreement signing request email
 */
export function signRequestEmail(data: {
  type: 'IO' | 'MSA'
  recipientName: string
  documentTitle: string
  signUrl: string
  expiresIn?: string
}): string {
  const typeLabel = data.type === 'IO' ? 'Insertion Order' : 'Master Service Agreement'

  const content = `
    ${heading(`Sign Your ${typeLabel}`)}

    ${text(`Hi ${data.recipientName},`)}
    ${text(`Please review and sign your <strong>${data.documentTitle}</strong> to proceed.`)}

    ${button(`Review & Sign ${data.type}`, data.signUrl)}

    ${data.expiresIn ? text(`This link expires in ${data.expiresIn}.`, true) : ''}

    ${divider()}

    ${text('If you have any questions about the terms, reply to this email and we\'ll be happy to help.', true)}
  `

  return emailWrapper(content, { preheader: `Action required: Sign your ${typeLabel}` })
}

/**
 * Application status email (approved/rejected)
 */
export function applicationStatusEmail(data: {
  vendorName: string
  status: 'approved' | 'rejected'
  reason?: string
  nextSteps?: string
}): string {
  const isApproved = data.status === 'approved'

  const content = `
    ${heading(isApproved ? 'Application Approved! 🎉' : 'Application Update')}

    ${text(`Hi ${data.vendorName},`)}

    ${isApproved
      ? text('Great news! Your vendor application has been <strong style="color: ' + BRAND.success + ';">approved</strong>.')
      : text('Thank you for your interest in partnering with GrovLabs. After careful review, we\'re unable to proceed with your application at this time.')
    }

    ${data.reason ? highlightBox(text(data.reason, true), isApproved ? 'success' : 'warning') : ''}

    ${data.nextSteps ? `
      ${divider()}
      <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: ${BRAND.textPrimary};">Next Steps</h3>
      ${text(data.nextSteps)}
    ` : ''}
  `

  return emailWrapper(content, { preheader: isApproved ? 'Your application has been approved!' : 'Update on your application' })
}

/**
 * Simple notification email
 */
export function notificationEmail(data: {
  title: string
  message: string
  ctaText?: string
  ctaUrl?: string
}): string {
  const content = `
    ${heading(data.title)}
    ${text(data.message)}
    ${data.ctaText && data.ctaUrl ? button(data.ctaText, data.ctaUrl) : ''}
  `

  return emailWrapper(content)
}
