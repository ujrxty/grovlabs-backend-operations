export const dynamic = 'force-dynamic'

import { PortalHeader } from '@/components/portal-header'
import { PortalFooter } from '@/components/portal-footer'
import { AgreementSigningFlow } from './agreement-signing-flow'

export default function AgreementSignPage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#050505]">
      <PortalHeader />
      <main className="flex-1">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="mb-8 text-center">
            <h1 className="font-display text-3xl font-bold text-[#a3e635]">Lead Purchase Agreement</h1>
            <p className="mt-2 text-white/60">GrovLabs Inc — Vendor Portal</p>
          </div>
          <AgreementSigningFlow token={params?.token ?? ''} />
        </div>
      </main>
      <PortalFooter />
    </div>
  )
}
