'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Loader2, FileText, CheckCircle2, AlertCircle, Pen, ArrowRight, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface IOData {
  io_number: string
  grovlabs_role: 'buyer' | 'seller'
  network: {
    legal_name: string
    contact_name: string
    contact_email: string
  }
  industry?: string
  lead_type?: string
  geo?: string
  payment_terms?: string
  compensation_type?: string
  compensation_amount?: number
  start_date?: string
  end_date?: string
  status: string
  io_terms: string
  msa_terms: string
}

export function N2NSigningFlow({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [ioData, setIoData] = useState<IOData | null>(null)
  const [signName, setSignName] = useState('')
  const [signTitle, setSignTitle] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeMSA, setAgreeMSA] = useState(false)
  const [error, setError] = useState('')
  const [signed, setSigned] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'io' | 'msa'>('io')

  useEffect(() => {
    fetchIO()
  }, [token])

  const fetchIO = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${QA_AGENT_URL}/n2n/io/sign/${token}`)
      if (!res.ok) {
        setError('IO not found or has already been signed')
        setLoading(false)
        return
      }
      const data = await res.json()
      setIoData(data)
      if (data.status !== 'pending_network') {
        setSigned(true)
      }
    } catch (err: any) {
      console.error('Fetch IO error:', err)
      setError('Failed to load IO. Please try again.')
    }
    setLoading(false)
  }

  const handleSign = async () => {
    if (!signName.trim()) {
      setError('Please enter your name')
      return
    }
    if (!agreeTerms || !agreeMSA) {
      setError('Please agree to both the IO terms and MSA')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${QA_AGENT_URL}/n2n/io/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sign_name: signName,
          sign_title: signTitle,
          agree: true,
        }),
      })
      if (res.ok) {
        setSigned(true)
        toast.success('IO signed successfully!')
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to sign IO')
      }
    } catch (err: any) {
      console.error('Sign error:', err)
      setError('Something went wrong. Please try again.')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#c4ff00] mx-auto" />
          <p className="text-white/60 mt-4">Loading IO...</p>
        </div>
      </div>
    )
  }

  if (error && !ioData) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-white mt-4">Error</h1>
          <p className="text-white/60 mt-2">{error}</p>
        </div>
      </div>
    )
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-[#c4ff00]/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-[#c4ff00]" />
          </div>
          <h1 className="text-3xl font-bold text-white mt-6">IO Signed!</h1>
          <p className="text-white/60 mt-3">
            Thank you for signing. GrovLabs will countersign and you&apos;ll receive a fully executed copy via email.
          </p>
          <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-sm text-white/40">IO Number</p>
            <p className="text-lg font-mono text-white">{ioData?.io_number}</p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 border border-white/10">
              <span className="text-white font-extrabold text-lg">G</span>
              <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full bg-[#c4ff00]" />
            </div>
            <div>
              <h2 className="font-semibold text-white">GrovLabs</h2>
              <p className="text-xs text-white/50">Network Partner Agreement</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-[#c4ff00]" />
            <span className="text-sm text-white/60">
              {ioData?.grovlabs_role === 'buyer' ? 'GrovLabs Buys' : 'GrovLabs Sells'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* IO Info */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Insertion Order</h1>
          <p className="text-white/60 mt-2">
            Review and sign the IO and Master Services Agreement between GrovLabs and {ioData?.network.legal_name}
          </p>
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10">
              <p className="text-xs text-white/40">IO Number</p>
              <p className="font-mono text-white">{ioData?.io_number}</p>
            </div>
            {ioData?.industry && (
              <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                <p className="text-xs text-white/40">Industry</p>
                <p className="text-white">{ioData.industry}</p>
              </div>
            )}
            {ioData?.compensation_amount && (
              <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                <p className="text-xs text-white/40">Compensation</p>
                <p className="text-white">${ioData.compensation_amount} {ioData.compensation_type}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('io')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'io'
                ? 'bg-[#c4ff00] text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            )}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Insertion Order
          </button>
          <button
            onClick={() => setActiveTab('msa')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'msa'
                ? 'bg-[#c4ff00] text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            )}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Master Services Agreement
          </button>
        </div>

        {/* Document View */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 mb-8">
          <pre className="whitespace-pre-wrap font-mono text-sm text-white/80 max-h-[500px] overflow-y-auto">
            {activeTab === 'io' ? ioData?.io_terms : ioData?.msa_terms}
          </pre>
        </div>

        {/* Sign Section */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Pen className="h-5 w-5 text-[#c4ff00]" />
            Sign Agreement
          </h3>

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm text-white/60 mb-2">Your Full Name *</label>
              <input
                type="text"
                value={signName}
                onChange={(e) => setSignName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#c4ff00]/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Title</label>
              <input
                type="text"
                value={signTitle}
                onChange={(e) => setSignTitle(e.target.value)}
                placeholder="CEO, Director, etc."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#c4ff00]/50"
              />
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-white/20 bg-white/5 text-[#c4ff00] focus:ring-[#c4ff00]/50"
              />
              <span className="text-sm text-white/70">
                I have read and agree to the <strong className="text-white">Insertion Order</strong> terms above.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeMSA}
                onChange={(e) => setAgreeMSA(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-white/20 bg-white/5 text-[#c4ff00] focus:ring-[#c4ff00]/50"
              />
              <span className="text-sm text-white/70">
                I have read and agree to the <strong className="text-white">Master Services Agreement</strong>.
              </span>
            </label>
          </div>

          <button
            onClick={handleSign}
            disabled={submitting || !signName.trim() || !agreeTerms || !agreeMSA}
            className={cn(
              'w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2',
              signName.trim() && agreeTerms && agreeMSA
                ? 'bg-[#c4ff00] text-black hover:bg-[#d4ff40]'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            )}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Sign Agreement
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>

          <p className="text-xs text-white/40 text-center mt-4">
            By signing, you agree that this electronic signature is legally binding.
          </p>
        </div>
      </main>
    </div>
  )
}
