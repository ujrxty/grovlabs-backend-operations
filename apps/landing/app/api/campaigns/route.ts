import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: "asc" }, { industry: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        industry: true,
        call_type: true,
        description: true,
        payout: true,
        payout_display: true,
        payout_type: true,
        billing_cycle: true,
        min_duration: true,
        geographic_focus: true,
        allowed_traffic: true,
        restricted_traffic: true,
        requirements: true,
        compliance_notes: true,
      },
    });

    const serialized = campaigns.map((c) => ({
      ...c,
      payout: c.payout?.toString() ?? "0",
    }));

    return NextResponse.json({ campaigns: serialized });
  } catch (error: any) {
    console.error("Failed to fetch campaigns:", error?.message ?? error);
    return NextResponse.json({ campaigns: [] });
  }
}
