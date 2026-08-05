'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Phone, MapPin, Clock, DollarSign, ChevronRight, CheckCircle2, Briefcase, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

interface Campaign {
  id: string
  name: string
  industry: string
  call_type: string
  payout: string
  payout_display: string | null
  payout_type: string
  geographic_focus: string | null
  min_duration: number | null
  requirements: string | null
  description: string | null
}

export function CampaignListing({ campaigns }: { campaigns: Campaign[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const router = useRouter()

  const toggleCampaign = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleApply = () => {
    if (selected.size === 0) return
    const ids = Array.from(selected).join(',')
    router.push(`/apply?campaigns=${ids}`)
  }

  const formatPayoutType = (type: string) => {
    const map: Record<string, string> = {
      per_conversion: 'Per Conversion',
      per_call: 'Per Call',
      per_qualified_call: 'Per Qualified Call',
    }
    return map[type ?? ''] ?? type ?? ''
  }

  const safeCampaigns = campaigns ?? []

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-12">
      {safeCampaigns.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase className="h-12 w-12 text-purple-300 mx-auto mb-4" />
          <p className="text-gray-500">No active campaigns at this time. Please check back later.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {safeCampaigns.map((campaign: Campaign, index: number) => {
              const isSelected = selected.has(campaign?.id ?? '')
              return (
                <motion.div
                  key={campaign?.id ?? index}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  onClick={() => toggleCampaign(campaign?.id ?? '')}
                  className={cn(
                    'relative cursor-pointer rounded-xl p-5 transition-all duration-200',
                    'border-2',
                    isSelected
                      ? 'border-purple-500 bg-purple-50/60 shadow-md'
                      : 'border-gray-100 bg-white hover:border-purple-200 hover:shadow-sm'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                      isSelected ? 'border-purple-600 bg-purple-600' : 'border-gray-300'
                    )}>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-semibold text-gray-900 text-base">{campaign?.name ?? 'Campaign'}</h3>
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                          {campaign?.industry ?? ''}
                        </span>
                      </div>
                      {campaign?.description && (
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{campaign.description}</p>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Phone className="h-3.5 w-3.5 text-purple-500" />
                          <span>{campaign?.call_type ?? ''}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <DollarSign className="h-3.5 w-3.5 text-green-600" />
                          <span className="font-medium text-green-700">{(campaign?.name ?? '').toLowerCase().includes('rtb') ? 'Variable' : (campaign?.payout_display ?? `$${campaign?.payout ?? '0'}`)}</span>
                          <span className="text-xs text-gray-400">{formatPayoutType(campaign?.payout_type ?? '')}</span>
                        </div>
                        {campaign?.geographic_focus && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <MapPin className="h-3.5 w-3.5 text-purple-500" />
                            <span>{campaign.geographic_focus}</span>
                          </div>
                        )}
                        {campaign?.min_duration != null && (campaign?.min_duration ?? 0) > 0 && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Clock className="h-3.5 w-3.5 text-purple-500" />
                            <span>{campaign.min_duration}s min duration</span>
                          </div>
                        )}
                      </div>
                      {campaign?.requirements && (
                        <p className="mt-2 text-xs text-gray-500 line-clamp-2">
                          <span className="font-medium text-gray-600">Requirements:</span> {campaign.requirements}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Sticky bottom bar */}
          <div className={cn(
            'fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 bg-white border-t border-purple-100 shadow-lg',
            selected.size > 0 ? 'translate-y-0' : 'translate-y-full'
          )}>
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-purple-700">{selected.size}</span> campaign{selected.size !== 1 ? 's' : ''} selected
              </p>
              <button
                onClick={handleApply}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 transition-colors shadow-md"
              >
                Apply Now <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
