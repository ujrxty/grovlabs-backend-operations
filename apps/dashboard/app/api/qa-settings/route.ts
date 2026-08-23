export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const QA_AGENT_URL = process.env.QA_AGENT_URL || 'http://localhost:3003'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch(`${QA_AGENT_URL}/api/qa-settings`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Failed to fetch QA settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const res = await fetch(`${QA_AGENT_URL}/api/qa-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Failed to save QA settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
