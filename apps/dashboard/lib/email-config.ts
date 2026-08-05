import { prisma } from '@/lib/db'

// Default email configuration
export const DEFAULT_EMAIL_CONFIG = {
  companyName: 'The Broken Wood Inc',
  companyTagline: 'Performance Marketing',
  contactEmail: 'sammyabdel@thebrokenwood.com',
  contactName: 'Sammy Abdel',
  contactPhone: '+1 (862) 366-7366',
  primaryColor: '#8b5a2b',
  secondaryColor: '#a0714f',
  gradientStart: '#8b5a2b',
  gradientEnd: '#6b4423',
  accentColor: '#f5e6d3',
}

// For synchronous access (uses defaults)
export const EMAIL_CONFIG = {
  ...DEFAULT_EMAIL_CONFIG,
  getSenderDomain: (appUrl?: string) => {
    if (appUrl) {
      try {
        return new URL(appUrl).hostname
      } catch {}
    }
    return 'mail.abacusai.app'
  },
}

// Fetch dynamic settings from database
export async function getEmailConfig() {
  try {
    const row = await prisma.$queryRaw<{ settings_json: string }[]>`
      SELECT settings_json FROM system_settings WHERE key = 'system_settings' LIMIT 1
    `.catch(() => null)

    if (row && row[0]?.settings_json) {
      const settings = JSON.parse(row[0].settings_json)
      const brandColor = settings.brandColor || DEFAULT_EMAIL_CONFIG.primaryColor

      return {
        companyName: settings.companyName || DEFAULT_EMAIL_CONFIG.companyName,
        companyTagline: 'Performance Marketing',
        contactEmail: settings.contactEmail || DEFAULT_EMAIL_CONFIG.contactEmail,
        contactName: settings.signatoryName || DEFAULT_EMAIL_CONFIG.contactName,
        contactPhone: settings.contactPhone || DEFAULT_EMAIL_CONFIG.contactPhone,
        primaryColor: brandColor,
        secondaryColor: adjustColor(brandColor, 20),
        gradientStart: brandColor,
        gradientEnd: adjustColor(brandColor, -20),
        accentColor: '#f5e6d3',
        getSenderDomain: (appUrl?: string) => {
          if (appUrl) {
            try {
              return new URL(appUrl).hostname
            } catch {}
          }
          return 'mail.abacusai.app'
        },
      }
    }
  } catch (error) {
    console.log('Could not load email settings from DB, using defaults')
  }

  return { ...EMAIL_CONFIG }
}

// Helper to adjust color brightness
function adjustColor(hex: string, percent: number): string {
  try {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = Math.min(255, Math.max(0, (num >> 16) + percent))
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent))
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent))
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  } catch {
    return hex
  }
}
