// Helpers for surfacing the QA bot's run cadence on the Non-Conversion tab.
// Uses dynamic timezone from scheduler settings.

import { zonedToUtc } from '@/lib/business-time'

// Map IANA timezone to short label
export function tzLabelFromIana(tz: string): string {
  const labels: Record<string, string> = {
    'America/New_York': 'ET',
    'America/Chicago': 'CT',
    'America/Denver': 'MT',
    'America/Los_Angeles': 'PT',
    'America/Phoenix': 'MST',
  }
  return labels[tz] || tz.split('/').pop()?.replace(/_/g, ' ') || 'ET'
}

// Wall-clock parts in given timezone.
function tzParts(tz: string, now: Date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(now)) map[p.type] = p.value
  let hour = Number(map.hour)
  if (hour === 24) hour = 0
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
  }
}

// Compute the next scheduled QA-bot run as an absolute UTC instant (dynamic timezone).
export function nextQaRunDynamic(tz: string, startHour: number, endHour: number, now: Date = new Date()): Date {
  const { year, month, day, hour } = tzParts(tz, now)

  if (hour < startHour) {
    return zonedToUtc(year, month, day, startHour, 0, 0, 0, tz)
  }
  if (hour >= endHour) {
    return zonedToUtc(year, month, day + 1, startHour, 0, 0, 0, tz)
  }
  const nextHour = Math.min(hour + 1, endHour)
  return zonedToUtc(year, month, day, nextHour, 0, 0, 0, tz)
}

// Is the QA bot currently within its active writing window? (dynamic timezone)
export function isQaActiveNowDynamic(tz: string, startHour: number, endHour: number, now: Date = new Date()): boolean {
  const { hour } = tzParts(tz, now)
  return hour >= startHour && hour <= endHour
}

// Legacy exports for backwards compatibility
export const QA_TZ = 'America/New_York'
export const QA_TZ_LABEL = 'ET'
export const QA_START_HOUR = 8
export const QA_END_HOUR = 18

export function nextQaRun(now: Date = new Date()): Date {
  return nextQaRunDynamic(QA_TZ, QA_START_HOUR, QA_END_HOUR, now)
}

export function isQaActiveNow(now: Date = new Date()): boolean {
  return isQaActiveNowDynamic(QA_TZ, QA_START_HOUR, QA_END_HOUR, now)
}
