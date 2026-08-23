import nodemailer from 'nodemailer';

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

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Force IPv4 to avoid ENETUNREACH on IPv6
    dnsOptions: { family: 4 },
    connectionTimeout: 30000,
    greetingTimeout: 15000,
  } as any);
}

export async function sendNotificationEmail(params: {
  notificationId?: string;
  subject: string;
  body: string;
  recipientEmail: string;
  replyTo?: string;
}) {
  try {
    const transporter = getTransporter();

    const result = await transporter.sendMail({
      from: `"${EMAIL_CONFIG.fromName}" <${EMAIL_CONFIG.fromEmail}>`,
      to: params.recipientEmail,
      replyTo: params.replyTo || EMAIL_CONFIG.fromEmail,
      subject: params.subject,
      html: params.body,
    });

    console.log('Email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
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
