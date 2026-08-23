'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  Mail,
  Calendar,
  Loader2,
  Receipt,
  Users,
  CheckCircle2,
  Clock,
  X,
  Save,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Wallet,
  ShieldCheck,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface VendorOption {
  id: string | null
  td_source_id: string
  company_name: string
  contact_name: string
  email: string
  td_source_name: string | null
  status: string
  paused: boolean | null
  lastCallAt: string | null
  callsCount: number
  hasLocalProfile: boolean
}

interface CallDetail {
  id: number
  date: string
  callerNumber: string
  city: string
  duration: number
  payout: number
  revenue: number
}

interface OfferBreakdown {
  offer: string
  offerId: number
  calls: number
  payout: number
  revenue: number
  avgDuration: number
  avgPayout: number
  callDetails: CallDetail[]
}

interface BillingReport {
  vendor: VendorOption | null
  tdSourceId: string
  periodStart: string
  periodEnd: string
  paymentDueDate: string
  totalCalls: number
  totalPayout: number
  totalRevenue: number
  margin: number
  offerBreakdown: OfferBreakdown[]
}

interface BillingContact {
  id: string
  vendor_id: string
  email: string
  label: string | null
  is_default: boolean
}

interface PaymentRecord {
  id: string
  vendor_id: string
  period_start: string
  period_end: string
  amount: string | number
  status: string
  paid_at: string | null
  paid_method: string | null
  paid_reference: string | null
  notes: string | null
}

interface PaymentMethod {
  id: string
  method_type: string
  label: string | null
  is_default: boolean
  mask: string | null
  created_at: string
  updated_at: string
}

type PaymentDetails = Record<string, string>

// Which detail fields are shown for each method type, in display order.
const METHOD_FIELDS: Record<string, { key: string; label: string; sensitive?: boolean; placeholder?: string }[]> = {
  wire: [
    { key: 'bank_name', label: 'Bank Name' },
    { key: 'account_name', label: 'Account Holder Name' },
    { key: 'account_type', label: 'Account Type', placeholder: 'Checking / Savings' },
    { key: 'routing_number', label: 'Routing / ABA Number', sensitive: true },
    { key: 'account_number', label: 'Account Number', sensitive: true },
    { key: 'swift_code', label: 'SWIFT / BIC (international)', placeholder: 'Optional' },
    { key: 'bank_address', label: 'Bank Address', placeholder: 'Optional' },
  ],
  ach: [
    { key: 'bank_name', label: 'Bank Name' },
    { key: 'account_name', label: 'Account Holder Name' },
    { key: 'account_type', label: 'Account Type', placeholder: 'Checking / Savings' },
    { key: 'routing_number', label: 'Routing / ABA Number', sensitive: true },
    { key: 'account_number', label: 'Account Number', sensitive: true },
  ],
  paypal: [{ key: 'paypal_email', label: 'PayPal Email' }],
  zelle: [{ key: 'zelle_handle', label: 'Zelle Email or Phone' }],
  check: [
    { key: 'payee_name', label: 'Make Check Payable To' },
    { key: 'mailing_address', label: 'Mailing Address' },
  ],
  other: [{ key: 'other_details', label: 'Payment Details' }],
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    wire: 'Wire Transfer',
    ach: 'ACH',
    paypal: 'PayPal',
    zelle: 'Zelle',
    check: 'Check',
    other: 'Other',
  }
  return map[method] || method
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
}

