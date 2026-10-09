import { DashboardShell } from '@/components/dashboard-shell'
import { NonConversionContent } from '@/components/non-conversion-content'

export const dynamic = 'force-dynamic'

export default function NonConversionQAPage() {
  return (
    <DashboardShell>
      <NonConversionContent />
    </DashboardShell>
  )
}
