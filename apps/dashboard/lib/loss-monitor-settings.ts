import { prisma } from '@/lib/db'
import { DEFAULT_LOSS_SETTINGS, type LossSettings } from '@/lib/loss-monitor'

const SINGLETON_ID = 'singleton'

// Load settings, creating the singleton row with defaults if it does not exist.
export async function loadLossSettings() {
  // Atomic upsert avoids a race when concurrent requests both try to seed the
  // singleton row (unique constraint on id would otherwise throw P2002).
  return prisma.loss_monitor_settings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  })
}

export function toLossSettings(row: any): LossSettings {
  return {
    alerts_enabled: row.alerts_enabled,
    recipients: row.recipients || DEFAULT_LOSS_SETTINGS.recipients,
    active_from_hour: row.active_from_hour,
    active_to_hour: row.active_to_hour,
    low_conv_enabled: row.low_conv_enabled,
    low_conv_pct: row.low_conv_pct,
    low_conv_min_calls: row.low_conv_min_calls,
    no_answer_enabled: row.no_answer_enabled,
    no_answer_threshold: row.no_answer_threshold,
    low_rpc_enabled: row.low_rpc_enabled,
    low_rpc_threshold: row.low_rpc_threshold,
    low_rpc_min_calls: row.low_rpc_min_calls,
    near_cap_enabled: row.near_cap_enabled,
    near_cap_pct: row.near_cap_pct,
    no_connect_enabled: row.no_connect_enabled,
    no_connect_min_calls: row.no_connect_min_calls,
    zero_conv_enabled: row.zero_conv_enabled,
    zero_conv_min_calls: row.zero_conv_min_calls,
    short_dur_enabled: row.short_dur_enabled,
    short_dur_seconds: row.short_dur_seconds,
    short_dur_min_calls: row.short_dur_min_calls,
  }
}
