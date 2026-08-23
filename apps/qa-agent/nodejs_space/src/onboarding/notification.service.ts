import { Injectable, Logger } from '@nestjs/common';
import { EMAIL_CONFIG } from '../config/email.config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class OnboardingNotificationService {
  private readonly logger = new Logger(OnboardingNotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private async send(subject: string, html: string, _notifEnvVar: string, recipientEmail: string, replyTo?: string): Promise<boolean> {
    try {
      const result = await this.transporter.sendMail({
        from: `"${EMAIL_CONFIG.companyName}" <${process.env.SMTP_FROM_EMAIL || EMAIL_CONFIG.contactEmail}>`,
        to: recipientEmail,
        replyTo: replyTo || EMAIL_CONFIG.contactEmail,
        subject,
        html,
      });
      this.logger.log(`Email sent: ${subject} → ${recipientEmail} (${result.messageId})`);
      return true;
    } catch (error: any) {
      this.logger.error(`Email error: ${error.message}`);
      return false;
    }
  }

  // ---- Vendor-facing emails ----

  async sendApplicationReceived(
    email: string,
    contactName: string,
    companyName: string,
    campaignNames: string[],
    statusToken: string,
  ): Promise<boolean> {
    const statusUrl = new URL(`/onboarding/status/${statusToken}`, process.env.APP_ORIGIN || 'https://grovlabs.com').toString();
    const campaignList = campaignNames.map(c => `<li style="padding:4px 0;">${c}</li>`).join('');
    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="border-bottom:3px solid #1a1a1a;padding-bottom:16px;margin-bottom:24px;">
    <h2 style="margin:0;font-size:20px;font-weight:600;">Application Received</h2>
  </div>
  <p>Hi ${contactName},</p>
  <p>We've received your application from <b>${companyName}</b> for the following campaigns:</p>
  <ul style="background:#f8f9fa;padding:16px 16px 16px 32px;border-radius:6px;">${campaignList}</ul>
  <p>Our team reviews applications within <b>1-2 business days</b>. You'll receive an email once a decision has been made.</p>
  <p style="margin:24px 0;">
    <a href="${statusUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:500;">Check Application Status</a>
  </p>
  <p>Save this link to check your status anytime:<br/>
  <a href="${statusUrl}" style="color:#4a5568;">${statusUrl}</a></p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
  <p style="color:#718096;font-size:13px;">${EMAIL_CONFIG.companyName} — ${EMAIL_CONFIG.companyTagline}</p>
</div>`;
    return this.send(
      `Application Received — ${companyName}`,
      html,
      'NOTIF_ID_VENDOR_APPLICATION_RECEIVED',
      email,
    );
  }

  async sendApplicationApproved(
    email: string,
    contactName: string,
    campaignName: string,
    ioSignUrl: string,
  ): Promise<boolean> {
    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="border-bottom:3px solid #1a1a1a;padding-bottom:16px;margin-bottom:24px;">
    <h2 style="margin:0;font-size:20px;font-weight:600;">Application Approved</h2>
  </div>
  <p>Hi ${contactName},</p>
  <p>Your application for <b>${campaignName}</b> has been approved.</p>
  <p>To get started, please review and sign your Insertion Order:</p>
  <p style="margin:24px 0;">
    <a href="${ioSignUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:500;">Review &amp; Sign IO</a>
  </p>
  <p style="color:#718096;">Once signed, we'll finalize your account and send you your tracking number and getting started guide.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
  <p style="color:#718096;font-size:13px;">${EMAIL_CONFIG.companyName} — ${EMAIL_CONFIG.companyTagline}</p>
</div>`;
    return this.send(
      `Approved — ${campaignName}`,
      html,
      'NOTIF_ID_VENDOR_APPLICATION_APPROVED',
      email,
    );
  }

  async sendApplicationRejected(
    email: string,
    contactName: string,
    campaignName: string,
    reason: string,
  ): Promise<boolean> {
    const reasonMap: Record<string, string> = {
      traffic_type: 'The traffic sources listed do not match what this campaign requires.',
      low_volume: 'The estimated volume does not meet the minimum for this campaign at this time.',
      compliance: 'There are compliance concerns that need to be addressed before we can proceed.',
      duplicate: 'We already have an active application or vendor record for this company.',
      other: 'After review, we are unable to approve this application at this time.',
    };
    const reasonText = reasonMap[reason] || reason;
    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="border-bottom:3px solid #1a1a1a;padding-bottom:16px;margin-bottom:24px;">
    <h2 style="margin:0;font-size:20px;font-weight:600;">Application Update</h2>
  </div>
  <p>Hi ${contactName},</p>
  <p>Thank you for your interest in the <b>${campaignName}</b> campaign.</p>
  <p>After reviewing your application, we are unable to approve it at this time.</p>
  <div style="background:#f8f9fa;padding:16px;border-radius:6px;border-left:3px solid #718096;margin:16px 0;">
    <p style="margin:0;color:#4a5568;">${reasonText}</p>
  </div>
  <p>If your situation changes or you have questions, you're welcome to reach out to us directly.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
  <p style="color:#718096;font-size:13px;">${EMAIL_CONFIG.companyName} — ${EMAIL_CONFIG.companyTagline}</p>
</div>`;
    return this.send(
      `Application Update — ${campaignName}`,
      html,
      'NOTIF_ID_VENDOR_APPLICATION_REJECTED',
      email,
    );
  }

  async sendWelcomePackage(
    email: string,
    contactName: string,
    companyName: string,
    campaignName: string,
    trackingNumber: string | null,
    ioNumber: string,
  ): Promise<boolean> {
    const trackingSection = trackingNumber
      ? `<p><b>Tracking Number:</b> ${trackingNumber}</p>`
      : `<p><i>Your tracking number will be assigned shortly.</i></p>`;
    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="border-bottom:3px solid #1a1a1a;padding-bottom:16px;margin-bottom:24px;">
    <h2 style="margin:0;font-size:20px;font-weight:600;">Welcome to ${EMAIL_CONFIG.companyShortName} — You're All Set</h2>
  </div>
  <p>Hi ${contactName},</p>
  <p>Your Insertion Order (<b>${ioNumber}</b>) for <b>${campaignName}</b> is fully executed. You're ready to start sending traffic.</p>

  <div style="background:#f8f9fa;padding:20px;border-radius:6px;margin:20px 0;">
    <h3 style="margin:0 0 12px 0;font-size:16px;">Your Details</h3>
    <p><b>Company:</b> ${companyName}</p>
    <p><b>Campaign:</b> ${campaignName}</p>
    <p><b>IO Number:</b> ${ioNumber}</p>
    ${trackingSection}
  </div>

  <div style="background:#f8f9fa;padding:20px;border-radius:6px;margin:20px 0;">
    <h3 style="margin:0 0 12px 0;font-size:16px;">Getting Started</h3>
    <ol style="padding-left:20px;">
      <li style="padding:4px 0;">Place a <b>test call</b> to your tracking number to verify routing</li>
      <li style="padding:4px 0;">Confirm the call appears in your dashboard</li>
      <li style="padding:4px 0;">Begin sending live traffic</li>
    </ol>
  </div>

  <div style="background:#fff3cd;padding:16px;border-radius:6px;border-left:3px solid #f0ad4e;margin:20px 0;">
    <h3 style="margin:0 0 8px 0;font-size:14px;">Compliance Reminders</h3>
    <ul style="padding-left:20px;margin:0;font-size:13px;">
      <li>All calls must comply with TCPA regulations</li>
      <li>No cold transfers, robocalls, or auto-dialed calls</li>
      <li>Call quality is monitored — vendors with low conversion rates or compliance issues may be paused</li>
    </ul>
  </div>

  <p>Questions? Reply to this email and we'll get back to you.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
  <p style="color:#718096;font-size:13px;">${EMAIL_CONFIG.companyName} — ${EMAIL_CONFIG.companyTagline}</p>
</div>`;
    return this.send(
      `Welcome to ${EMAIL_CONFIG.companyShortName} — ${campaignName}`,
      html,
      'NOTIF_ID_IO_SIGNED_WELCOME_PACKAGE',
      email,
      EMAIL_CONFIG.contactEmail, // replies go to owner
    );
  }

  // Admin notification (backup to Telegram)
  async notifyAdminNewApplication(
    companyName: string,
    campaignNames: string[],
    email: string,
  ): Promise<boolean> {
    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <h2 style="margin:0 0 16px 0;font-size:18px;">New Vendor Application</h2>
  <p><b>${companyName}</b> applied for: ${campaignNames.join(', ')}</p>
  <p>Email: ${email}</p>
  <p>Review via Telegram or the admin API.</p>
</div>`;
    return this.send(
      `New Application — ${companyName}`,
      html,
      'NOTIF_ID_NEW_VENDOR_APPLICATION',
      EMAIL_CONFIG.contactEmail,
    );
  }
}
