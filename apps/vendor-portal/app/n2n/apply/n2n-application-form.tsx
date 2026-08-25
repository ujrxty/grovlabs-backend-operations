'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2, Building2, User, Mail, Phone, Globe, MapPin } from 'lucide-react'
import { toast } from 'sonner'

const VERTICALS = [
  'Medicare',
  'ACA / Health Insurance',
  'Final Expense',
  'Auto Insurance',
  'Home Services',
  'Solar',
  'Debt',
  'Legal',
  'Other',
]

const VOLUME_OPTIONS = [
  'Under 50',
  '50-100',
  '100-500',
  '500-1000',
  '1000+',
]

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

export function N2NApplicationForm() {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    company_name: '',
    organized_in: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    address_line1: '',
    address_line2: '',
    website: '',
    wants_to_buy: false,
    wants_to_sell: false,
    verticals: [] as string[],
    estimated_volume: '',
    traffic_sources: '',
    current_partners: '',
    comments: '',
    referred_by: '',
    terms_agreed: false,
  })

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const toggleVertical = (v: string) => {
    setForm((prev) => ({
      ...prev,
      verticals: prev.verticals.includes(v)
        ? prev.verticals.filter((x) => x !== v)
        : [...prev.verticals, v],
    }))
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.company_name.trim()) errs.company_name = 'Company name is required'
    if (!form.contact_name.trim()) errs.contact_name = 'Contact name is required'
    if (!form.contact_email.trim()) errs.contact_email = 'Email is required'
    if (!form.contact_phone.trim()) errs.contact_phone = 'Phone is required'
    if (!form.wants_to_buy && !form.wants_to_sell) errs.direction = 'Select at least one: buy or sell'
    if (!form.terms_agreed) errs.terms_agreed = 'You must agree to the terms'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      toast.error('Please fix the errors above')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${QA_AGENT_URL}/n2n/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          verticals: form.verticals.join(', '),
          agreed_ip: 'client',
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to submit application')
      }

      setSubmitted(true)
      toast.success('Application submitted successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mt-8 rounded-xl bg-white/5 border border-white/10 p-8 text-center">
        <CheckCircle2 className="w-16 h-16 text-lime-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Application Submitted</h2>
        <p className="text-white/60">
          Thank you for your interest in partnering with GrovLabs. We'll review your application and get back to you within 1-2 business days.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      {/* Company Info */}
      <section className="rounded-xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-lime-400" />
          Company Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Company Name *</label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => updateField('company_name', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg bg-white/5 border text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-lime-400/50',
                errors.company_name ? 'border-red-500' : 'border-white/10'
              )}
              placeholder="Acme Networks LLC"
            />
            {errors.company_name && <p className="text-red-400 text-xs mt-1">{errors.company_name}</p>}
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">State/Country of Organization</label>
            <input
              type="text"
              value={form.organized_in}
              onChange={(e) => updateField('organized_in', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
              placeholder="Delaware, USA"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-white/70 mb-1">Address</label>
            <input
              type="text"
              value={form.address_line1}
              onChange={(e) => updateField('address_line1', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
              placeholder="123 Main St, Suite 100, City, State ZIP"
            />
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">Website</label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => updateField('website', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
              placeholder="https://example.com"
            />
          </div>
        </div>
      </section>

      {/* Contact Info */}
      <section className="rounded-xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-lime-400" />
          Contact Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Contact Name *</label>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) => updateField('contact_name', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg bg-white/5 border text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-lime-400/50',
                errors.contact_name ? 'border-red-500' : 'border-white/10'
              )}
              placeholder="John Smith"
            />
            {errors.contact_name && <p className="text-red-400 text-xs mt-1">{errors.contact_name}</p>}
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">Email *</label>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => updateField('contact_email', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg bg-white/5 border text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-lime-400/50',
                errors.contact_email ? 'border-red-500' : 'border-white/10'
              )}
              placeholder="john@example.com"
            />
            {errors.contact_email && <p className="text-red-400 text-xs mt-1">{errors.contact_email}</p>}
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">Phone *</label>
            <input
              type="text"
              value={form.contact_phone}
              onChange={(e) => updateField('contact_phone', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg bg-white/5 border text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-lime-400/50',
                errors.contact_phone ? 'border-red-500' : 'border-white/10'
              )}
              placeholder="+1 (555) 123-4567"
            />
            {errors.contact_phone && <p className="text-red-400 text-xs mt-1">{errors.contact_phone}</p>}
          </div>
        </div>
      </section>

      {/* Partnership Type */}
      <section className="rounded-xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Partnership Direction *</h2>
        <p className="text-white/60 text-sm mb-4">Select how you'd like to partner with us:</p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-white/5 border-white/10 hover:border-white/20 cursor-pointer">
            <input
              type="checkbox"
              checked={form.wants_to_buy}
              onChange={(e) => updateField('wants_to_buy', e.target.checked)}
              className="w-5 h-5 accent-lime-400"
            />
            <div>
              <p className="font-medium text-white">Buy Leads</p>
              <p className="text-xs text-white/50">Purchase leads from GrovLabs</p>
            </div>
          </label>
          <label className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-white/5 border-white/10 hover:border-white/20 cursor-pointer">
            <input
              type="checkbox"
              checked={form.wants_to_sell}
              onChange={(e) => updateField('wants_to_sell', e.target.checked)}
              className="w-5 h-5 accent-lime-400"
            />
            <div>
              <p className="font-medium text-white">Sell Leads</p>
              <p className="text-xs text-white/50">Send leads to GrovLabs</p>
            </div>
          </label>
        </div>
        {errors.direction && <p className="text-red-400 text-xs mt-2">{errors.direction}</p>}
      </section>

      {/* Verticals */}
      <section className="rounded-xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Verticals</h2>
        <p className="text-white/60 text-sm mb-4">Select the verticals you work with:</p>
        <div className="flex flex-wrap gap-2">
          {VERTICALS.map((v) => (
            <label key={v} className="cursor-pointer">
              <input
                type="checkbox"
                checked={form.verticals.includes(v)}
                onChange={() => toggleVertical(v)}
                className="sr-only peer"
              />
              <span className="px-3 py-1.5 rounded-full text-sm border transition-colors inline-block bg-white/5 border-white/10 text-white/70 hover:border-white/20 peer-checked:bg-lime-400/20 peer-checked:border-lime-400 peer-checked:text-lime-400">
                {v}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Volume & Details */}
      <section className="rounded-xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Volume & Experience</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Estimated Daily Volume</label>
            <select
              value={form.estimated_volume}
              onChange={(e) => updateField('estimated_volume', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-lime-400/50"
            >
              <option value="">Select volume</option>
              {VOLUME_OPTIONS.map((v) => (
                <option key={v} value={v}>{v} calls/day</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">Traffic Sources</label>
            <input
              type="text"
              value={form.traffic_sources}
              onChange={(e) => updateField('traffic_sources', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
              placeholder="O&O, Affiliates, etc."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-white/70 mb-1">Current Partners</label>
            <input
              type="text"
              value={form.current_partners}
              onChange={(e) => updateField('current_partners', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
              placeholder="Networks or buyers you currently work with"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-white/70 mb-1">Comments</label>
            <textarea
              value={form.comments}
              onChange={(e) => updateField('comments', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-lime-400/50 resize-none"
              placeholder="Anything else you'd like us to know?"
            />
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">Referred By</label>
            <input
              type="text"
              value={form.referred_by}
              onChange={(e) => updateField('referred_by', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
              placeholder="Who referred you to GrovLabs?"
            />
          </div>
        </div>
      </section>

      {/* Terms */}
      <section className="rounded-xl bg-white/5 border border-white/10 p-6">
        <label className={cn(
          'flex items-start gap-3 cursor-pointer',
          errors.terms_agreed && 'text-red-400'
        )}>
          <input
            type="checkbox"
            checked={form.terms_agreed}
            onChange={(e) => updateField('terms_agreed', e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-white/70">
            I agree to GrovLabs' <a href="/terms" className="text-lime-400 underline" target="_blank">Terms of Service</a> and <a href="/privacy" className="text-lime-400 underline" target="_blank">Privacy Policy</a>. I certify that the information provided is accurate. *
          </span>
        </label>
        {errors.terms_agreed && <p className="text-red-400 text-xs mt-2">{errors.terms_agreed}</p>}
      </section>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 px-6 rounded-lg bg-lime-400 text-black font-semibold hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Submitting...
          </>
        ) : (
          'Submit Application'
        )}
      </button>
    </form>
  )
}
