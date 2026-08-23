import { prisma } from '@/lib/db'
import { PortalHeader } from '@/components/portal-header'
import { PortalFooter } from '@/components/portal-footer'
import { ApplicationForm } from './application-form'

export const dynamic = 'force-dynamic'

export default async function ApplyPage() {
  let campaigns: any[] = []
  try {
    const raw = await prisma.campaign.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
      select: { id: true, name: true, industry: true, call_type: true, payout: true, payout_display: true, payout_type: true },
    })
    campaigns = (raw ?? []).map((c: any) => ({
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
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Vendor Application
          </h1>
          <p className="mt-2 text-white/60">
            Complete the form below to apply for your selected campaigns. All fields marked with * are required.
          </p>
          <ApplicationForm campaigns={campaigns} />
        </div>
      </main>
      <PortalFooter />
    </div>
  )
}
