import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token is required" },
        { status: 400 }
      );
    }

    let apps = await prisma.vendor_application.findMany({
      where: { status_token: token },
      include: { campaign: { select: { name: true, industry: true } } },
      orderBy: { created_at: "asc" },
    });

    if (apps.length === 1 && apps[0].group_token) {
      apps = await prisma.vendor_application.findMany({
        where: { group_token: apps[0].group_token },
        include: { campaign: { select: { name: true, industry: true } } },
        orderBy: { created_at: "asc" },
      });
    }

    if (apps.length === 0) {
      apps = await prisma.vendor_application.findMany({
        where: { status_token: { startsWith: token } },
        include: { campaign: { select: { name: true, industry: true } } },
        orderBy: { created_at: "asc" },
      });
    }

    if (apps.length === 0) {
      return NextResponse.json(
        { success: false, error: "No application found for this token" },
        { status: 404 }
      );
    }

    const hasApproved = apps.some((a) => a.status === "approved");
    let ioData = null;
    let agreementData = null;

    if (hasApproved && apps[0].vendor_id) {
      const io = await prisma.insertion_order.findFirst({
        where: { vendor_id: apps[0].vendor_id },
        orderBy: { created_at: "desc" },
        select: {
          io_number: true,
          status: true,
          sign_token: true,
          vendor_signed_at: true,
          counter_signed_at: true,
        },
      });
      if (io) {
        ioData = io;
        const agreement = await prisma.lead_purchase_agreement.findFirst({
          where: { io_id: io.io_number },
          orderBy: { created_at: "desc" },
          select: {
            status: true,
            sign_token: true,
            vendor_signed_at: true,
            counter_signed_at: true,
          },
        });
        if (agreement) agreementData = agreement;
      }
    }

    return NextResponse.json({
      success: true,
      company_name: apps[0].company_name,
      contact_name: apps[0].contact_name,
      submitted_at: apps[0].created_at,
      applications: apps.map((a) => ({
        campaign: a.campaign.name,
        industry: a.campaign.industry,
        status: a.status,
        status_reason: a.status === "rejected" ? a.status_reason : undefined,
        reviewed_at: a.reviewed_at,
      })),
      io: ioData,
      agreement: agreementData,
    });
  } catch (error: any) {
    console.error("Status check error:", error?.message ?? error);
    return NextResponse.json(
      { success: false, error: "Failed to check status" },
      { status: 500 }
    );
  }
}
