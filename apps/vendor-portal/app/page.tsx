import { prisma } from '@/lib/db'
import { PortalHeader } from '@/components/portal-header'
import { PortalFooter } from '@/components/portal-footer'
import { CampaignListing } from './campaign-listing'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let campaigns: any[] = []
  try {
    campaigns = await prisma.campaign.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    })
    // Convert Decimal to string for serialization
    campaigns = (campaigns ?? []).map((c: any) => ({
      ...(c ?? {}),
      payout: c?.payout?.toString?.() ?? '0',
    }))
  } catch (e: any) {
    console.error('Failed to fetch campaigns:', e?.message ?? e)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#050505]">
      <PortalHeader />
      <main className="flex-1">
        <div className="hero-gradient">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Partner with <span className="text-[#c4ff00]">GrovLabs</span>
            </h1>
            <p className="mt-3 text-lg text-white/60 max-w-2xl">
              Browse our available campaigns and apply to become a vendor partner. Select one or more campaigns below to get started.
            </p>
          </div>
        </div>
        <CampaignListing campaigns={campaigns} />
      </main>
      <PortalFooter />
    </div>
  )
}
