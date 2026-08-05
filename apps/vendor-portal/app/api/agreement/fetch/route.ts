export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = 'https://bsbwqa.abacusai.app'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')?.trim?.()

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 })
    }

    // Fetch agreement data from backend
    const res = await fetch(`${BACKEND_URL}/onboarding/agreement/${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      let errorMsg = 'Failed to fetch agreement'
      try {
        const errData = await res.json()
        errorMsg = errData?.error ?? errData?.message ?? errorMsg
      } catch {}
      console.error('Backend agreement fetch error:', res.status, errorMsg)
      return NextResponse.json({ success: false, error: errorMsg }, { status: res.status || 500 })
    }

    const data = await res.json()
    console.log('Backend agreement fetch response:', res.status, JSON.stringify(data).slice(0, 500))

    // Backend returns data directly (status, vendor, io_number, campaign, agreement_text, etc.)
    // Normalize into our expected format
    return NextResponse.json({
      success: true,
      agreement: {
        status: data?.status ?? '',
        vendor_name: data?.vendor ?? '',
        io_number: data?.io_number ?? '',
        campaign: data?.campaign ?? '',
        agreement_text: data?.agreement_text ?? '',
        vendor_signed_at: data?.vendor_signed_at ?? null,
        vendor_sign_name: data?.vendor_sign_name ?? null,
        counter_signed_at: data?.counter_signed_at ?? null,
      },
    })
  } catch (error: any) {
    console.error('Fetch agreement error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to fetch agreement data' }, { status: 500 })
  }
}
