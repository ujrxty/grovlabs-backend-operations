export async function sendNotificationEmail(params: {
  notificationId: string;
  subject: string;
  body: string;
  recipientEmail: string;
  replyTo?: string;
}) {
  const appUrl = process.env.NEXTAUTH_URL || '';
  let senderDomain = 'mail.abacusai.app';
  try {
    senderDomain = new URL(appUrl).hostname;
  } catch {}

  try {
    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: params.notificationId,
        subject: params.subject,
        body: params.body,
        is_html: true,
        recipient_email: params.recipientEmail,
        reply_to: params.replyTo,
        sender_email: `noreply@${senderDomain}`,
        sender_alias: EMAIL_CONFIG.companyName,
      }),
    });

    const result = await response.json();
    console.log('Email API response:', response.status, JSON.stringify(result));
    if (!result?.success && result?.notification_disabled) {
      console.log('Notification disabled, skipping email');
      return { success: true, disabled: true };
    }
    if (!result?.success) {
      console.error('Email API error:', JSON.stringify(result));
    }
    return result;
  } catch (error: any) {
    console.error('Email send error:', error?.message ?? error);
    return { success: false, error: error?.message ?? 'Unknown error' };
  }
}

// Email configuration - update these for your company
export const EMAIL_CONFIG = {
  companyName: 'The Broken Wood Inc',
  portalName: 'Vendor Portal',
  primaryColor: '#8b5a2b', // Copper/wood color
  secondaryColor: '#a0714f',
  accentColor: '#f5e6d3', // Light wood
  borderColor: '#e8d4c4',
}

export function emailTemplate(title: string, content: string) {
  const { companyName, portalName, primaryColor, secondaryColor, accentColor, borderColor } = EMAIL_CONFIG
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor}); padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">${companyName}</h1>
        <p style="color: ${accentColor}; margin: 4px 0 0 0; font-size: 13px;">${portalName}</p>
      </div>
      <div style="padding: 32px; border: 1px solid ${borderColor}; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0;">${title}</h2>
        ${content}
        <hr style="border: none; border-top: 1px solid ${borderColor}; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated message from ${companyName} ${portalName}. Please do not reply directly to this email.</p>
      </div>
    </div>
  `;
}
