import { DashboardShell } from '@/components/dashboard-shell'
import { SchedulerSettingsContent } from '@/components/scheduler-settings-content'

export default function SchedulerPage() {
  return (
    <DashboardShell>
      <SchedulerSettingsContent />
    </DashboardShell>
  )
}
