// Shared labels & helpers for the Non-Conversion QA feature

export const OUTCOME_REASON_LABELS: Record<string, string> = {
  dead_air_no_agent: 'Dead air / no agent',
  no_carrier_available: 'No carrier available',
  buyer_rejected_out_of_area: 'Buyer rejected (out of area)',
  buyer_rejected_live: 'Buyer rejected live',
  buyer_hung_up: 'Buyer hung up',
  excessive_hold_dropped: 'Excessive hold / dropped',
  ivr_no_live_agent: 'IVR — no live agent',
  caller_hung_up_early: 'Caller hung up early',
  caller_not_interested: 'Caller not interested',
  caller_not_qualified: 'Caller not qualified',
  bad_caller_audio: 'Bad caller audio',
  language_barrier: 'Language barrier',
  duplicate_repeat_caller: 'Duplicate / repeat caller',
  spam_invalid: 'Spam / invalid',
  short_no_billable_duration: 'Short / no billable duration',
  other: 'Other',
}

export function outcomeLabel(reason: string): string {
  return OUTCOME_REASON_LABELS[reason] ?? reason?.replace(/_/g, ' ') ?? '—'
}

export const FAULT_SIDES = ['buyer', 'vendor', 'external', 'neutral'] as const

export const OUTCOME_REASONS = Object.keys(OUTCOME_REASON_LABELS)

// Tailwind classes for fault-side badges
export function faultSideBadgeClass(side: string): string {
  switch (side) {
    case 'buyer':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900'
    case 'vendor':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900'
    case 'external':
      return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function faultSideLabel(side: string): string {
  switch (side) {
    case 'buyer':
      return 'Buyer'
    case 'vendor':
      return 'Vendor'
    case 'external':
      return 'External'
    case 'neutral':
      return 'Neutral'
    default:
      return side ?? '—'
  }
}

// Today's date in PST (America/Los_Angeles) as YYYY-MM-DD to match the bot's review_date
export function todayPST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
