export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const QA_AGENT_URL = process.env.QA_AGENT_URL || 'http://localhost:3003'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const res = await fetch(`${QA_AGENT_URL}/api/openai-usage/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Failed to set budget:', error)
    return NextResponse.json({ error: 'Failed to set budget' }, { status: 500 })
  }
}
