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
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-12 pb-8 sm:pt-16 sm:pb-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#c4ff00]/25 bg-[#c4ff00]/[0.06] px-3 py-1 text-xs font-medium text-[#c4ff00]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c4ff00] animate-pulse" /> Caps open · live from our network
            </p>
            <h1 className="mt-4 font-display text-3xl sm:text-5xl font-bold tracking-tight text-white">
              Send calls. <span className="text-[#c4ff00]">Get paid every two weeks.</span>
            </h1>
            <p className="mt-3 text-base sm:text-lg text-white/60 max-w-2xl">
              Every campaign below is running right now. Pick the ones that fit your traffic and apply in a few minutes.
            </p>
            <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07]">
              {[
                [String(campaigns.length), 'Live campaigns'],
                [String(new Set(campaigns.map((c: any) => c.industry)).size), 'Verticals'],
                ['Net 15', 'Paid biweekly'],
                ['Per call', 'Reporting'],
              ].map(([v, l]) => (
                <div key={l} className="bg-[#070707] px-4 py-3.5">
                  <p className="font-display text-xl sm:text-2xl font-bold text-white">{v}</p>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-white/40">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <CampaignListing campaigns={campaigns} />
      </main>
      <PortalFooter />
    </div>
  )
}
