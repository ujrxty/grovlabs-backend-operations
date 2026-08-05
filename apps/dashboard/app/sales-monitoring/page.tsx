import { DashboardShell } from '@/components/dashboard-shell'
import { SalesQAContent } from '@/components/sales-qa-content'

export const dynamic = 'force-dynamic'

export default function SalesMonitoringPage() {
  return (
    <DashboardShell>
      <SalesQAContent />
    </DashboardShell>
  )
}
