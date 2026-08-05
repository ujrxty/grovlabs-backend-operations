// Business timezone helpers.
//
// The dashboard's day-based presets (Today, Yesterday, This Week, etc.) must be
// anchored to a fixed business timezone so the reported "day" matches what the team
// expects — NOT the server's UTC clock. Previously boundaries were computed in
// UTC, so late-afternoon Pacific time (already past midnight UTC) made "Today"
// show almost no data.
//
// We anchor to US Eastern Time (America/New_York, EST/EDT). This is DST-aware.
// The resulting boundaries are absolute UTC instants, so downstream TrackDrive
// queries (which format instants as UTC strings) remain correct.

export const BUSINESS_TZ = 'America/New_York'
export const BUSINESS_TZ_LABEL = 'ET'

// Offset (ms) of the given timezone from UTC at the given instant.
// Positive means the zone is behind UTC (e.g. Eastern is negative).
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  const hour = map.hour === '24' ? 0 : Number(map.hour)
  const asUTC = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    hour, Number(map.minute), Number(map.second),
  )
  return asUTC - date.getTime()
}

// Convert a wall-clock time in the business timezone to an absolute UTC Date.
export function zonedToUtc(
  y: number, m: number, d: number,
  h = 0, mi = 0, s = 0, ms = 0,
  timeZone: string = BUSINESS_TZ,
): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi, s, ms)
  // One correction pass is sufficient except within the ~1h DST overlap window.
  const offset = tzOffsetMs(new Date(guess), timeZone)
  let result = new Date(guess - offset)
  const offset2 = tzOffsetMs(result, timeZone)
  if (offset2 !== offset) {
    result = new Date(guess - offset2)
  }
  return result
}

// Current wall-clock calendar parts in the business timezone.
export function nowParts(now: Date = new Date(), timeZone: string = BUSINESS_TZ): {
  year: number; month: number; day: number; dow: number
} {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = dtf.formatToParts(now)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    dow: dowMap[map.weekday] ?? 0,
  }
}

// Start of a day (00:00:00.000) in the business timezone, offset by deltaDays.
export function startOfBusinessDay(deltaDays = 0, now: Date = new Date()): Date {
  const { year, month, day } = nowParts(now)
  return zonedToUtc(year, month, day + deltaDays, 0, 0, 0, 0)
}

// End of a day (23:59:59.999) in the business timezone, offset by deltaDays.
export function endOfBusinessDay(deltaDays = 0, now: Date = new Date()): Date {
  const { year, month, day } = nowParts(now)
  return zonedToUtc(year, month, day + deltaDays, 23, 59, 59, 999)
}

// Shared date-range resolver for day/time presets, anchored to the business
// timezone. Returns absolute UTC instants suitable for TrackDrive queries.
// Presets: last_30m, last_6h, last_12h, today, yesterday, this_week, last_week,
// this_month, last_month, this_quarter, last_6_months, this_year, last_year, custom.
export function getBusinessDateRange(
  preset: string,
  customFrom?: string,
  customTo?: string,
): { from: Date; to: Date } {
  const now = new Date()
  const { year, month, day, dow } = nowParts(now)
  const m0 = month - 1

  const startDay = (y: number, mo0: number, d: number) => zonedToUtc(y, mo0 + 1, d, 0, 0, 0, 0)
  const endDay = (y: number, mo0: number, d: number) => zonedToUtc(y, mo0 + 1, d, 23, 59, 59, 999)

  switch (preset) {
    case 'last_30m':
      return { from: new Date(now.getTime() - 30 * 60 * 1000), to: now }
    case 'last_6h':
      return { from: new Date(now.getTime() - 6 * 60 * 60 * 1000), to: now }
    case 'last_12h':
      return { from: new Date(now.getTime() - 12 * 60 * 60 * 1000), to: now }
    case 'today':
      return { from: startDay(year, m0, day), to: now }
    case 'yesterday':
      return { from: startDay(year, m0, day - 1), to: endDay(year, m0, day - 1) }
    case 'this_week':
      return { from: startDay(year, m0, day - dow), to: now }
    case 'last_week':
      return { from: startDay(year, m0, day - dow - 7), to: endDay(year, m0, day - dow - 1) }
    case 'this_month':
      return { from: startDay(year, m0, 1), to: now }
    case 'last_month':
      return { from: startDay(year, m0 - 1, 1), to: endDay(year, m0, 0) }
    case 'this_quarter': {
      const q = Math.floor(m0 / 3)
      return { from: startDay(year, q * 3, 1), to: now }
    }
    case 'last_6_months':
      return { from: startDay(year, m0 - 6, day), to: now }
    case 'this_year':
      return { from: startDay(year, 0, 1), to: now }
    case 'last_year':
      return { from: startDay(year - 1, 0, 1), to: endDay(year - 1, 11, 31) }
    case 'custom': {
      if (customFrom && customTo) {
        const [fy, fm, fd] = customFrom.split('-').map(Number)
        const [ty, tm, td] = customTo.split('-').map(Number)
        return { from: zonedToUtc(fy, fm, fd, 0, 0, 0, 0), to: zonedToUtc(ty, tm, td, 23, 59, 59, 999) }
      }
      return { from: startDay(year, m0, day), to: now }
    }
    default:
      return { from: startDay(year, m0, day), to: now }
  }
}

// Current hour (0-23) in the business timezone.
export function businessHourNow(now: Date = new Date(), timeZone: string = BUSINESS_TZ): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, hour: '2-digit' }).format(now)
  const n = Number(h)
  return n === 24 ? 0 : n
}
