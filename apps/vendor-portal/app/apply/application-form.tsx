'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2, AlertCircle, Building2, User, Mail, Phone, Globe, MessageSquare, ChevronDown, MapPin, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Ireland', 'Australia', 'New Zealand',
  'Netherlands', 'Germany', 'France', 'Spain', 'Portugal', 'Italy', 'Belgium', 'Luxembourg',
  'Switzerland', 'Austria', 'Denmark', 'Sweden', 'Norway', 'Finland', 'Iceland',
  'Poland', 'Czech Republic', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria', 'Greece',
  'Croatia', 'Slovenia', 'Estonia', 'Latvia', 'Lithuania', 'Ukraine',
  'Israel', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Turkey',
  'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Singapore', 'Malaysia', 'Philippines',
  'Indonesia', 'Thailand', 'Vietnam', 'Japan', 'South Korea', 'China', 'Hong Kong', 'Taiwan',
  'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Costa Rica', 'Panama',
  'South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Morocco', 'Ghana',
  'Other',
]

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia',
]

interface Campaign {
  id: string
  name: string
  industry: string
  call_type: string
  payout: string
  payout_display: string | null
  payout_type: string
}

export function ApplicationForm({ campaigns }: { campaigns: Campaign[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [statusToken, setStatusToken] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    estimated_volume: '',
    experience: '',
    company_address: '',
    company_country: 'United States',
    company_state: '',
    entity_type: '',
    referred_by: '',
    comments: '',
    tcpa_agreed: false,
    terms_agreed: false,
  })

  useEffect(() => {
    const campaignIds = searchParams?.get?.('campaigns') ?? ''
    if (campaignIds) {
      const ids = campaignIds.split(',').filter(Boolean)
      setSelectedCampaigns(new Set(ids))
    }
  }, [searchParams])

  const toggleCampaign = (id: string) => {
    setSelectedCampaigns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...(prev ?? {}), [field]: value }))
    setErrors((prev) => {
      const next = { ...(prev ?? {}) }
      delete next[field]
      return next
    })
  }

  const isUS = (form?.company_country ?? '') === 'United States'

  // Reset state and entity type when switching between US and non-US so stale
  // US-specific dropdown values don't linger for international companies.
  const handleCountryChange = (value: string) => {
    setForm((prev) => ({ ...(prev ?? {}), company_country: value, company_state: '', entity_type: '' }))
    setErrors((prev) => {
      const next = { ...(prev ?? {}) }
      delete next.company_country
      delete next.company_state
      delete next.entity_type
      return next
    })
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (selectedCampaigns.size === 0) errs.campaigns = 'Select at least one campaign'
    if (!form?.company_name?.trim?.()) errs.company_name = 'Company name is required'
    if (!form?.contact_name?.trim?.()) errs.contact_name = 'Contact name is required'
    if (!form?.email?.trim?.() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form?.email ?? '')) errs.email = 'Valid email is required'
    if (!form?.phone?.trim?.()) errs.phone = 'Phone number is required'
    if (!form?.estimated_volume) errs.estimated_volume = 'Estimated volume is required'
    if (!form?.company_address?.trim?.()) errs.company_address = 'Company address is required'
    if (!form?.company_country?.trim?.()) errs.company_country = 'Country is required'
    if (!form?.company_state?.trim?.()) errs.company_state = isUS ? 'Company state is required' : 'State / province / region is required'
    if (!form?.entity_type?.trim?.()) errs.entity_type = 'Entity type is required'
    if (!form?.tcpa_agreed) errs.tcpa_agreed = 'TCPA compliance agreement is required'
    if (!form?.terms_agreed) errs.terms_agreed = 'Terms agreement is required'
    setErrors(errs)
    return Object.keys(errs ?? {}).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    if (!validate()) {
      toast.error('Please fix the errors below')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(form ?? {}),
          campaign_ids: Array.from(selectedCampaigns),
        }),
      })
      const data = await res.json()
      if (data?.success) {
        setSubmitted(true)
        setStatusToken(data?.status_token ?? '')
        toast.success('Application submitted successfully!')
      } else {
        toast.error(data?.error ?? 'Failed to submit application')
      }
    } catch (err: any) {
      console.error('Submit error:', err?.message ?? err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mt-8 rounded-xl bg-[#a3e635]/10 border border-[#c4ff00]/30 p-8 text-center"
      >
        <CheckCircle2 className="h-16 w-16 text-[#c4ff00] mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold text-white">Application Submitted!</h2>
        <p className="mt-3 text-white/70">Your application has been received and is being reviewed.</p>
        <div className="mt-6 rounded-lg bg-[#0a0a0a] border border-white/10 p-4 inline-block">
          <p className="text-sm text-white/50">Your Status Token</p>
          <p className="font-mono text-lg font-bold text-[#c4ff00] mt-1">{statusToken}</p>
        </div>
        <p className="mt-4 text-sm text-white/60">
          Save this token to check your application status anytime.
          A confirmation email has been sent to your email address.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={() => router.push(`/status?token=${statusToken}`)}
            className="rounded-lg bg-[#a3e635] px-6 py-2.5 text-sm font-semibold text-[#050505] hover:bg-[#bef264] transition-colors"
          >
            Check Status
          </button>
          <button
            onClick={() => router.push('/')}
            className="rounded-lg border border-white/20 px-6 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5 transition-colors"
          >
            Back to Campaigns
          </button>
        </div>
      </motion.div>
    )
  }

  const safeCampaigns = campaigns ?? []

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      {/* Campaign Selection */}
      <div>
        <h3 className="font-display font-semibold text-white mb-3">Selected Campaigns *</h3>
        {errors?.campaigns && <p className="text-sm text-red-600 mb-2 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.campaigns}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {safeCampaigns.map((c: Campaign) => {
            const isSelected = selectedCampaigns.has(c?.id ?? '')
            return (
              <div
                key={c?.id}
                onClick={() => toggleCampaign(c?.id ?? '')}
                className={cn(
                  'cursor-pointer rounded-lg border-2 p-3 transition-all text-sm',
                  isSelected
                    ? 'border-[#c4ff00]/50 bg-[#a3e635]/5'
                    : 'border-white/[0.08] hover:border-[#c4ff00]/20'
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
                    isSelected ? 'border-[#c4ff00] bg-[#a3e635]' : 'border-white/20'
                  )}>
                    {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                  <span className="font-medium text-white">{c?.name ?? ''}</span>
                  <span className="text-xs text-[#c4ff00] ml-auto">{(c?.name ?? '').toLowerCase().includes('rtb') ? 'Variable' : (c?.payout_display ?? `$${c?.payout ?? '0'}`)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Company Information */}
      <div className="space-y-4">
        <h3 className="font-display font-semibold text-white">Company Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Company Name *</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={form?.company_name ?? ''}
                onChange={(e: any) => updateField('company_name', e?.target?.value ?? '')}
                className={cn('w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50', errors?.company_name ? 'border-red-300' : 'border-white/10 bg-[#0a0a0a] text-white')}
                placeholder="Your company name"
              />
            </div>
            {errors?.company_name && <p className="text-xs text-red-600 mt-1">{errors.company_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Contact Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={form?.contact_name ?? ''}
                onChange={(e: any) => updateField('contact_name', e?.target?.value ?? '')}
                className={cn('w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50', errors?.contact_name ? 'border-red-300' : 'border-white/10 bg-[#0a0a0a] text-white')}
                placeholder="Primary contact name"
              />
            </div>
            {errors?.contact_name && <p className="text-xs text-red-600 mt-1">{errors.contact_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Email *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="email"
                value={form?.email ?? ''}
                onChange={(e: any) => updateField('email', e?.target?.value ?? '')}
                className={cn('w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50', errors?.email ? 'border-red-300' : 'border-white/10 bg-[#0a0a0a] text-white')}
                placeholder="contact@company.com"
              />
            </div>
            {errors?.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Phone *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="tel"
                value={form?.phone ?? ''}
                onChange={(e: any) => updateField('phone', e?.target?.value ?? '')}
                className={cn('w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50', errors?.phone ? 'border-red-300' : 'border-white/10 bg-[#0a0a0a] text-white')}
                placeholder="(555) 123-4567"
              />
            </div>
            {errors?.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Website</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="url"
                value={form?.website ?? ''}
                onChange={(e: any) => updateField('website', e?.target?.value ?? '')}
                className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] text-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50"
                placeholder="https://yourcompany.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Estimated Call Volume/Day *</label>
            <div className="relative">
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              <select
                value={form?.estimated_volume ?? ''}
                onChange={(e: any) => updateField('estimated_volume', e?.target?.value ?? '')}
                className={cn('w-full rounded-lg border px-3 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50', errors?.estimated_volume ? 'border-red-300' : 'border-white/10 bg-[#0a0a0a] text-white')}
              >
                <option value="">Select volume...</option>
                <option value="5-10">5-10 calls/day</option>
                <option value="15-50">15-50 calls/day</option>
                <option value="50-100">50-100 calls/day</option>
                <option value="100+">100+ calls/day</option>
              </select>
            </div>
            {errors?.estimated_volume && <p className="text-xs text-red-600 mt-1">{errors.estimated_volume}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Company Address *</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-white/40" />
            <input
              type="text"
              value={form?.company_address ?? ''}
              onChange={(e: any) => updateField('company_address', e?.target?.value ?? '')}
              className={cn('w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50', errors?.company_address ? 'border-red-300' : 'border-white/10 bg-[#0a0a0a] text-white')}
              placeholder={isUS ? '123 Main St, Suite 200, Phoenix, AZ 85001' : 'Street, city, postal code'}
            />
          </div>
          {errors?.company_address && <p className="text-xs text-red-600 mt-1">{errors.company_address}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Country *</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              <select
                value={form?.company_country ?? ''}
                onChange={(e: any) => handleCountryChange(e?.target?.value ?? '')}
                className={cn('w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50', errors?.company_country ? 'border-red-300' : 'border-white/10 bg-[#0a0a0a] text-white')}
              >
                <option value="">Select country...</option>
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
            {errors?.company_country && <p className="text-xs text-red-600 mt-1">{errors.company_country}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">{isUS ? 'Company State *' : 'State / Province / Region *'}</label>
            {isUS ? (
              <div className="relative">
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
                <select
                  value={form?.company_state ?? ''}
                  onChange={(e: any) => updateField('company_state', e?.target?.value ?? '')}
                  className={cn('w-full rounded-lg border px-3 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50', errors?.company_state ? 'border-red-300' : 'border-white/10 bg-[#0a0a0a] text-white')}
                >
                  <option value="">Select state...</option>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            ) : (
              <input
                type="text"
                value={form?.company_state ?? ''}
                onChange={(e: any) => updateField('company_state', e?.target?.value ?? '')}
                className={cn('w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50', errors?.company_state ? 'border-red-300' : 'border-white/10 bg-[#0a0a0a] text-white')}
                placeholder="Province / region (e.g. North Holland)"
              />
            )}
            {errors?.company_state && <p className="text-xs text-red-600 mt-1">{errors.company_state}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Entity Type *</label>
          {isUS ? (
            <div className="relative">
              <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              <select
                value={form?.entity_type ?? ''}
                onChange={(e: any) => updateField('entity_type', e?.target?.value ?? '')}
                className={cn('w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50', errors?.entity_type ? 'border-red-300' : 'border-white/10 bg-[#0a0a0a] text-white')}
              >
                <option value="">Select entity type...</option>
                <option value="LLC">LLC</option>
                <option value="Corporation">Corporation</option>
                <option value="Sole Proprietorship">Sole Proprietorship</option>
                <option value="Partnership">Partnership</option>
                <option value="LLP">LLP</option>
              </select>
            </div>
          ) : (
            <div className="relative">
              <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={form?.entity_type ?? ''}
                onChange={(e: any) => updateField('entity_type', e?.target?.value ?? '')}
                className={cn('w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50', errors?.entity_type ? 'border-red-300' : 'border-white/10 bg-[#0a0a0a] text-white')}
                placeholder="Legal entity type (e.g. B.V., GmbH, Ltd, S.A., Pty Ltd)"
              />
            </div>
          )}
          <p className="text-xs text-white/40 mt-1">{isUS ? 'The legal structure of your company.' : 'Enter your local legal entity type as registered (e.g. B.V. in the Netherlands, GmbH in Germany, Ltd in the UK).'}</p>
          {errors?.entity_type && <p className="text-xs text-red-600 mt-1">{errors.entity_type}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Experience / Background</label>
          <textarea
            value={form?.experience ?? ''}
            onChange={(e: any) => updateField('experience', e?.target?.value ?? '')}
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50"
            placeholder="Brief description of your experience in lead generation or call center operations..."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Referred By</label>
            <input
              type="text"
              value={form?.referred_by ?? ''}
              onChange={(e: any) => updateField('referred_by', e?.target?.value ?? '')}
              className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50"
              placeholder="Who referred you?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Additional Comments</label>
            <input
              type="text"
              value={form?.comments ?? ''}
              onChange={(e: any) => updateField('comments', e?.target?.value ?? '')}
              className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50"
              placeholder="Anything else we should know?"
            />
          </div>
        </div>
      </div>

      {/* Compliance */}
      <div className="space-y-3">
        <h3 className="font-display font-semibold text-white">Compliance Agreements</h3>
        <div className={cn('flex items-start gap-3 rounded-lg border p-4', errors?.tcpa_agreed ? 'border-red-300 bg-red-50' : 'border-white/10 bg-[#0a0a0a] text-white')}>
          <input
            type="checkbox"
            checked={form?.tcpa_agreed ?? false}
            onChange={(e: any) => updateField('tcpa_agreed', e?.target?.checked ?? false)}
            className="mt-0.5 h-4 w-4 rounded border-white/20 text-[#c4ff00] focus:ring-[#a3e635]/50"
          />
          <div>
            <p className="text-sm font-medium text-white">TCPA Compliance *</p>
            <p className="text-xs text-white/50 mt-0.5">I agree to comply with all TCPA regulations, FCC guidelines, and applicable state/federal laws regarding telemarketing and lead generation.</p>
          </div>
        </div>
        {errors?.tcpa_agreed && <p className="text-xs text-red-600">{errors.tcpa_agreed}</p>}
        <div className={cn('flex items-start gap-3 rounded-lg border p-4', errors?.terms_agreed ? 'border-red-300 bg-red-50' : 'border-white/10 bg-[#0a0a0a] text-white')}>
          <input
            type="checkbox"
            checked={form?.terms_agreed ?? false}
            onChange={(e: any) => updateField('terms_agreed', e?.target?.checked ?? false)}
            className="mt-0.5 h-4 w-4 rounded border-white/20 text-[#c4ff00] focus:ring-[#a3e635]/50"
          />
          <div>
            <p className="text-sm font-medium text-white">Terms & Conditions *</p>
            <p className="text-xs text-white/50 mt-0.5">I acknowledge that all information provided is accurate and agree to GrovLabs Inc&apos;s vendor terms and conditions.</p>
          </div>
        </div>
        {errors?.terms_agreed && <p className="text-xs text-red-600">{errors.terms_agreed}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-[#a3e635] px-6 py-3 text-sm font-semibold text-white hover:bg-[#bef264] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
        ) : (
          'Submit Application'
        )}
      </button>
    </form>
  )
}
