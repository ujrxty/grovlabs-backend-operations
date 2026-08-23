'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Loader2, FileText, CheckCircle2, AlertCircle, Pen, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

type Step = 'loading' | 'review' | 'signed' | 'error'

interface AgreementData {
  id: string
  io_number: string
  vendor_name: string
  campaign: string
  agreement_text: string
  status: string
  vendor_signed_at: string | null
  vendor_sign_name: string | null
  counter_signed_at: string | null
}

export function AgreementSigningFlow({ token }: { token: string }) {
  const [step, setStep] = useState<Step>('loading')
  const [agreementData, setAgreementData] = useState<AgreementData | null>(null)
  const [signName, setSignName] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Invalid agreement link')
      setStep('error')
      return
    }
    fetchAgreement()
  }, [token])

  const fetchAgreement = async () => {
    try {
      const res = await fetch(`/api/agreement/fetch?token=${encodeURIComponent(token)}`)
      const data = await res.json()
      console.log('Agreement fetch result:', data?.success, data?.agreement?.status)

      if (!data?.success) {
        setError(data?.error ?? 'Failed to load agreement')
        setStep('error')
        return
      }

      const agreement = data?.agreement ?? {}
      setAgreementData({
        id: agreement?.id ?? '',
        io_number: agreement?.io_number ?? '',
        vendor_name: agreement?.vendor_name ?? '',
        campaign: agreement?.campaign ?? '',
        agreement_text: agreement?.agreement_text ?? '',
        status: agreement?.status ?? '',
        vendor_signed_at: agreement?.vendor_signed_at ?? null,
        vendor_sign_name: agreement?.vendor_sign_name ?? null,
        counter_signed_at: agreement?.counter_signed_at ?? null,
      })

      if (agreement?.status === 'pending_counter' || agreement?.status === 'active') {
        setStep('signed')
      } else if (agreement?.status === 'pending_vendor') {
        setStep('review')
      } else {
        setStep('review')
      }
    } catch (err: any) {
      console.error('Fetch agreement error:', err?.message ?? err)
      setError('Failed to load agreement. Please try again.')
      setStep('error')
    }
  }

  const signAgreement = async () => {
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
      const res = await fetch('/api/agreement/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sign_name: signName }),
      })
      const data = await res.json()
      if (data?.success) {
        setStep('signed')
        if (agreementData) {
          setAgreementData({ ...agreementData, status: 'pending_counter', vendor_sign_name: signName })
        }
        toast.success('Lead Purchase Agreement signed successfully!')
      } else {
        setError(data?.error ?? 'Failed to sign agreement')
      }
    } catch (err: any) {
      console.error('Sign agreement error:', err?.message ?? err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && step !== 'error' && (
        <div className="rounded-lg bg-red-900/20 border border-red-500/30 p-4 text-sm text-red-400 flex items-center gap-2 mb-6">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-10 w-10 text-[#a3e635] animate-spin mb-4" />
          <p className="text-white/60">Loading agreement...</p>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="rounded-xl bg-red-900/20 border border-red-500/30 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-red-400 mb-2">Unable to Load Agreement</h2>
          <p className="text-red-300">{error}</p>
          <button
            onClick={() => { setStep('loading'); setError(''); fetchAgreement() }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Review & Sign */}
      {step === 'review' && agreementData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Agreement Header */}
          <div className="rounded-xl bg-[#0a0a0a] border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-6 w-6 text-[#a3e635]" />
              <h2 className="font-display text-xl font-bold text-white">Lead Purchase Agreement</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-white/50">IO Number</p>
                <p className="font-mono font-semibold text-white">{agreementData?.io_number ?? ''}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Vendor</p>
                <p className="font-semibold text-white">{agreementData?.vendor_name ?? ''}</p>
              </div>
              {agreementData?.campaign && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-white/50">Campaign</p>
                  <p className="font-semibold text-white">{agreementData.campaign}</p>
                </div>
              )}
            </div>
          </div>

          {/* Agreement Text */}
          <div className="rounded-xl border border-white/10 p-6 bg-[#0a0a0a]">
            <h3 className="font-display font-semibold text-[#a3e635] mb-3">Agreement Terms</h3>
            <div className="max-h-96 overflow-y-auto rounded-lg bg-[#111] p-4 text-sm text-white/80 whitespace-pre-wrap border border-white/5 leading-relaxed">
              {agreementData?.agreement_text ?? 'No agreement text available.'}
            </div>
          </div>

          {/* Signature */}
          <div className="rounded-xl border border-[#a3e635]/20 bg-[#a3e635]/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Pen className="h-5 w-5 text-[#a3e635]" />
              <h3 className="font-display font-semibold text-white">Electronic Signature</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  value={signName}
                  onChange={(e: any) => { setSignName(e?.target?.value ?? ''); setError('') }}
                  className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#a3e635]/50 focus:border-[#a3e635]/50"
                  placeholder="Enter your full legal name"
                />
              </div>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e: any) => { setAgreeTerms(e?.target?.checked ?? false); setError('') }}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#0a0a0a] text-[#a3e635] focus:ring-[#a3e635]/50"
                />
                <p className="text-sm text-white/70">
                  I have read and agree to the terms of this Lead Purchase Agreement. I understand this constitutes a legally binding agreement.
                </p>
              </div>
              <button
                onClick={signAgreement}
                disabled={loading}
                className="w-full rounded-lg bg-[#a3e635] px-6 py-3 text-sm font-semibold text-[#050505] hover:bg-[#84cc16] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pen className="h-4 w-4" /> Sign Lead Purchase Agreement</>}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Signed */}
      {step === 'signed' && agreementData && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
          <div className="rounded-xl bg-green-900/20 border border-green-500/30 p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold text-green-400">Lead Purchase Agreement Signed!</h2>
            {agreementData?.status === 'active' ? (
              <>
                <p className="mt-3 text-green-300">Your agreement has been fully executed. Both parties have signed.</p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-500/20 px-4 py-2 text-sm font-semibold text-green-400">
                  <Shield className="h-4 w-4" /> Fully Executed
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-green-300">Thank you for signing! An admin will countersign the agreement shortly.</p>
                <p className="mt-2 text-sm text-white/60">You will receive a confirmation email once the agreement is fully executed.</p>
              </>
            )}
            {agreementData?.io_number && (
              <p className="mt-4 text-sm text-white/60">IO Number: <span className="font-mono font-semibold">{agreementData.io_number}</span></p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
