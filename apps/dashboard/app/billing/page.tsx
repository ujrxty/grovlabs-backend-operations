import { DashboardShell } from '@/components/dashboard-shell'
import { BillingTabs } from '@/components/billing-tabs'

export default function BillingPage() {
  return (
    <DashboardShell>
      <BillingTabs />
    </DashboardShell>
  )
}
