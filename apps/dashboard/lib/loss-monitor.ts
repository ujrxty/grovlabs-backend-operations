// Loss Monitor engine.
// Evaluates the current day's TrackDrive call performance against configurable
// thresholds and produces a structured list of alerts. Consumed by the
// /api/loss-monitor/run (email) and /preview (UI) routes.

import { getVendorScorecard, type ScorecardVendor } from '@/lib/trackdrive'

export interface LossSettings {
  alerts_enabled: boolean
  recipients: string
  active_from_hour: number
  active_to_hour: number
  low_conv_enabled: boolean
  low_conv_pct: number
  low_conv_min_calls: number
  no_answer_enabled: boolean
  no_answer_threshold: number
  low_rpc_enabled: boolean
  low_rpc_threshold: number
  low_rpc_min_calls: number
  near_cap_enabled: boolean
  near_cap_pct: number
  no_connect_enabled: boolean
  no_connect_min_calls: number
  zero_conv_enabled: boolean
  zero_conv_min_calls: number
  short_dur_enabled: boolean
  short_dur_seconds: number
  short_dur_min_calls: number
}

export const DEFAULT_LOSS_SETTINGS: LossSettings = {
  alerts_enabled: true,
  recipients: 'uj@grovlabs.com',
  active_from_hour: 8,
  active_to_hour: 18,
  low_conv_enabled: true,
  low_conv_pct: 15,
  low_conv_min_calls: 5,
  no_answer_enabled: true,
  no_answer_threshold: 5,
  low_rpc_enabled: true,
  low_rpc_threshold: 5,
  low_rpc_min_calls: 10,
  near_cap_enabled: false,
  near_cap_pct: 80,
  no_connect_enabled: true,
  no_connect_min_calls: 5,
  zero_conv_enabled: true,
  zero_conv_min_calls: 10,
  short_dur_enabled: true,
  short_dur_seconds: 60,
  short_dur_min_calls: 10,
}

export type AlertType =
  | 'low_conversion'
  | 'no_answers'
  | 'low_rpc'
  | 'no_connect_buyer'
  | 'zero_conversion'
  | 'short_duration'

export interface LossAlert {
  type: AlertType
  severity: 'warning' | 'critical'
  vendor?: string
  campaign?: string
  buyer?: string
  message: string
  calls: number
  revenue?: number
}

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  low_conversion: 'Low Conversion',
  no_answers: 'No Answers',
  low_rpc: 'Low RPC',
  no_connect_buyer: 'No-Connect by Buyer',
  zero_conversion: 'Zero Conversions (Vendor × Buyer)',
  short_duration: 'Short Duration',
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Evaluate alerts from an already-computed scorecard.
export function evaluateAlerts(vendors: ScorecardVendor[], s: LossSettings): LossAlert[] {
  const alerts: LossAlert[] = []

  // Buyer-level aggregation for the No-Connect-by-Buyer check.
  const buyerAgg = new Map<string, { calls: number; connected: number }>()

  for (const v of vendors) {
    for (const c of v.campaigns) {
      const connected = c.calls - c.noAnswers

      // aggregate for buyer-level check
      const b = buyerAgg.get(c.buyer) || { calls: 0, connected: 0 }
      b.calls += c.calls
      b.connected += connected
      buyerAgg.set(c.buyer, b)

      // Low Conversion (per vendor×campaign) — uses CONNECTED calls as the base
      if (s.low_conv_enabled && connected >= s.low_conv_min_calls && c.convPct < s.low_conv_pct) {
        alerts.push({
          type: 'low_conversion', severity: 'warning', vendor: v.vendor, campaign: c.campaign, buyer: c.buyer,
          message: `Conversion ${c.convPct.toFixed(1)}% on ${connected} connected calls (below ${s.low_conv_pct}%)`,
          calls: c.calls, revenue: c.revenue,
        })
      }

      // No Answers (per vendor×campaign)
      if (s.no_answer_enabled && c.noAnswers >= s.no_answer_threshold) {
        alerts.push({
          type: 'no_answers', severity: 'warning', vendor: v.vendor, campaign: c.campaign, buyer: c.buyer,
          message: `${c.noAnswers} no-answer calls (threshold ${s.no_answer_threshold})`,
          calls: c.calls,
        })
      }

      // Low RPC (per vendor×campaign)
      if (s.low_rpc_enabled && c.calls >= s.low_rpc_min_calls && c.rpc <= s.low_rpc_threshold) {
        alerts.push({
          type: 'low_rpc', severity: 'warning', vendor: v.vendor, campaign: c.campaign, buyer: c.buyer,
          message: `RPC ${money(c.rpc)} across ${c.calls} calls (at/below ${money(s.low_rpc_threshold)})`,
          calls: c.calls, revenue: c.revenue,
        })
      }

      // Zero Conversions (vendor×buyer; in TD 1 buyer ≈ 1 campaign)
      if (s.zero_conv_enabled && c.calls >= s.zero_conv_min_calls && c.conversions === 0) {
        alerts.push({
          type: 'zero_conversion', severity: 'critical', vendor: v.vendor, campaign: c.campaign, buyer: c.buyer,
          message: `${c.calls} calls, 0 conversions`,
          calls: c.calls,
        })
      }

      // Short Duration (per vendor×campaign)
      if (s.short_dur_enabled && c.calls >= s.short_dur_min_calls && c.avgDuration < s.short_dur_seconds) {
        alerts.push({
          type: 'short_duration', severity: 'warning', vendor: v.vendor, campaign: c.campaign, buyer: c.buyer,
          message: `Avg duration ${c.avgDuration}s across ${c.calls} calls (below ${s.short_dur_seconds}s)`,
          calls: c.calls,
        })
      }
    }
  }

  // No-Connect by Buyer
  if (s.no_connect_enabled) {
    for (const [buyer, agg] of Array.from(buyerAgg.entries())) {
      if (agg.calls >= s.no_connect_min_calls && agg.connected === 0) {
        alerts.push({
          type: 'no_connect_buyer', severity: 'critical', buyer,
          message: `${agg.calls} calls to “${buyer}” but 0 connected — likely a buyer-side tech issue`,
          calls: agg.calls,
        })
      }
    }
  }

  // critical first, then by call volume
  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
    return b.calls - a.calls
  })
}

export interface LossMonitorResult {
  from: string
  to: string
  totalCalls: number
  alerts: LossAlert[]
}

// Compute alerts for a date range using current settings.
export async function computeLossAlerts(from: Date, to: Date, s: LossSettings): Promise<LossMonitorResult> {
  const vendors = await getVendorScorecard(from, to)
  const totalCalls = vendors.reduce((n, v) => n + v.calls, 0)
  const alerts = evaluateAlerts(vendors, s)
  return { from: from.toISOString(), to: to.toISOString(), totalCalls, alerts }
}

// Is the current time within the configured active hours (business timezone hour)?
export function isWithinActiveHours(hourNow: number, from: number, to: number): boolean {
  if (from === 0 && to === 24) return true
  if (from <= to) return hourNow >= from && hourNow < to
  // wrap-around window (e.g. 20 -> 6)
  return hourNow >= from || hourNow < to
}
