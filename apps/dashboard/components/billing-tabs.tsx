'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { BillingContent } from '@/components/billing-content'
import { BuyerBillingContent } from '@/components/buyer-billing-content'
import { cn } from '@/lib/utils'
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react'

type Tab = 'vendors' | 'buyers'

export function BillingTabs() {
  const [tab, setTab] = useState<Tab>('vendors')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description={
          tab === 'vendors'
            ? 'Generate vendor payout reports for a custom date range'
            : 'Generate buyer invoices for a custom date range'
        }
      />

      {/* Tab switcher */}
      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        <button
          onClick={() => setTab('vendors')}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            tab === 'vendors'
              ? 'bg-background text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <ArrowUpRight className="h-4 w-4" />
          Vendor Payouts
        </button>
        <button
          onClick={() => setTab('buyers')}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            tab === 'buyers'
              ? 'bg-background text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <ArrowDownLeft className="h-4 w-4" />
          Buyer Invoices
        </button>
      </div>

      {tab === 'vendors' ? <BillingContent /> : <BuyerBillingContent />}
    </div>
  )
}
