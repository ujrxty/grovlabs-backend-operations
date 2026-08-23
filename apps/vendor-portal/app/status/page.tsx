import { PortalHeader } from '@/components/portal-header'
import { PortalFooter } from '@/components/portal-footer'
import { StatusChecker } from './status-checker'

export const dynamic = 'force-dynamic'

export default function StatusPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#050505]">
      <PortalHeader />
      <main className="flex-1">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Check Application Status
          </h1>
          <p className="mt-2 text-white/60">
            Enter the status token you received when you submitted your application.
          </p>
          <StatusChecker />
        </div>
      </main>
      <PortalFooter />
    </div>
  )
}