// Calculate billing periods
function getBillingPeriods() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const periods: { label: string; start: string; end: string; dueDate: string }[] = []

  // Generate last 6 billing periods
  for (let i = 0; i < 6; i++) {
    const targetMonth = m - Math.floor(i / 2)
    const targetYear = y + Math.floor(targetMonth / 12) * (targetMonth < 0 ? -1 : 0)
    const adjMonth = ((targetMonth % 12) + 12) % 12
    const adjYear = y + Math.floor(targetMonth / 12)

    if (i % 2 === 0) {
      // Current iteration: second half of previous month or first half of current
      const day = now.getUTCDate()
      if (i === 0) {
        // Current period
        if (day <= 15) {
          // We're in 1st-15th
          const lastDay = new Date(Date.UTC(adjYear, adjMonth + 1, 0)).getUTCDate()
          periods.push({
            label: `${new Date(Date.UTC(adjYear, adjMonth, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })} 1-15, ${adjYear}`,
            start: `${adjYear}-${String(adjMonth + 1).padStart(2, '0')}-01`,
            end: `${adjYear}-${String(adjMonth + 1).padStart(2, '0')}-15`,
            dueDate: `${adjYear}-${String(adjMonth + 1).padStart(2, '0')}-${lastDay}`,
          })
        } else {
          // We're in 16th-end
          const lastDay = new Date(Date.UTC(adjYear, adjMonth + 1, 0)).getUTCDate()
          periods.push({
            label: `${new Date(Date.UTC(adjYear, adjMonth, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })} 16-${lastDay}, ${adjYear}`,
            start: `${adjYear}-${String(adjMonth + 1).padStart(2, '0')}-16`,
            end: `${adjYear}-${String(adjMonth + 1).padStart(2, '0')}-${lastDay}`,
            dueDate: new Date(Date.UTC(adjYear, adjMonth + 1, 16)).toISOString().split('T')[0],
          })
        }
      }
    }
  }

  // Generate proper past periods systematically
  // Start from current month and go back
  let curYear = y
  let curMonth = m
  const currentDay = now.getUTCDate()

  // If we're in first half, the "previous" period is second half of last month
  // If we're in second half, the "previous" period is first half of current month
  const periodsToGenerate: { year: number; month: number; half: 'first' | 'second' }[] = []

  if (currentDay <= 15) {
    // Current = first half. Previous periods go: last month 2nd half, last month 1st half, etc.
    periodsToGenerate.push({ year: curYear, month: curMonth, half: 'first' }) // current
    let pm = curMonth - 1
    let py = curYear
    if (pm < 0) { pm = 11; py-- }
    periodsToGenerate.push({ year: py, month: pm, half: 'second' })
    periodsToGenerate.push({ year: py, month: pm, half: 'first' })
    let pm2 = pm - 1
    let py2 = py
    if (pm2 < 0) { pm2 = 11; py2-- }
    periodsToGenerate.push({ year: py2, month: pm2, half: 'second' })
    periodsToGenerate.push({ year: py2, month: pm2, half: 'first' })
    let pm3 = pm2 - 1
    let py3 = py2
    if (pm3 < 0) { pm3 = 11; py3-- }
    periodsToGenerate.push({ year: py3, month: pm3, half: 'second' })
    periodsToGenerate.push({ year: py3, month: pm3, half: 'first' })
  } else {
    periodsToGenerate.push({ year: curYear, month: curMonth, half: 'second' }) // current
    periodsToGenerate.push({ year: curYear, month: curMonth, half: 'first' })
    let pm = curMonth - 1
    let py = curYear
    if (pm < 0) { pm = 11; py-- }
    periodsToGenerate.push({ year: py, month: pm, half: 'second' })
    periodsToGenerate.push({ year: py, month: pm, half: 'first' })
    let pm2 = pm - 1
    let py2 = py
    if (pm2 < 0) { pm2 = 11; py2-- }
    periodsToGenerate.push({ year: py2, month: pm2, half: 'second' })
    periodsToGenerate.push({ year: py2, month: pm2, half: 'first' })
  }

  return periodsToGenerate.map((p) => {
    const monthName = new Date(Date.UTC(p.year, p.month, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
    const lastDay = new Date(Date.UTC(p.year, p.month + 1, 0)).getUTCDate()

    if (p.half === 'first') {
      return {
        label: `${monthName} 1-15, ${p.year}`,
        start: `${p.year}-${String(p.month + 1).padStart(2, '0')}-01`,
        end: `${p.year}-${String(p.month + 1).padStart(2, '0')}-15`,
        dueDate: `${p.year}-${String(p.month + 1).padStart(2, '0')}-${lastDay}`,
      }
    } else {
      return {
        label: `${monthName} 16-${lastDay}, ${p.year}`,
        start: `${p.year}-${String(p.month + 1).padStart(2, '0')}-16`,
        end: `${p.year}-${String(p.month + 1).padStart(2, '0')}-${lastDay}`,
        dueDate: new Date(Date.UTC(p.year, p.month + 1, 16)).toISOString().split('T')[0],
      }
    }
  })
}

export function BillingContent() {
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [loadingVendors, setLoadingVendors] = useState(true)
  const [selectedVendor, setSelectedVendor] = useState<VendorOption | null>(null)
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false)
  const [periodStart, setPeriodStart] = useState(() => getBillingPeriods()[0].start)
  const [periodEnd, setPeriodEnd] = useState(() => getBillingPeriods()[0].end)
  const [report, setReport] = useState<BillingReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set())
  const [allVendorReport, setAllVendorReport] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailOverride, setEmailOverride] = useState('')
  const [showEmailConfirm, setShowEmailConfirm] = useState(false)
  const [billingContacts, setBillingContacts] = useState<BillingContact[]>([])
  const [savingContact, setSavingContact] = useState(false)
  const [paymentRecord, setPaymentRecord] = useState<PaymentRecord | null>(null)
  const [alreadyPaid, setAlreadyPaid] = useState(0)
  const [paidPeriods, setPaidPeriods] = useState<PaymentRecord[]>([])
  const [showPaidForm, setShowPaidForm] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [paidMethod, setPaidMethod] = useState('wire')
  const [paidReference, setPaidReference] = useState('')
  const [paidDate, setPaidDate] = useState('')
  const [paidNotes, setPaidNotes] = useState('')
  // Payment Details vault
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [revealed, setRevealed] = useState<Record<string, PaymentDetails>>({})
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [showMethodForm, setShowMethodForm] = useState(false)
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null)
  const [savingMethod, setSavingMethod] = useState(false)
  const [mfType, setMfType] = useState('ach')
  const [mfLabel, setMfLabel] = useState('')
  const [mfIsDefault, setMfIsDefault] = useState(false)
  const [mfDetails, setMfDetails] = useState<PaymentDetails>({})
  const [mfInstructions, setMfInstructions] = useState('')

  // Fetch vendors on mount
  useEffect(() => {
    fetch('/api/billing?action=vendors')
      .then((r) => r.json())
      .then((data) => {
        setVendors(data.vendors || [])
        setLoadingVendors(false)
      })
      .catch(() => setLoadingVendors(false))
  }, [])

  // Fetch saved billing contacts when a vendor with a local profile is selected
  useEffect(() => {
    if (!selectedVendor?.id) {
      setBillingContacts([])
      return
    }
    fetch(`/api/vendors/${selectedVendor.id}/billing-contacts`)
      .then((r) => r.json())
      .then((data) => setBillingContacts(data.contacts || []))
      .catch(() => setBillingContacts([]))
  }, [selectedVendor?.id])

  // Fetch saved payment methods (vault) when a vendor with a local profile is selected
  const loadPaymentMethods = useCallback(() => {
    if (!selectedVendor?.id) {
      setPaymentMethods([])
      setRevealed({})
      return
    }
    fetch(`/api/vendors/${selectedVendor.id}/payment-methods`)
      .then((r) => r.json())
      .then((data) => setPaymentMethods(data.methods || []))
      .catch(() => setPaymentMethods([]))
  }, [selectedVendor?.id])

  useEffect(() => {
    setRevealed({})
    loadPaymentMethods()
  }, [selectedVendor?.id, loadPaymentMethods])

  // Fetch the payment record + ledger (already-paid sub-periods) for the current report's period
  useEffect(() => {
    if (!report || !selectedVendor?.id) {
      setPaymentRecord(null)
      setAlreadyPaid(0)
      setPaidPeriods([])
      return
    }
    const params = new URLSearchParams({ periodStart: report.periodStart, periodEnd: report.periodEnd })
    fetch(`/api/vendors/${selectedVendor.id}/payments?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setPaymentRecord(data.record || null)
        setAlreadyPaid(Number(data.alreadyPaid) || 0)
        setPaidPeriods(data.paidPeriods || [])
      })
      .catch(() => {
        setPaymentRecord(null)
        setAlreadyPaid(0)
        setPaidPeriods([])
      })
  }, [report, selectedVendor?.id])

  const generateReport = useCallback(() => {
    if (!selectedVendor || !periodStart || !periodEnd) return
    setLoadingReport(true)
    setReport(null)
    setExpandedOffers(new Set())

    const params = new URLSearchParams({ periodStart, periodEnd })
    if (selectedVendor.id) params.set('vendorId', selectedVendor.id)
    else params.set('tdSourceId', selectedVendor.td_source_id)
    fetch(`/api/billing/report?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          toast.error(data.error)
        } else {
          setReport(data)
        }
        setLoadingReport(false)
      })
      .catch(() => {
        toast.error('Failed to generate report')
        setLoadingReport(false)
      })
  }, [selectedVendor, periodStart, periodEnd])

  const toggleOffer = (offer: string) => {
    setExpandedOffers((prev) => {
      const next = new Set(prev)
      if (next.has(offer)) next.delete(offer)
      else next.add(offer)
      return next
    })
  }

  const expandAll = () => {
    if (!report) return
    if (expandedOffers.size === report.offerBreakdown.length) {
      setExpandedOffers(new Set())
    } else {
      setExpandedOffers(new Set(report.offerBreakdown.map((o) => o.offer)))
    }
  }

  const handleEmailStatement = () => {
    if (!report || !selectedVendor) return
    const defaults = billingContacts.filter((c) => c.is_default).map((c) => c.email)
    const prefill = defaults.length > 0 ? defaults.join(', ') : (selectedVendor.email || '')
    setEmailOverride(prefill)
    setShowEmailConfirm(true)
  }

  // Add an email to the recipients field (from a saved contact chip)
  const addRecipient = (email: string) => {
    setEmailOverride((prev) => {
      const list = prev.split(/[,;]/).map((e) => e.trim()).filter(Boolean)
      if (list.includes(email)) return prev
      return [...list, email].join(', ')
    })
  }

  // Persist the currently-typed recipient email(s) as saved contacts
  const saveTypedRecipients = async () => {
    if (!selectedVendor?.id) {
      toast.error('This vendor has no saved profile yet, so contacts cannot be stored.')
      return
    }
    const list = emailOverride.split(/[,;]/).map((e) => e.trim()).filter(Boolean)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const valid = list.filter((e) => emailRegex.test(e))
    if (valid.length === 0) {
      toast.error('Enter at least one valid email to save')
      return
    }
    setSavingContact(true)
    try {
      const results = await Promise.all(
        valid.map((email) =>
          fetch(`/api/vendors/${selectedVendor.id}/billing-contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          }).then((r) => r.json())
        )
      )
      const saved = results.filter((d) => d.contact).map((d) => d.contact as BillingContact)
      setBillingContacts((prev) => {
        const map = new Map(prev.map((c) => [c.email, c]))
        saved.forEach((c) => map.set(c.email, c))
        return Array.from(map.values())
      })
      toast.success(`Saved ${saved.length} contact${saved.length !== 1 ? 's' : ''} for ${selectedVendor.company_name}`)
    } catch {
      toast.error('Failed to save contacts')
    } finally {
      setSavingContact(false)
    }
  }

  // Remove a saved billing contact
  const removeContact = async (contactId: string) => {
    if (!selectedVendor?.id) return
    try {
      await fetch(`/api/vendors/${selectedVendor.id}/billing-contacts?contactId=${contactId}`, { method: 'DELETE' })
      setBillingContacts((prev) => prev.filter((c) => c.id !== contactId))
    } catch {
      toast.error('Failed to remove contact')
    }
  }

  // ---- Payment Details vault handlers ----
  const openAddMethod = () => {
    setEditingMethodId(null)
    setMfType('ach')
    setMfLabel('')
    setMfIsDefault(paymentMethods.length === 0)
    setMfDetails({})
    setMfInstructions('')
    setShowMethodForm(true)
  }

  const openEditMethod = async (m: PaymentMethod) => {
    if (!selectedVendor?.id) return
    setEditingMethodId(m.id)
    setMfType(m.method_type)
    setMfLabel(m.label || '')
    setMfIsDefault(m.is_default)
    setMfDetails({})
    setMfInstructions('')
    setShowMethodForm(true)
    // Pull the decrypted details to prefill the form
    try {
      const res = await fetch(`/api/vendors/${selectedVendor.id}/payment-methods?reveal=${m.id}`)
      const data = await res.json()
      if (res.ok) {
        const d: PaymentDetails = data.details || {}
        const { instructions, ...rest } = d
        setMfDetails(rest)
        setMfInstructions(instructions || '')
      }
    } catch {
      toast.error('Could not load payment details for editing')
    }
  }

  const saveMethod = async () => {
    if (!selectedVendor?.id) return
    const details: PaymentDetails = { ...mfDetails }
    if (mfInstructions.trim()) details.instructions = mfInstructions.trim()
    // Require at least one non-empty detail
    const hasDetail = Object.values(details).some((v) => String(v || '').trim() !== '')
    if (!hasDetail) {
      toast.error('Please enter at least one payment detail')
      return
    }
    setSavingMethod(true)
    try {
      const res = await fetch(`/api/vendors/${selectedVendor.id}/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingMethodId || undefined,
          method_type: mfType,
          label: mfLabel.trim() || null,
          is_default: mfIsDefault,
          details,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      toast.success(editingMethodId ? 'Payment method updated' : 'Payment method saved')
      setShowMethodForm(false)
      setRevealed({})
      loadPaymentMethods()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save payment method')
    } finally {
      setSavingMethod(false)
    }
  }

  const deleteMethod = async (m: PaymentMethod) => {
    if (!selectedVendor?.id) return
    if (!confirm(`Delete this ${paymentMethodLabel(m.method_type)} payment method? This cannot be undone.`)) return
    try {
      await fetch(`/api/vendors/${selectedVendor.id}/payment-methods?methodId=${m.id}`, { method: 'DELETE' })
      setRevealed((prev) => {
        const next = { ...prev }
        delete next[m.id]
        return next
      })
      setPaymentMethods((prev) => prev.filter((x) => x.id !== m.id))
      toast.success('Payment method deleted')
    } catch {
      toast.error('Failed to delete payment method')
    }
  }

  const toggleReveal = async (m: PaymentMethod) => {
    if (!selectedVendor?.id) return
    if (revealed[m.id]) {
      setRevealed((prev) => {
        const next = { ...prev }
        delete next[m.id]
        return next
      })
      return
    }
    setRevealingId(m.id)
    try {
      const res = await fetch(`/api/vendors/${selectedVendor.id}/payment-methods?reveal=${m.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setRevealed((prev) => ({ ...prev, [m.id]: data.details || {} }))
    } catch {
      toast.error('Could not reveal payment details')
    } finally {
      setRevealingId(null)
    }
  }

  const copyValue = (value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Could not copy')
    )
  }

  const detailFieldLabel = (key: string): string => {
    for (const fields of Object.values(METHOD_FIELDS)) {
      const f = fields.find((x) => x.key === key)
      if (f) return f.label
    }
    if (key === 'instructions') return 'Instructions / Notes'
    return key
  }

  // Open the mark-paid form, prefilling from any existing record
  const openPaidForm = () => {
    setPaidMethod(paymentRecord?.paid_method || 'wire')
    setPaidReference(paymentRecord?.paid_reference || '')
    setPaidDate(
      paymentRecord?.paid_at
        ? new Date(paymentRecord.paid_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    )
    setPaidNotes(paymentRecord?.notes || '')
    setShowPaidForm(true)
  }

  // Save (or clear) the paid status for the current report period
  const savePayment = async (status: 'paid' | 'unpaid') => {
    if (!report || !selectedVendor?.id) return
    setSavingPayment(true)
    try {
      const res = await fetch(`/api/vendors/${selectedVendor.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          fullAmount: report.totalPayout,
          status,
          paidMethod: status === 'paid' ? paidMethod : null,
          paidReference: status === 'paid' ? paidReference : null,
          paidAt: status === 'paid' ? paidDate : null,
          notes: paidNotes,
        }),
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
        return
      }
      setPaymentRecord(data.record)
      setShowPaidForm(false)
      toast.success(status === 'paid' ? 'Payout recorded as paid' : 'Payout marked as unpaid')
      // Refresh the ledger so already-paid totals reflect the change
      const params = new URLSearchParams({ periodStart: report.periodStart, periodEnd: report.periodEnd })
      fetch(`/api/vendors/${selectedVendor.id}/payments?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          setPaymentRecord(d.record || null)
          setAlreadyPaid(Number(d.alreadyPaid) || 0)
          setPaidPeriods(d.paidPeriods || [])
        })
        .catch(() => {})
    } catch {
      toast.error('Failed to update payment status')
    } finally {
      setSavingPayment(false)
    }
  }

  const sendEmailStatement = async () => {
    if (!report || !selectedVendor) return
    const recipientEmail = emailOverride.trim().replace(/[,;]\s*$/, '')
    const recipientList = recipientEmail
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
    if (recipientList.length === 0) {
      toast.error('Please enter at least one recipient email address')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const badEmails = recipientList.filter((e) => !emailRegex.test(e))
    if (badEmails.length > 0) {
      toast.error(`Invalid email address${badEmails.length > 1 ? 'es' : ''}: ${badEmails.join(', ')}`)
      return
    }
    setSendingEmail(true)
    setShowEmailConfirm(false)
    try {
      const res = await fetch('/api/billing/send-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName: selectedVendor.company_name || selectedVendor.contact_name,
          vendorEmail: recipientList.join(','),
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          paymentDueDate: report.paymentDueDate,
          totalCalls: report.totalCalls,
          totalPayout: report.totalPayout,
          totalRevenue: report.totalRevenue,
          margin: report.margin,
          offerBreakdown: report.offerBreakdown,
          alreadyPaid: totalPaid,
          balanceDue: stillOwed,
          paidPeriods: paidPeriods.map((p) => ({
            periodStart: p.period_start,
            periodEnd: p.period_end,
            amount: Number(p.amount) || 0,
            paidAt: p.paid_at,
          })),
        }),
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(
          data.message ||
            `Statement sent to ${recipientList.length === 1 ? recipientList[0] : `${recipientList.length} recipients`}`
        )
      }
    } catch {
      toast.error('Failed to send billing statement')
    } finally {
      setSendingEmail(false)
    }
  }

  const periodLabel = periodStart && periodEnd ? `${formatDate(periodStart)} – ${formatDate(periodEnd)}` : ''

  // Ledger math for the current report period.
  // exactPaid = amount recorded against THIS exact date range (if marked paid).
  // alreadyPaid = sum of paid sub-periods contained within this range (paid in earlier, smaller reports).
  const exactPaid = paymentRecord?.status === 'paid' ? Number(paymentRecord.amount) || 0 : 0
  const totalPaid = alreadyPaid + exactPaid
  const totalPayout = report?.totalPayout ?? 0
  const stillOwed = Math.max(0, Math.round((totalPayout - totalPaid) * 100) / 100)
  const fullySettled = totalPaid > 0 && stillOwed <= 0.005
  const partiallyPaid = totalPaid > 0 && !fullySettled

  // Quick presets that fill the From/To date inputs
  const applyQuickRange = (start: string, end: string) => {
    setPeriodStart(start)
    setPeriodEnd(end)
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            {/* Vendor selector */}
            <div className="flex-1 min-w-[250px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Vendor / Traffic Source</label>
              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full justify-between text-sm h-10"
                  onClick={() => setVendorDropdownOpen(!vendorDropdownOpen)}
                  disabled={loadingVendors}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    {loadingVendors ? 'Loading vendors...' : selectedVendor ? selectedVendor.company_name : 'Select a vendor'}
                  </span>
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', vendorDropdownOpen && 'rotate-180')} />
                </Button>
                {vendorDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setVendorDropdownOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-lg border bg-background shadow-lg py-1 max-h-[300px] overflow-y-auto">
                      {vendors.map((v) => (
                        <button
                          key={v.td_source_id}
                          className={cn(
                            'w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors',
                            selectedVendor?.td_source_id === v.td_source_id && 'bg-primary/10 text-primary font-medium'
                          )}
                          onClick={() => {
                            setSelectedVendor(v)
                            setVendorDropdownOpen(false)
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{v.company_name}</span>
                            {v.callsCount > 0 && <span className="text-xs text-muted-foreground">({v.callsCount} calls)</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {v.contact_name}{v.email ? ` · ${v.email}` : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Custom date range selector */}
            <div className="min-w-[240px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Billing Period</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="date"
                    aria-label="Start date"
                    value={periodStart}
                    max={periodEnd || undefined}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full h-10 rounded-lg border bg-background pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <span className="text-muted-foreground text-sm">to</span>
                <div className="relative flex-1">
                  <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="date"
                    aria-label="End date"
                    value={periodEnd}
                    min={periodStart || undefined}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full h-10 rounded-lg border bg-background pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {getBillingPeriods().slice(0, 4).map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyQuickRange(p.start, p.end)}
                    className={cn(
                      'text-xs px-2 py-1 rounded-md border transition-colors hover:bg-muted/50',
                      periodStart === p.start && periodEnd === p.end
                        ? 'bg-primary/10 text-primary border-primary/30 font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <Button
              onClick={generateReport}
              disabled={!selectedVendor || !periodStart || !periodEnd || loadingReport}
              className="h-10"
            >
              {loadingReport ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
              ) : (
                <><Receipt className="h-4 w-4 mr-2" /> Generate Report</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Details vault */}
      {selectedVendor?.id && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Payment Details</CardTitle>
                <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50">
                  <ShieldCheck className="h-3 w-3" /> Encrypted
                </Badge>
              </div>
              <Button size="sm" variant="outline" onClick={openAddMethod}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Method
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              How you pay <span className="font-medium text-foreground">{selectedVendor.company_name}</span>. Sensitive numbers are stored encrypted and hidden until you reveal them.
            </p>
          </CardHeader>
          <CardContent>
            {paymentMethods.length === 0 ? (
              <div className="text-center py-8 rounded-lg border border-dashed">
                <Wallet className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No payment methods saved yet.</p>
                <Button size="sm" variant="ghost" className="mt-2 text-primary" onClick={openAddMethod}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add the first one
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((m) => {
                  const isOpen = !!revealed[m.id]
                  const details = revealed[m.id] || {}
                  const orderedKeys = [
                    ...(METHOD_FIELDS[m.method_type]?.map((f) => f.key) || []),
                    'instructions',
                  ].filter((k) => details[k] !== undefined && String(details[k]).trim() !== '')
                  return (
                    <div key={m.id} className="rounded-lg border">
                      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Wallet className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{paymentMethodLabel(m.method_type)}</span>
                              {m.label && <span className="text-sm text-muted-foreground">· {m.label}</span>}
                              {m.is_default && (
                                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 gap-1">
                                  <Star className="h-3 w-3 fill-current" /> Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground font-mono truncate">{m.mask || '••••••'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => toggleReveal(m)} disabled={revealingId === m.id}>
                            {revealingId === m.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isOpen ? (
                              <><EyeOff className="h-4 w-4 mr-1.5" /> Hide</>
                            ) : (
                              <><Eye className="h-4 w-4 mr-1.5" /> Reveal</>
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditMethod(m)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => deleteMethod(m)} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="border-t bg-muted/30 px-4 py-3">
                          {orderedKeys.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No details saved.</p>
                          ) : (
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                              {orderedKeys.map((k) => (
                                <div key={k} className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <dt className="text-xs text-muted-foreground">{detailFieldLabel(k)}</dt>
                                    <dd className="text-sm font-mono break-all">{details[k]}</dd>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyValue(details[k])} title="Copy">
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </dl>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Report Results */}
      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="pt-5 pb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Payout</p>
                <p className="text-2xl font-semibold font-display tracking-tight mt-1">${formatMoney(report.totalPayout)}</p>
                <p className="text-xs text-muted-foreground mt-1">Amount owed to vendor</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-5 pb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Revenue</p>
                <p className="text-2xl font-semibold font-display tracking-tight mt-1">${formatMoney(report.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">Margin: ${formatMoney(report.margin)} ({report.totalRevenue > 0 ? ((report.margin / report.totalRevenue) * 100).toFixed(1) : '0'}%)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Converted Calls</p>
                <p className="text-2xl font-semibold font-display tracking-tight mt-1">{report.totalCalls}</p>
                <p className="text-xs text-muted-foreground mt-1">Across {report.offerBreakdown.length} offer{report.offerBreakdown.length !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment Due</p>
                <p className="text-2xl font-semibold font-display tracking-tight mt-1">{formatDate(report.paymentDueDate)}</p>
                <p className="text-xs text-muted-foreground mt-1">Net 15 bi-weekly</p>
              </CardContent>
            </Card>
          </div>

          {/* Payout Payment Status (ledger-aware) */}
          {selectedVendor?.id && (
            <Card className={cn('border-l-4', fullySettled ? 'border-l-emerald-500' : partiallyPaid ? 'border-l-blue-500' : 'border-l-amber-500')}>
              <CardContent className="pt-5 pb-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {fullySettled ? (
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
                    ) : partiallyPaid ? (
                      <Receipt className="h-8 w-8 text-blue-500 shrink-0" />
                    ) : (
                      <Clock className="h-8 w-8 text-amber-500 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">Payout Status</span>
                        <Badge className={fullySettled ? 'bg-emerald-500 hover:bg-emerald-500 text-white' : partiallyPaid ? 'bg-blue-500 hover:bg-blue-500 text-white' : 'bg-amber-500 hover:bg-amber-500 text-white'}>
                          {fullySettled ? 'Paid in Full' : partiallyPaid ? 'Partially Paid' : 'Unpaid'}
                        </Badge>
                      </div>

                      {/* Ledger summary */}
                      <div className="text-sm mt-1.5 space-y-0.5">
                        <p className="text-muted-foreground">
                          Total payout for {periodLabel}: <span className="font-mono font-medium text-foreground">${formatMoney(totalPayout)}</span>
                        </p>
                        {totalPaid > 0 && (
                          <p className="text-emerald-600">
                            Already paid: <span className="font-mono font-medium">${formatMoney(totalPaid)}</span>
                          </p>
                        )}
                        {!fullySettled && (
                          <p className="text-foreground font-medium">
                            Still owed: <span className="font-mono text-red-600">${formatMoney(stillOwed)}</span>
                          </p>
                        )}
                      </div>

                      {/* Direct payment (exact period) details */}
                      {paymentRecord?.status === 'paid' && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          This period recorded ${formatMoney(exactPaid)} paid {paymentRecord.paid_at ? formatDate(paymentRecord.paid_at) : ''}
                          {paymentRecord.paid_method ? ` via ${paymentMethodLabel(paymentRecord.paid_method)}` : ''}
                          {paymentRecord.paid_reference ? ` · Ref: ${paymentRecord.paid_reference}` : ''}
                        </p>
                      )}
                      {paymentRecord?.notes && (
                        <p className="text-xs text-muted-foreground mt-1">Note: {paymentRecord.notes}</p>
                      )}

                      {/* Ledger breakdown of earlier sub-period payments contained in this range */}
                      {paidPeriods.length > 0 && (
                        <div className="mt-2 rounded-lg border bg-muted/30 px-3 py-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Earlier payments within this range</p>
                          <ul className="space-y-0.5">
                            {paidPeriods.map((p) => (
                              <li key={p.id} className="text-xs flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">
                                  {formatDate(p.period_start)} – {formatDate(p.period_end)}
                                  {p.paid_method ? ` · ${paymentMethodLabel(p.paid_method)}` : ''}
                                </span>
                                <span className="font-mono text-emerald-600">${formatMoney(Number(p.amount) || 0)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {fullySettled ? (
                      <>
                        {paymentRecord?.status === 'paid' && (
                          <Button variant="outline" size="sm" onClick={openPaidForm}>Edit Payment</Button>
                        )}
                        {exactPaid > 0 && (
                          <Button variant="ghost" size="sm" onClick={() => savePayment('unpaid')} disabled={savingPayment}>
                            Mark Unpaid
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={openPaidForm} className="bg-emerald-600 hover:bg-emerald-700">
                          <CheckCircle2 className="h-4 w-4 mr-2" /> {partiallyPaid ? `Pay Remaining $${formatMoney(stillOwed)}` : 'Mark as Paid'}
                        </Button>
                        {paymentRecord?.status === 'paid' && (
                          <Button variant="ghost" size="sm" onClick={() => savePayment('unpaid')} disabled={savingPayment}>
                            Mark Unpaid
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Offer Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Payout by Offer
                  <span className="text-sm font-normal text-muted-foreground">
                    {selectedVendor?.company_name} · {periodLabel}
                  </span>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={expandAll}>
                  {expandedOffers.size === report.offerBreakdown.length ? 'Collapse All' : 'Expand All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {report.offerBreakdown.map((offer) => (
                  <div key={offer.offer} className="border rounded-lg">
                    {/* Offer Summary Row */}
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => toggleOffer(offer.offer)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedOffers.has(offer.offer) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <span className="font-medium">{offer.offer}</span>
                          <span className="text-sm text-muted-foreground ml-2">{offer.calls} call{offer.calls !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <span className="text-muted-foreground">Avg Duration:</span>{' '}
                          <span className="font-mono">{formatDuration(offer.avgDuration)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground">Avg Payout:</span>{' '}
                          <span className="font-mono">${formatMoney(offer.avgPayout)}</span>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <span className="font-semibold font-mono text-emerald-600">${formatMoney(offer.payout)}</span>
                        </div>
                      </div>
                    </button>

                    {/* Expanded Call Details */}
                    {expandedOffers.has(offer.offer) && (
                      <div className="border-t px-4 py-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="pb-2 font-medium">Date</th>
                              <th className="pb-2 font-medium">Caller</th>
                              <th className="pb-2 font-medium">City</th>
                              <th className="pb-2 font-medium text-right">Duration</th>
                              <th className="pb-2 font-medium text-right">Payout</th>
                            </tr>
                          </thead>
                          <tbody>
                            {offer.callDetails.map((call) => (
                              <tr key={call.id} className="border-t border-dashed hover:bg-muted/30">
                                <td className="py-1.5 font-mono text-xs">{formatDateTime(call.date)}</td>
                                <td className="py-1.5 font-mono text-xs">{call.callerNumber}</td>
                                <td className="py-1.5 text-xs">{call.city}</td>
                                <td className="py-1.5 text-right font-mono text-xs">{formatDuration(call.duration)}</td>
                                <td className="py-1.5 text-right font-mono text-xs font-medium">${formatMoney(call.payout)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}

                {/* Total Row */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg font-semibold">
                  <span>Total ({report.totalCalls} calls)</span>
                  <span className="font-mono text-emerald-600 text-lg">${formatMoney(report.totalPayout)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vendor Statement Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">Vendor Billing Statement</h3>
                  {totalPaid > 0 ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      Send {selectedVendor?.company_name} ({selectedVendor?.email}) a summary of their converted calls and payout for {periodLabel}.
                      Of the <span className="font-semibold text-foreground">${formatMoney(totalPayout)}</span> total payout,{' '}
                      <span className="font-semibold text-blue-600">${formatMoney(totalPaid)}</span> was already paid, leaving a balance of{' '}
                      <span className="font-semibold text-emerald-600">${formatMoney(stillOwed)}</span> due by {formatDate(report.paymentDueDate)}.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">
                      Send {selectedVendor?.company_name} ({selectedVendor?.email}) a summary of their converted calls and payout for {periodLabel}.
                      Payment of <span className="font-semibold text-foreground">${formatMoney(report.totalPayout)}</span> is due by {formatDate(report.paymentDueDate)}.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => toast.info('CSV export coming soon')}>
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                  <Button size="sm" onClick={handleEmailStatement} disabled={sendingEmail}>
                    {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                    {sendingEmail ? 'Sending…' : 'Email Statement'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Email Confirmation Dialog */}
      {showEmailConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowEmailConfirm(false)}>
          <div className="bg-background rounded-xl shadow-xl border p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Send Billing Statement</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Send a detailed payout statement for <strong>{selectedVendor?.company_name}</strong> ({periodLabel}) to:
            </p>
            <input
              type="text"
              value={emailOverride}
              onChange={(e) => setEmailOverride(e.target.value)}
              placeholder="vendor@email.com, accounting@email.com"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">Send to multiple people by separating emails with a comma.</p>
            {selectedVendor?.id && (
              <div className="mt-3">
                {billingContacts.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Saved contacts (click to add)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {billingContacts.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 pl-2.5 pr-1 py-1 text-xs">
                          <button type="button" className="hover:text-primary" onClick={() => addRecipient(c.email)}>{c.email}</button>
                          <button type="button" className="rounded-full hover:bg-muted p-0.5" onClick={() => removeContact(c.id)} title="Remove saved contact">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <button type="button" onClick={saveTypedRecipients} disabled={savingContact} className="text-xs text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50">
                  <Save className="h-3 w-3" /> Save these email(s) for next time
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Total: <strong>${report ? formatMoney(report.totalPayout) : '0.00'}</strong> · Due: {report ? formatDate(report.paymentDueDate) : ''}
            </p>
            {totalPaid > 0 && (
              <p className="text-xs text-blue-600 mt-1">
                ${formatMoney(totalPaid)} of this period was already paid — the statement will show a balance due of <strong>${formatMoney(stillOwed)}</strong>.
              </p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" size="sm" onClick={() => setShowEmailConfirm(false)}>Cancel</Button>
              <Button size="sm" onClick={sendEmailStatement}>
                <Mail className="h-4 w-4 mr-2" /> Send Statement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Paid Dialog */}
      {showPaidForm && report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPaidForm(false)}>
          <div className="bg-background rounded-xl shadow-xl border p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Record Payment</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Recording a payment of <strong className="text-foreground">${formatMoney(stillOwed)}</strong> to <strong>{selectedVendor?.company_name}</strong> for {periodLabel}.
              {totalPaid > 0 && (
                <span className="block mt-1 text-xs">
                  ${formatMoney(totalPaid)} of the ${formatMoney(totalPayout)} total was already paid, so only the remaining balance is recorded here.
                </span>
              )}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Payment Method</label>
                <select
                  value={paidMethod}
                  onChange={(e) => setPaidMethod(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="wire">Wire Transfer</option>
                  <option value="ach">ACH</option>
                  <option value="paypal">PayPal</option>
                  <option value="zelle">Zelle</option>
                  <option value="check">Check</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Payment Date</label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Reference / Confirmation # <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={paidReference}
                  onChange={(e) => setPaidReference(e.target.value)}
                  placeholder="e.g. Wire #12345"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea
                  value={paidNotes}
                  onChange={(e) => setPaidNotes(e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" size="sm" onClick={() => setShowPaidForm(false)}>Cancel</Button>
              <Button size="sm" onClick={() => savePayment('paid')} disabled={savingPayment} className="bg-emerald-600 hover:bg-emerald-700">
                {savingPayment ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Save Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Payment Method Dialog */}
      {showMethodForm && selectedVendor?.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => !savingMethod && setShowMethodForm(false)}>
          <div className="bg-background rounded-xl shadow-xl border p-6 w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">{editingMethodId ? 'Edit Payment Method' : 'Add Payment Method'}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              For <strong>{selectedVendor.company_name}</strong>. Details are encrypted before they're saved.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Method Type</label>
                  <select
                    value={mfType}
                    onChange={(e) => { setMfType(e.target.value); setMfDetails({}) }}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="ach">ACH Transfer</option>
                    <option value="wire">Wire Transfer</option>
                    <option value="paypal">PayPal</option>
                    <option value="zelle">Zelle</option>
                    <option value="check">Check</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Label <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={mfLabel}
                    onChange={(e) => setMfLabel(e.target.value)}
                    placeholder="e.g. Primary business account"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              {(METHOD_FIELDS[mfType] || []).map((f) => (
                <div key={f.key}>
                  <label className="text-sm font-medium mb-1 block">
                    {f.label}{f.sensitive && <ShieldCheck className="inline h-3 w-3 ml-1 text-emerald-600" />}
                  </label>
                  <input
                    type="text"
                    value={mfDetails[f.key] || ''}
                    onChange={(e) => setMfDetails((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder || ''}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              ))}

              <div>
                <label className="text-sm font-medium mb-1 block">Instructions / Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea
                  value={mfInstructions}
                  onChange={(e) => setMfInstructions(e.target.value)}
                  rows={2}
                  placeholder="Any extra notes for paying this vendor"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={mfIsDefault}
                  onChange={(e) => setMfIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                Set as the default way to pay this vendor
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" size="sm" onClick={() => setShowMethodForm(false)} disabled={savingMethod}>Cancel</Button>
              <Button size="sm" onClick={saveMethod} disabled={savingMethod}>
                {savingMethod ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {editingMethodId ? 'Save Changes' : 'Save Method'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!report && !loadingReport && (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">Generate a Billing Report</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Select a vendor and billing period above to generate a detailed payout report.
              Reports show all converted calls grouped by offer with individual payouts.
            </p>
            <div className="mt-6 text-xs text-muted-foreground">
              <p><strong>Payment Terms:</strong> Bi-weekly, Net 15</p>
              <p className="mt-1">1st–15th → payable on last day of month &nbsp;·&nbsp; 16th–30th → payable on 16th of next month</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
