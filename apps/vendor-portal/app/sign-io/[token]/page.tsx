import { PortalHeader } from '@/components/portal-header'
import { PortalFooter } from '@/components/portal-footer'
import { IoSigningFlow } from './io-signing-flow'

export const dynamic = 'force-dynamic'

export default function SignIOPage({ params }: { params: { token: string } }) {
  const token = params?.token ?? ''
  return (
    <div className="min-h-screen flex flex-col bg-[#050505]">
      <PortalHeader />
      <main className="flex-1">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <IoSigningFlow token={token} />
        </div>
      </main>
      <PortalFooter />
    </div>
  )
}
