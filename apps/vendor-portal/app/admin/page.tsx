export const dynamic = 'force-dynamic'

import { AdminCampaignManager } from './admin-campaign-manager'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <AdminCampaignManager />
      </div>
    </div>
  )
}
