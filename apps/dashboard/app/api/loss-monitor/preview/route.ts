export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loadLossSettings, toLossSettings } from '@/lib/loss-monitor-settings'
import { computeLossAlerts } from '@/lib/loss-monitor'
import { getBusinessDateRange } from '@/lib/business-time'

// Computes today's alerts on demand for the UI (no email sent).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('range') || 'today'
    const { from, to } = getBusinessDateRange(preset)
    const row = await loadLossSettings()
    const settings = toLossSettings(row)
    const result = await computeLossAlerts(from, to, settings)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Loss preview error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to compute alerts' }, { status: 500 })
  }
}
