// Shared constants and helpers for the Sales Monitoring QA feature
// (reads the sales_qa_review table written by the QA service).

export const CAMPAIGN_CATEGORIES = ['auto_insurance', 'pest_control', 'home_insurance'] as const
export type CampaignCategory = (typeof CAMPAIGN_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<string, string> = {
  auto_insurance: 'Auto Insurance',
  pest_control: 'Pest Control',
  home_insurance: 'Home Insurance',
}

export function categoryLabel(cat: string | null | undefined): string {
  if (!cat) return 'Uncategorized'
  return CATEGORY_LABELS[cat] ?? cat.replace(/_/g, ' ')
}

// Outcome funnel, ordered best -> worst (a lead moves down this ladder).
export const OUTCOME_ORDER = [
  'sale_completed',
  'quote_accepted_deferred',
  'quote_pending_approval',
  'quote_received_reviewing',
  'quote_declined',
  'no_quote_issued',
] as const

export const OUTCOME_LABELS: Record<string, string> = {
  sale_completed: 'Sale completed',
  quote_accepted_deferred: 'Accepted (deferred)',
  quote_pending_approval: 'Pending approval',
  quote_received_reviewing: 'Reviewing quote',
  quote_declined: 'Quote declined',
  no_quote_issued: 'No quote issued',
}

export function outcomeLabel(o: string | null | undefined): string {
  if (!o) return '—'
  return OUTCOME_LABELS[o] ?? o.replace(/_/g, ' ')
}

// Tailwind color classes per outcome (badge/pill styling).
export const OUTCOME_BADGE: Record<string, string> = {
  sale_completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  quote_accepted_deferred: 'bg-teal-100 text-teal-700 border-teal-200',
  quote_pending_approval: 'bg-sky-100 text-sky-700 border-sky-200',
  quote_received_reviewing: 'bg-violet-100 text-violet-700 border-violet-200',
  quote_declined: 'bg-amber-100 text-amber-700 border-amber-200',
  no_quote_issued: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function outcomeBadgeClass(o: string | null | undefined): string {
  return (o && OUTCOME_BADGE[o]) || 'bg-slate-100 text-slate-600 border-slate-200'
}

export const FOLLOW_THROUGH_ORDER = ['high', 'medium', 'low', 'none'] as const

export const FOLLOW_THROUGH_BADGE: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-sky-100 text-sky-700 border-sky-200',
  low: 'bg-amber-100 text-amber-700 border-amber-200',
  none: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function followThroughBadgeClass(f: string | null | undefined): string {
  return (f && FOLLOW_THROUGH_BADGE[f]) || 'bg-slate-100 text-slate-600 border-slate-200'
}

// Today's date (YYYY-MM-DD) in Eastern time, matching how the QA service
// stamps review_date.
export const SALES_QA_TZ = 'America/New_York'

export function todayEastern(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SALES_QA_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}
// Backwards compatibility alias
export const todayPhoenix = todayEastern

// Returns YYYY-MM-DD `days` days before today (Eastern), inclusive helper.
export function daysAgoEastern(days: number): string {
  const now = new Date()
  const shifted = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SALES_QA_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(shifted)
}
// Backwards compatibility alias
export const daysAgoPhoenix = daysAgoEastern

// First day of the current month (Eastern) as YYYY-MM-DD.
export function startOfMonthEastern(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALES_QA_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  return `${y}-${m}-01`
}
// Backwards compatibility alias
export const startOfMonthPhoenix = startOfMonthEastern

export interface SalesQaVendor {
  vendor_name: string
  vendor_td_id: string | null
  total: number
  quotesIssued: number
  quoteRate: number
  outcomes: Record<string, number>
  followThrough: Record<string, number>
  revenue: number
  avgDuration: number
}

export interface SalesQaCampaign {
  category: string
  total: number
  quotesIssued: number
  quoteRate: number
  outcomes: Record<string, number>
  followThrough: Record<string, number>
  revenue: number
  vendors: SalesQaVendor[]
}

export interface SalesQaCall {
  trackdrive_call_id: string
  review_date: string
  vendor_name: string
  buyer_name: string | null
  campaign_name: string | null
  caller_city: string | null
  caller_state: string | null
  duration: number
  revenue: number | null
  quote_issued: boolean
  outcome_category: string
  follow_through_likelihood: string
  quote_type: string | null
  quote_amount: string | null
  payment_mentioned: boolean
  caller_response: string | null
  what_happened: string
  key_quote: string | null
  recording_url: string | null
}
