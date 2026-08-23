import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const SETTINGS_KEY = 'system_settings'

// Default settings
const DEFAULT_SETTINGS = {
  timezone: 'America/New_York',
  companyName: 'GrovLabs Inc',
  companyAddress: '8301 State Line Rd Ste 220, Kansas City, MO 64114',
  signatoryName: 'UJ',
  signatoryTitle: 'Chief Executive Officer',
  contactEmail: 'uj@grovlabs.com',
  contactPhone: '+1 (754) 344-0773',
  brandColor: '#8b5a2b',
  // SMTP Settings
  smtpEnabled: false,
  smtpProvider: 'gmail',
  smtpHost: 'smtp.gmail.com',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  smtpFromEmail: '',
  smtpFromName: 'GrovLabs Inc',
  smtpSecure: true,
  // AI Settings
  openaiApiKey: '',
  // TrackDrive Settings
  trackdriveSubdomain: 'grovlabs',
  trackdrivePublicKey: '',
  trackdrivePrivateKey: '',
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Try to get settings from loss_monitor_settings table (reusing existing table)
    // or create a simple key-value store approach
    const row = await prisma.$queryRaw<{ settings_json: string }[]>`
      SELECT settings_json FROM system_settings WHERE key = ${SETTINGS_KEY} LIMIT 1
    `.catch(() => null)

    if (row && row[0]?.settings_json) {
      const settings = JSON.parse(row[0].settings_json)
      return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...settings } })
    }

    return NextResponse.json({ settings: DEFAULT_SETTINGS })
  } catch (error: any) {
    // Table might not exist yet, return defaults
    console.log('Settings table not found, using defaults')
    return NextResponse.json({ settings: DEFAULT_SETTINGS })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const settings = await request.json()
    const settingsJson = JSON.stringify(settings)

    // Create table if not exists and upsert
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(255) PRIMARY KEY,
        settings_json TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    await prisma.$executeRaw`
      INSERT INTO system_settings (key, settings_json, updated_at)
      VALUES (${SETTINGS_KEY}, ${settingsJson}, NOW())
      ON CONFLICT (key) DO UPDATE SET settings_json = ${settingsJson}, updated_at = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to save settings:', error?.message)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
