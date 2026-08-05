import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendNotificationEmail, emailTemplate } from "@/lib/email";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company_name,
      contact_name,
      email,
      phone,
      website,
      estimated_volume,
      experience,
      company_address,
      company_country,
      company_state,
      entity_type,
      referred_by,
      comments,
      tcpa_agreed,
      terms_agreed,
      campaign_ids,
    } = body;

    if (
      !company_name?.trim() ||
      !contact_name?.trim() ||
      !email?.trim() ||
      !phone?.trim() ||
      !campaign_ids?.length
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!tcpa_agreed || !terms_agreed) {
      return NextResponse.json(
        {
          success: false,
          error: "You must agree to TCPA compliance and terms",
        },
        { status: 400 }
      );
    }

    const campaigns = await prisma.campaign.findMany({
      where: { id: { in: campaign_ids }, is_active: true },
    });

    if (campaigns.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid campaigns selected" },
        { status: 400 }
      );
    }

    const groupToken = randomBytes(8).toString("hex");
    const statusToken = randomBytes(6).toString("hex");

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const applications = [];
    for (let i = 0; i < campaigns.length; i++) {
      const campaign = campaigns[i];
      const app = await prisma.vendor_application.create({
        data: {
          company_name: company_name.trim(),
          contact_name: contact_name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          website: website?.trim() || null,
          traffic_types: estimated_volume || "Not specified",
          estimated_volume: estimated_volume?.trim() || null,
          experience: experience?.trim() || null,
          company_address: company_address?.trim() || null,
          company_country: company_country?.trim() || null,
          company_state: company_state?.trim() || null,
          entity_type: entity_type?.trim() || null,
          referred_by: referred_by?.trim() || null,
          comments: comments?.trim() || null,
          campaign_id: campaign.id,
          tcpa_agreed,
          terms_agreed,
          agreed_ip: ip,
          agreed_at: new Date(),
          status_token:
            campaigns.length > 1 ? `${statusToken}-${i + 1}` : statusToken,
          group_token: groupToken,
        },
        include: { campaign: true },
      });
      applications.push(app);
    }

    const firstStatusToken = applications[0]?.status_token || statusToken;
    const campaignNames = campaigns.map((c) => c.name).join(", ");
    const subjectCampaigns =
      campaigns.length > 3
        ? `${campaigns
            .slice(0, 3)
            .map((c) => c.name)
            .join(", ")} + ${campaigns.length - 3} more`
        : campaignNames;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const vendorContent = `
      <p style="color: #374151; line-height: 1.6;">Thank you for submitting your vendor application to The Broken Wood Inc.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 6px 0; color: #374151;"><strong>Company:</strong> ${company_name}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Campaign(s):</strong> ${campaignNames}</p>
        <p style="margin: 6px 0; color: #374151;"><strong>Status Token:</strong> <span style="font-family: monospace; background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-weight: bold; color: #8b5a2b;">${firstStatusToken}</span></p>
      </div>
      <p style="color: #374151;">You can check your application status anytime using the link below:</p>
      <p><a href="${appUrl}/status?token=${firstStatusToken}" style="color: #8b5a2b; font-weight: 600;">Check Application Status</a></p>
    `;

    await sendNotificationEmail({
      notificationId:
        process.env.NOTIF_ID_APPLICATION_RECEIVED_VENDOR_CONFIRMATION ?? "",
      subject: `Application Received — ${subjectCampaigns} — The Broken Wood Inc`,
      body: emailTemplate("Application Received", vendorContent),
      recipientEmail: email.trim().toLowerCase(),
    });

    console.log(
      `New application: ${company_name} for ${campaignNames} (${applications.length} campaigns)`
    );

    return NextResponse.json({
      success: true,
      status_token: firstStatusToken,
      campaigns_applied: campaigns.map((c) => c.name),
      application_count: applications.length,
    });
  } catch (error: any) {
    console.error("Application submission error:", error?.message ?? error);
    return NextResponse.json(
      { success: false, error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
