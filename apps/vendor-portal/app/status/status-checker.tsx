'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Search, Loader2, Clock, Eye, CheckCircle2, XCircle, FileText, AlertCircle, ArrowRight, Shield } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface ApplicationData {
  id: string
  company_name: string
  contact_name: string
  email: string
  status: string
  status_reason: string | null
  campaign_name: string
  campaign_industry: string
  created_at: string
  reviewed_at: string | null
  group_token: string | null
}

interface IOData {
  sign_token: string
  status: string
  io_number: string
  campaign_ids: string | null
}

interface AgreementData {
  sign_token: string
  status: string
  io_number: string
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any; description: string }> = {
  pending: { label: 'Pending Review', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200', icon: Clock, description: 'Your application has been received and is awaiting review.' },
  under_review: { label: 'Under Review', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: Eye, description: 'Your application is currently being reviewed by our team.' },
  approved: { label: 'Approved', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: CheckCircle2, description: 'Congratulations! Your application has been approved.' },
  rejected: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: XCircle, description: 'Unfortunately, your application was not approved at this time.' },
  withdrawn: { label: 'Withdrawn', color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200', icon: AlertCircle, description: 'This application has been withdrawn.' },
}

export function StatusChecker() {
  const searchParams = useSearchParams()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [applications, setApplications] = useState<ApplicationData[] | null>(null)
  const [ioData, setIoData] = useState<IOData | null>(null)
  const [agreementData, setAgreementData] = useState<AgreementData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const urlToken = searchParams?.get?.('token') ?? ''
    if (urlToken) {
      setToken(urlToken)
      lookupStatus(urlToken)
    }
  }, [searchParams])

  const lookupStatus = async (statusToken?: string) => {
    const t = (statusToken ?? token)?.trim?.()
    if (!t) {
      setError('Please enter a status token')
      return
    }
    setLoading(true)
    setError('')
    setApplications(null)
    setIoData(null)
    setAgreementData(null)
    try {
      const res = await fetch(`/api/status?token=${encodeURIComponent(t)}`)
      const data = await res.json()
      if (data?.success) {
        setApplications(data?.applications ?? [])
        setIoData(data?.io ?? null)
        setAgreementData(data?.agreement ?? null)
      } else {
        setError(data?.error ?? 'Application not found')
      }
    } catch (err: any) {
      console.error('Status lookup error:', err?.message ?? err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const safeApps = applications ?? []
  const hasApproved = safeApps.some((a) => a?.status === 'approved')

  return (
    <div className="mt-8 space-y-6">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={token}
            onChange={(e: any) => { setToken(e?.target?.value ?? ''); setError('') }}
            onKeyDown={(e: any) => { if (e?.key === 'Enter') lookupStatus() }}
            className="w-full rounded-lg border border-gray-200 pl-10 pr-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Enter your status token..."
          />
        </div>
        <button
          onClick={() => lookupStatus()}
          disabled={loading}
          className="rounded-lg bg-purple-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Look Up'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {safeApps.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Applicant info header */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Applicant</p>
            <p className="font-semibold text-gray-900">{safeApps[0]?.company_name ?? ''}</p>
            <p className="text-sm text-gray-600">{safeApps[0]?.contact_name ?? ''} &bull; {safeApps[0]?.email ?? ''}</p>
            <p className="text-xs text-gray-400 mt-1">Submitted {safeApps[0]?.created_at ? new Date(safeApps[0].created_at).toLocaleDateString() : ''}</p>
          </div>

          {/* IO Section — ONE per vendor, shown at the top when any approved app exists */}
          {hasApproved && ioData && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border-2 border-purple-200 bg-purple-50/50 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-purple-600" />
                <span className="font-semibold text-purple-800">Insertion Order</span>
                <span className="text-xs text-purple-500 font-mono bg-purple-100 rounded-full px-2 py-0.5">{ioData.io_number}</span>
              </div>

              {ioData.status === 'active' ? (
                <div className="rounded-lg bg-green-100 border border-green-300 p-4 text-sm text-green-800 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">IO Fully Executed</p>
                    <p className="text-green-700 text-xs mt-0.5">Your Insertion Order has been countersigned and is now active. Welcome aboard!</p>
                  </div>
                </div>
              ) : ioData.status === 'pending_counter' ? (
                <div className="rounded-lg bg-blue-100 border border-blue-300 p-4 text-sm text-blue-800 flex items-center gap-2">
                  <Clock className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">IO Signed — Pending Counter-Signature</p>
                    <p className="text-blue-700 text-xs mt-0.5">You have signed the IO. Waiting for The Broken Wood Inc admin to counter-sign.</p>
                  </div>
                </div>
              ) : ioData.status === 'pending_vendor' ? (
                <div className="space-y-3">
                  <p className="text-sm text-purple-700">Your Insertion Order is ready for signing. Please review and sign below.</p>
                  <Link
                    href={`/sign-io/${ioData.sign_token}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors shadow-sm"
                  >
                    Sign Insertion Order <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">IO status: {ioData.status}</p>
              )}
            </motion.div>
          )}

          {/* Agreement Section — shown when agreement exists */}
          {hasApproved && agreementData && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-indigo-600" />
                <span className="font-semibold text-indigo-800">Lead Purchase Agreement</span>
                {agreementData.io_number && (
                  <span className="text-xs text-indigo-500 font-mono bg-indigo-100 rounded-full px-2 py-0.5">{agreementData.io_number}</span>
                )}
              </div>

              {agreementData.status === 'active' ? (
                <div className="rounded-lg bg-green-100 border border-green-300 p-4 text-sm text-green-800 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Agreement Fully Executed</p>
                    <p className="text-green-700 text-xs mt-0.5">Your Lead Purchase Agreement has been countersigned and is now active.</p>
                  </div>
                </div>
              ) : agreementData.status === 'pending_counter' ? (
                <div className="rounded-lg bg-blue-100 border border-blue-300 p-4 text-sm text-blue-800 flex items-center gap-2">
                  <Clock className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Agreement Signed — Pending Counter-Signature</p>
                    <p className="text-blue-700 text-xs mt-0.5">You have signed the agreement. Waiting for The Broken Wood Inc admin to counter-sign.</p>
                  </div>
                </div>
              ) : agreementData.status === 'pending_vendor' ? (
                <div className="space-y-3">
                  <p className="text-sm text-indigo-700">Your Lead Purchase Agreement is ready for signing.</p>
                  <Link
                    href={`/agreement/sign/${agreementData.sign_token}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Sign Lead Purchase Agreement <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Agreement status: {agreementData.status}</p>
              )}
            </motion.div>
          )}

          {/* Individual campaign application cards */}
          {safeApps.map((app: ApplicationData, i: number) => {
            const config = statusConfig[app?.status ?? 'pending'] ?? statusConfig.pending
            const Icon = config?.icon ?? Clock
            return (
              <motion.div
                key={app?.id ?? i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn('rounded-xl border p-5', config?.bgColor ?? '')}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className={cn('h-5 w-5', config?.color ?? '')} />
                      <span className={cn('font-semibold text-sm', config?.color ?? '')}>{config?.label ?? ''}</span>
                      <span className="text-xs text-gray-400 bg-white/60 rounded-full px-2 py-0.5">{app?.campaign_industry ?? ''}</span>
                    </div>
                    <h3 className="mt-1 font-medium text-gray-900">{app?.campaign_name ?? 'Campaign'}</h3>
                    <p className="mt-1 text-sm text-gray-600">{config?.description ?? ''}</p>
                    {app?.status_reason && (
                      <div className="mt-3 rounded-lg bg-white/80 border border-gray-200 p-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">Review Notes</p>
                        <p className="text-sm text-gray-700">{app.status_reason}</p>
                      </div>
                    )}
                    {app?.reviewed_at && (
                      <p className="mt-2 text-xs text-gray-400">
                        Reviewed on {new Date(app.reviewed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}