export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/insertion-orders/[id]/void
// Proxies to the QA backend to void/cancel a pending IO.
// Also voids any pending LPAs attached to it and invalidates sign tokens.
// Body (optional): { reason?: string }
// Returns: { message, io_id, io_number, previous_status, voided_agreements }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

    const res = await fetch(
      `${process.env.QA_AGENT_URL || 'http://localhost:3003'}/onboarding/admin/insertion-orders/${params.id}/void`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(reason ? { reason } : {}),
      }
    )

    // Read the raw body once, then try to parse as JSON (backend may return plain text).
    const raw = await res.text()
    let data: any = {}
    try { data = raw ? JSON.parse(raw) : {} } catch { data = {} }

    if (!res.ok) {
      const backendMsg = data?.message || data?.error || (raw && raw.trim()) || 'Unknown error'
      console.error(`Void IO backend error [${res.status}] for io ${params.id}:`, backendMsg)
      const friendly =
        res.status === 404
          ? 'The cancel service could not find this insertion order (the backend returned 404). It may already be voided, or the backend endpoint is unavailable.'
          : `${backendMsg}`
      return NextResponse.json({ error: friendly, backend_status: res.status }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Void IO proxy error:', error)
    return NextResponse.json({ error: 'Failed to void insertion order.' }, { status: 500 })
  }
}
