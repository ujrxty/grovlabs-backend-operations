// Centralized email configuration for The Broken Wood Inc
// Update these values to customize email branding

export const EMAIL_CONFIG = {
  // Company Info
  companyName: 'The Broken Wood Inc',
  companyShortName: 'The Broken Wood',
  companyTagline: 'Performance Marketing',

  // Contact Info
  contactEmail: 'sammyabdel@thebrokenwood.com',
  contactName: 'Sammy Abdel',
  contactPhone: '+1 (862) 366-7366',

  // Brand Colors (copper/wood theme)
  primaryColor: '#8b5a2b',
  accentColor: '#f5e6d3',

  // Get sender domain from APP_ORIGIN env var
  getSenderDomain(): string {
    try {
      return new URL(process.env.APP_ORIGIN || 'https://vendor.thebrokenwood.com').hostname;
    } catch {
      return 'thebrokenwood.com';
    }
  },
};
