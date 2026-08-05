export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { loadLossSettings } from '@/lib/loss-monitor-settings'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const row = await loadLossSettings()
  return NextResponse.json(row)
}

const NUM_FIELDS = [
  'active_from_hour', 'active_to_hour', 'low_conv_pct', 'low_conv_min_calls',
  'no_answer_threshold', 'low_rpc_threshold', 'low_rpc_min_calls', 'near_cap_pct',
  'no_connect_min_calls', 'zero_conv_min_calls', 'short_dur_seconds', 'short_dur_min_calls',
]
const BOOL_FIELDS = [
  'alerts_enabled', 'low_conv_enabled', 'no_answer_enabled', 'low_rpc_enabled',
  'near_cap_enabled', 'no_connect_enabled', 'zero_conv_enabled', 'short_dur_enabled',
]

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await loadLossSettings() // ensure row exists
    const body = await req.json()
    const data: any = {}

    for (const f of BOOL_FIELDS) if (typeof body[f] === 'boolean') data[f] = body[f]
    for (const f of NUM_FIELDS) {
      if (body[f] !== undefined && body[f] !== null && body[f] !== '') {
        const n = Number(body[f])
        if (!Number.isNaN(n)) data[f] = n
      }
    }
    if (typeof body.recipients === 'string') data.recipients = body.recipients.trim()

    const row = await prisma.loss_monitor_settings.update({ where: { id: 'singleton' }, data })
    return NextResponse.json({ success: true, settings: row })
  } catch (err: any) {
    console.error('Loss settings save error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
