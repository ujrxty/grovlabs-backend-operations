import { PortalHeader } from '@/components/portal-header'
import { PortalFooter } from '@/components/portal-footer'
import { N2NApplicationForm } from './n2n-application-form'

export const dynamic = 'force-dynamic'

export default function N2NApplyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#050505]">
      <PortalHeader />
      <main className="flex-1">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Network Partnership Application
          </h1>
          <p className="mt-2 text-white/60">
            Apply to become a GrovLabs network partner. Buy and sell quality leads through our marketplace.
          </p>
          <N2NApplicationForm />
        </div>
      </main>
      <PortalFooter />
    </div>
  )
}
