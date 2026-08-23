export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const QA_AGENT_URL = process.env.QA_AGENT_URL || 'http://localhost:3003'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch(
      `${QA_AGENT_URL}/onboarding/admin/io/${params.id}/resend-email`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      }
    )

    const raw = await res.text()
    let data: any = {}
    try { data = raw ? JSON.parse(raw) : {} } catch { data = {} }

    if (!res.ok) {
      const backendMsg = data?.message || data?.error || (raw && raw.trim()) || 'Unknown error'
      console.error(`Resend IO email error [${res.status}] for io ${params.id}:`, backendMsg)
      return NextResponse.json({ error: backendMsg, backend_status: res.status }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Resend IO email proxy error:', error)
    return NextResponse.json({ error: 'Failed to resend IO email.' }, { status: 500 })
  }
}
