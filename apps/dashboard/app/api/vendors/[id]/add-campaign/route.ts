export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/vendors/[id]/add-campaign
// Proxies to the QA onboarding backend which issues a single consolidated Insertion Order
// for the selected campaign(s) reusing the vendor's existing (master) Lead Purchase Agreement,
// then emails the vendor the IO sign link.
// Body: { campaign_ids: string[], special_terms?: string }
// Returns: { io_number, io_sign_url, campaigns: [...] }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const campaign_ids = body?.campaign_ids
    const special_terms = typeof body?.special_terms === 'string' ? body.special_terms.trim() : ''

    if (!Array.isArray(campaign_ids) || campaign_ids.length === 0) {
      return NextResponse.json({ error: 'Select at least one campaign to add.' }, { status: 400 })
    }

    const res = await fetch(
      `https://bsbwqa.abacusai.app/onboarding/admin/vendors/${params.id}/add-campaign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_ids,
          ...(special_terms ? { special_terms } : {}),
        }),
      }
    )

    const data = await res.json().catch(() => ({} as any))
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || data?.message || 'Failed to add campaign to vendor.' },
        { status: res.status }
      )
    }
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Add campaign proxy error:', error)
    return NextResponse.json({ error: 'Failed to add campaign to vendor.' }, { status: 500 })
  }
}
