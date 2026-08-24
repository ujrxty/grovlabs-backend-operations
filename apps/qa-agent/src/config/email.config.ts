// Centralized email configuration for GrovLabs
// Update these values to customize email branding

export const EMAIL_CONFIG = {
  // Company Info
  companyName: 'GrovLabs Inc',
  companyShortName: 'GrovLabs',
  companyTagline: 'Performance Marketing',

  // Contact Info
  contactEmail: 'uj@grovlabs.com',
  contactName: 'GrovLabs Team',
  contactPhone: '',

  // Brand Colors (GrovLabs theme - dark with lime accent)
  primaryColor: '#050505',
  accentColor: '#c4ff00',

  // Get sender domain from APP_ORIGIN env var
  getSenderDomain(): string {
    try {
      return new URL(process.env.APP_ORIGIN || 'https://grovlabs.com').hostname;
    } catch {
      return 'grovlabs.com';
    }
  },
};
