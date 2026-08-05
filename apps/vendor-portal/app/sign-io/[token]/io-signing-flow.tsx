'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Loader2, Mail, KeyRound, FileText, CheckCircle2, AlertCircle, Pen, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

type Step = 'email' | 'verify' | 'review' | 'signed'

interface CampaignInfo {
  name: string
  payout: string
  payout_type: string
  min_duration: number | null
}

interface IOData {
  io_number: string
  company_name: string
  campaigns: CampaignInfo[]
  campaign_name: string // joined names for backward compat
  billing_cycle: string
  terms: string
  special_terms: string | null
  status: string
}

export function IoSigningFlow({ token }: { token: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [ioData, setIoData] = useState<IOData | null>(null)
  const [signName, setSignName] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [error, setError] = useState('')
  const [agreementUrl, setAgreementUrl] = useState('')

  const sendCode = async () => {
    if (!email?.trim?.() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '')) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/io/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email }),
      })
      const data = await res.json()
      if (data?.success) {
        setStep('verify')
        toast.success('Verification code sent to your email')
      } else {
        setError(data?.error ?? 'Failed to send verification code')
      }
    } catch (err: any) {
      console.error('Send code error:', err?.message ?? err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const verifyCodeHandler = async () => {
    if (!code?.trim?.() || (code?.length ?? 0) !== 6) {
      setError('Please enter the 6-digit code')
      return
    }
    setLoading(true)
    setError('')
    try {
      // Step 1: Verify the email code locally
      const verifyRes = await fetch('/api/io/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyData?.success) {
        setError(verifyData?.error ?? 'Invalid verification code')
        setLoading(false)
        return
      }

      // Step 2: Fetch IO terms from backend service
      const termsRes = await fetch(`/api/io/fetch-terms?token=${encodeURIComponent(token)}`)
      const termsData = await termsRes.json()

      const localIO = verifyData?.io ?? {}

      // Build campaigns list - prefer local data (which has RTB logic applied)
      let campaigns: CampaignInfo[] = localIO?.campaigns ?? []

      // If backend returned data, use terms from backend but campaigns from local
      let terms = localIO?.terms ?? ''
      let specialTerms = localIO?.special_terms ?? null
      if (termsData?.success && termsData?.io) {
        const backendIO = termsData.io
        terms = backendIO?.terms ?? terms
        specialTerms = backendIO?.special_terms ?? specialTerms
      }

      const mergedData: IOData = {
        io_number: localIO?.io_number ?? '',
        company_name: localIO?.company_name ?? '',
        campaigns: campaigns,
        campaign_name: localIO?.campaign_name ?? '',
        billing_cycle: 'Bi-Weekly Net 15',
        terms: terms,
        special_terms: specialTerms,
        status: localIO?.status ?? '',
      }

      setIoData(mergedData)
      if (mergedData.status === 'pending_counter' || mergedData.status === 'active') {
        setStep('signed')
      } else {
        setStep('review')
      }
    } catch (err: any) {
      console.error('Verify code error:', err?.message ?? err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const signIO = async () => {
    if (!signName?.trim?.()) {
      setError('Please enter your full name')
      return
    }
    if (!agreeTerms) {
      setError('You must agree to the terms')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/io/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sign_name: signName, agree: true }),
      })
      const data = await res.json()
      if (data?.success) {
        setStep('signed')
        toast.success('Insertion Order signed successfully!')
        // Store agreement URL for redirect
        if (data?.agreement_sign_url || data?.agreement_sign_token) {
          const agUrl = data?.agreement_sign_token
            ? `/agreement/sign/${data.agreement_sign_token}`
            : data?.agreement_sign_url ?? ''
          setAgreementUrl(agUrl)
        }
      } else {
        setError(data?.error ?? 'Failed to sign IO')
      }
    } catch (err: any) {
      console.error('Sign IO error:', err?.message ?? err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatPayoutType = (type: string) => {
    const map: Record<string, string> = {
      per_conversion: 'Per Conversion',
      per_call: 'Per Call',
      per_qualified_call: 'Per Qualified Call',
    }
    return map[type ?? ''] ?? type ?? ''
  }

  const safeCampaigns = ioData?.campaigns ?? []

  return (
    <div>
      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {['Email Verification', 'Review IO', 'Sign'].map((label: string, i: number) => {
          const stepIndex = step === 'email' ? 0 : step === 'verify' ? 0 : step === 'review' ? 1 : 2
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                i <= stepIndex ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-400'
              )}>
                {i + 1}
              </div>
              <span className={cn('text-xs font-medium hidden sm:inline', i <= stepIndex ? 'text-purple-700' : 'text-gray-400')}>{label}</span>
              {i < 2 && <div className={cn('flex-1 h-0.5', i < stepIndex ? 'bg-purple-700' : 'bg-gray-200')} />}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2 mb-6">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step: Email */}
      {step === 'email' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="rounded-xl bg-purple-50 border border-purple-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="h-6 w-6 text-purple-600" />
              <h2 className="font-display text-xl font-bold text-gray-900">Email Verification Required</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">Enter the email address associated with your vendor application to receive a verification code.</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e: any) => { setEmail(e?.target?.value ?? ''); setError('') }}
                onKeyDown={(e: any) => { if (e?.key === 'Enter') sendCode() }}
                className="flex-1 rounded-lg border border-purple-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="your@email.com"
              />
              <button
                onClick={sendCode}
                disabled={loading}
                className="rounded-lg bg-purple-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Code'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step: Verify Code */}
      {step === 'verify' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="rounded-xl bg-purple-50 border border-purple-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <KeyRound className="h-6 w-6 text-purple-600" />
              <h2 className="font-display text-xl font-bold text-gray-900">Enter Verification Code</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">A 6-digit code has been sent to <strong>{email}</strong>. The code expires in 15 minutes.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e: any) => { setCode((e?.target?.value ?? '').replace(/\D/g, '').slice(0, 6)); setError('') }}
                onKeyDown={(e: any) => { if (e?.key === 'Enter') verifyCodeHandler() }}
                className="flex-1 rounded-lg border border-purple-200 px-4 py-2.5 text-sm font-mono text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="000000"
                maxLength={6}
              />
              <button
                onClick={verifyCodeHandler}
                disabled={loading}
                className="rounded-lg bg-purple-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </button>
            </div>
            <button onClick={() => { setStep('email'); setCode(''); setError('') }} className="mt-3 text-xs text-purple-600 hover:text-purple-800">
              Use a different email
            </button>
          </div>
        </motion.div>
      )}

      {/* Step: Review & Sign */}
      {step === 'review' && ioData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* IO Header */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-6 w-6 text-purple-600" />
              <h2 className="font-display text-xl font-bold text-gray-900">Insertion Order</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              <div>
                <p className="text-xs text-gray-500">IO Number</p>
                <p className="font-mono font-semibold text-gray-900">{ioData?.io_number ?? ''}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Vendor</p>
                <p className="font-semibold text-gray-900">{ioData?.company_name ?? ''}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Terms</p>
                <p className="font-semibold text-gray-900">Bi-Weekly Net 15</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Campaigns</p>
                <p className="font-semibold text-gray-900">{safeCampaigns.length} campaign{safeCampaigns.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Individual campaign details */}
            {safeCampaigns.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Campaign Details</p>
                {safeCampaigns.map((campaign: CampaignInfo, idx: number) => (
                  <div key={idx} className="rounded-lg bg-white border border-gray-100 p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">{campaign?.name ?? ''}</p>
                        {campaign?.min_duration != null && (campaign?.min_duration ?? 0) > 0 && (
                          <p className="text-xs text-gray-500 mt-0.5">Min call duration: {campaign.min_duration}s</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-700">
                          {campaign?.payout === 'Variable' ? (
                            <span>Variable</span>
                          ) : (
                            <span>{campaign?.payout ?? '$0'}</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">{formatPayoutType(campaign?.payout_type ?? '')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Terms */}
          <div className="rounded-xl border border-gray-200 p-6">
            <h3 className="font-display font-semibold text-gray-900 mb-3">Terms & Conditions</h3>
            <div className="max-h-64 overflow-y-auto rounded-lg bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100">
              {ioData?.terms ?? 'No terms available.'}
            </div>
          </div>

          {ioData?.special_terms && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
              <h3 className="font-display font-semibold text-yellow-800 mb-3">Special Terms</h3>
              <div className="text-sm text-yellow-700 whitespace-pre-wrap">
                {ioData.special_terms}
              </div>
            </div>
          )}

          {/* Signature */}
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Pen className="h-5 w-5 text-purple-600" />
              <h3 className="font-display font-semibold text-gray-900">Electronic Signature</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  value={signName}
                  onChange={(e: any) => { setSignName(e?.target?.value ?? ''); setError('') }}
                  className="w-full rounded-lg border border-purple-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter your full legal name"
                />
              </div>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e: any) => { setAgreeTerms(e?.target?.checked ?? false); setError('') }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <p className="text-sm text-gray-700">
                  I have read and agree to the terms and conditions of this Insertion Order. I understand this constitutes a legally binding agreement.
                </p>
              </div>
              <button
                onClick={signIO}
                disabled={loading}
                className="w-full rounded-lg bg-purple-700 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pen className="h-4 w-4" /> Sign Insertion Order</>}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step: Signed */}
      {step === 'signed' && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
          {/* Two-step progress indicator */}
          {agreementUrl && (
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold"><CheckCircle2 className="h-4 w-4" /></div>
                <span className="text-sm font-medium text-green-700">Step 1: IO Signed</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300" />
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">2</div>
                <span className="text-sm font-medium text-purple-700">Step 2: Sign Agreement</span>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-green-50 border border-green-200 p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold text-green-800">Insertion Order Signed!</h2>
            <p className="mt-3 text-green-700">{agreementUrl ? 'Step 1 complete. One more step to go!' : 'Thank you for signing your IO.'}</p>
            {ioData?.io_number && (
              <p className="mt-2 text-sm text-gray-600">IO Number: <span className="font-mono font-semibold">{ioData.io_number}</span></p>
            )}
            <p className="mt-4 text-sm text-gray-500">A confirmation email has been sent to your email.</p>
          </div>

          {agreementUrl && (
            <div className="rounded-xl bg-purple-50 border border-purple-200 p-8 text-center">
              <FileText className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="font-display text-xl font-bold text-gray-900 mb-2">Next: Sign Lead Purchase Agreement</h3>
              <p className="text-sm text-gray-600 mb-6">Please sign the Lead Purchase Agreement to complete your vendor onboarding.</p>
              <button
                onClick={() => router.push(agreementUrl)}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-8 py-3 text-sm font-semibold text-white hover:bg-purple-800 transition-colors shadow-md"
              >
                Continue to Agreement <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {!agreementUrl && (
            <p className="text-center text-sm text-gray-500">An Admin will be in touch shortly to provide DIDs and Posting specs.</p>
          )}
        </motion.div>
      )}
    </div>
  )
}