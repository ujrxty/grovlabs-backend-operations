export const dynamic = 'force-dynamic'

import { AgreementSigningFlow } from './agreement-signing-flow'

export default function AgreementSignPage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#b87333]/5/50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-gray-900">Lead Purchase Agreement</h1>
          <p className="mt-2 text-gray-500">The Broken Wood Inc — Vendor Portal</p>
        </div>
        <AgreementSigningFlow token={params?.token ?? ''} />
      </div>
    </div>
  )
}
