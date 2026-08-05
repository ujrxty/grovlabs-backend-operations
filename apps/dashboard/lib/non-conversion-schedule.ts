// Helpers for surfacing the QA bot's run cadence on the Non-Conversion tab.
// The external QA bot writes non-conversion rows hourly, on the hour,
// from 8am through 6pm Pacific time, every day.

import { zonedToUtc } from '@/lib/business-time'

export const QA_TZ = 'America/Los_Angeles'
export const QA_TZ_LABEL = 'PST'
export const QA_START_HOUR = 8 // first run of the day (8am)
export const QA_END_HOUR = 18 // last run of the day (6pm)

// Wall-clock parts in Pacific time.
function pacificParts(now: Date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: QA_TZ, hour12: false,
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

// Compute the next scheduled QA-bot run as an absolute UTC instant.
export function nextQaRun(now: Date = new Date()): Date {
  const { year, month, day, hour } = pacificParts(now)

  if (hour < QA_START_HOUR) {
    // Before the first run today -> today at start hour.
    return zonedToUtc(year, month, day, QA_START_HOUR, 0, 0, 0, QA_TZ)
  }
  if (hour >= QA_END_HOUR) {
    // Today's last run has already fired -> tomorrow at start hour.
    return zonedToUtc(year, month, day + 1, QA_START_HOUR, 0, 0, 0, QA_TZ)
  }
  // Mid-window -> the next top of the hour (capped at the end hour).
  const nextHour = Math.min(hour + 1, QA_END_HOUR)
  return zonedToUtc(year, month, day, nextHour, 0, 0, 0, QA_TZ)
}

// Is the QA bot currently within its active writing window?
export function isQaActiveNow(now: Date = new Date()): boolean {
  const { hour } = pacificParts(now)
  return hour >= QA_START_HOUR && hour <= QA_END_HOUR
}
