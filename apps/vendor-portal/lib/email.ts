import { Resend } from 'resend';

// Email configuration for GrovLabs
export const EMAIL_CONFIG = {
  companyName: 'GrovLabs Inc',
  portalName: 'Vendor Portal',
  primaryColor: '#c4ff00',
  secondaryColor: '#a8d900',
  accentColor: '#1a1a1a',
  borderColor: '#e5e5e5',
  fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@grovlabs.com',
  fromName: process.env.SMTP_FROM_NAME || 'GrovLabs',
}

export async function sendNotificationEmail(params: {
  notificationId?: string;
  subject: string;
  body: string;
  recipientEmail: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log('RESEND_API_KEY not set, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: `${EMAIL_CONFIG.fromName} <onboarding@resend.dev>`,
      to: params.recipientEmail,
      replyTo: params.replyTo || EMAIL_CONFIG.fromEmail,
      subject: params.subject,
      html: params.body,
    });

    if (error) {
      console.error('Email send error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('Email sent:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('Email send error:', error?.message ?? error);
    return { success: false, error: error?.message ?? 'Unknown error' };
  }
}

export function emailTemplate(title: string, content: string) {
  const { companyName, portalName, primaryColor, accentColor, borderColor } = EMAIL_CONFIG
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: ${accentColor}; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: ${primaryColor}; margin: 0; font-size: 20px; font-weight: 600;">${companyName}</h1>
        <p style="color: #ffffff; margin: 4px 0 0 0; font-size: 13px; opacity: 0.7;">${portalName}</p>
      </div>
      <div style="padding: 32px; border: 1px solid ${borderColor}; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0;">${title}</h2>
        ${content}
        <hr style="border: none; border-top: 1px solid ${borderColor}; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated message from ${companyName}. Please do not reply directly to this email.</p>
      </div>
    </div>
  `;
}
