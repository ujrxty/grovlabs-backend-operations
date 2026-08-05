export interface RevenueBreakdownRow {
  name: string
  revenue: number
  payout: number
  conversions: number
}

export interface DashboardStats {
  // TrackDrive date-filtered data
  totalCalls: number
  conversions: number
  activeOffers: number
  pausedOffers: number
  totalOffers: number
  activeVendors: number
  pausedVendors: number
  totalVendors: number
  // Revenue for selected date range (from actual converted call records)
  revenue: number
  payout: number
  revenueConversions: number
  revenueByBuyer: RevenueBreakdownRow[]
  revenueByOffer: RevenueBreakdownRow[]
  // Local DB QA data
  flaggedCalls: number
  analyzedCalls: number
  pendingApps: number
  rangeLabel: string
  rangeFrom: string
  rangeTo: string
  recentFlags: RecentFlag[]
}

export interface RecentFlag {
  id: string
  flag_type: string
  severity: string
  details: string | null
  created_at: string
  call_id: string
  campaign: string
  duration: number
}

export interface VendorProfile {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  website: string | null
  td_source_id: string | null
  td_source_name: string | null
  td_number: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface InsertionOrder {
  id: string
  io_number: string
  vendor_id: string
  campaign_id: string
  payout: string
  payout_type: string
  billing_cycle: string
  min_duration: number | null
  terms: string
  special_terms: string | null
  status: string
  sign_token: string
  vendor_signed_at: string | null
  vendor_sign_name: string | null
  counter_signed_at: string | null
  counter_sign_by: string | null
  effective_date: string | null
  expiry_date: string | null
  created_at: string
  vendor?: { company_name: string; contact_name: string }
  campaign?: { name: string; industry: string }
  lead_purchase_agreements?: LeadPurchaseAgreement[]
}

export interface CallRecord {
  id: string
  trackdrive_call_id: string
  affiliate_id: string | null
  campaign_id: string | null
  campaign_name: string | null
  buyer_id: string | null
  buyer_name: string | null
  caller_number: string | null
  duration: number
  recording_url: string | null
  status: string
  created_at: string
  affiliate: { name: string; trackdrive_id: string } | null
  qa_analysis: QAAnalysis | null
  transcript: { transcript_text: string } | null
}

export interface QAAnalysis {
  id: string
  detected_triggers: string[]
  confidence_score: number
  is_flagged: boolean
  flag_reason: string | null
  ai_summary: string | null
  high_sensitivity: boolean
  analyzed_at: string
}

export interface LeadPurchaseAgreement {
  id: string
  io_id: string
  vendor_id: string
  status: string
  vendor_signed_at: string | null
  vendor_sign_name: string | null
  counter_signed_at: string | null
  counter_sign_by: string | null
  created_at: string
}

export interface BotSetting {
  id: string
  key: string
  value: string
  updated_at: string
}

export interface Campaign {
  id: string
  name: string
  industry: string
  call_type: string
  description: string | null
  payout: string
  payout_display: string | null
  payout_type: string
  billing_cycle: string
  min_duration: number | null
  geographic_focus: string | null
  allowed_traffic: string | null
  restricted_traffic: string | null
  requirements: string | null
  compliance_notes: string | null
  terms_template: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface NonConversionReview {
  id: string
  trackdrive_call_id: string
  review_date: string
  vendor_name: string
  vendor_td_id: string | null
  buyer_name: string | null
  buyer_td_id: string | null
  campaign_name: string | null
  caller_number: string | null
  caller_city: string | null
  caller_state: string | null
  number_called: string | null
  duration: number
  call_status: string | null
  buyer_leg_answered: boolean | null
  fault_side: string
  outcome_reason: string
  what_happened: string
  fix_suggestion: string | null
  recording_url: string | null
  raw_ai_response: any
  created_at: string
}

export interface NonConversionBreakdownRow {
  name: string
  total: number
  reasons: { reason: string; count: number }[]
}

export interface NonConversionSummary {
  total: number
  buyer: number
  vendor: number
  external: number
  neutral: number
}
