import { prisma } from '@/lib/db'

// The non_conversion_review table often has empty caller_number / number_called /
// caller_city / caller_state because the upstream bot did not capture them.
// The main `call` table (populated by the primary QA system) does have this
// data keyed by trackdrive_call_id — so we backfill the missing values here.

function pick(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) {
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v)
  }
  return null
}

export async function enrichReviews<T extends { trackdrive_call_id: string; caller_number?: string | null; number_called?: string | null; caller_city?: string | null; caller_state?: string | null }>(
  reviews: T[],
): Promise<T[]> {
  if (!reviews || reviews.length === 0) return reviews

  const ids = Array.from(new Set(reviews.map((r) => r.trackdrive_call_id).filter(Boolean)))
  if (ids.length === 0) return reviews

  const calls = await prisma.call.findMany({
    where: { trackdrive_call_id: { in: ids } },
    select: { trackdrive_call_id: true, caller_number: true, trackdrive_data: true },
  })

  const map = new Map<string, { caller_number: string | null; number_called: string | null; caller_city: string | null; caller_state: string | null }>()
  for (const c of calls) {
    const td: any = c.trackdrive_data ?? {}
    map.set(c.trackdrive_call_id, {
      caller_number: pick(c.caller_number, td.caller_number, td.caller_id, td['token-caller_id']),
      number_called: pick(td.number_called, td.trackdrive_number, td['token-trackdrive_number']),
      caller_city: pick(td.caller_city),
      caller_state: pick(td.state, td.geo_state, td['token-state']),
    })
  }

  return reviews.map((r) => {
    const extra = map.get(r.trackdrive_call_id)
    if (!extra) return r
    return {
      ...r,
      caller_number: pick(r.caller_number, extra.caller_number),
      number_called: pick(r.number_called, extra.number_called),
      caller_city: pick(r.caller_city, extra.caller_city),
      caller_state: pick(r.caller_state, extra.caller_state),
    }
  })
}
