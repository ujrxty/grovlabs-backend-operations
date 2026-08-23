// Centralized email configuration for GrovLabs Inc
// Update these values to customize email branding

export const EMAIL_CONFIG = {
  // Company Info
  companyName: 'GrovLabs Inc',
  companyShortName: 'GrovLabs',
  companyTagline: 'Performance Marketing',

  // Contact Info
  contactEmail: 'uj@grovlabs.com',
  contactName: 'UJ',
  contactPhone: '+1 (754) 344-0773',

  // Brand Colors
  primaryColor: '#8b5a2b',
  accentColor: '#f5e6d3',

  // Get sender domain from APP_ORIGIN env var
  getSenderDomain(): string {
    try {
      return new URL(process.env.APP_ORIGIN || 'https://vendor.grovlabs.com').hostname;
    } catch {
      return 'grovlabs.com';
    }
  },
};
