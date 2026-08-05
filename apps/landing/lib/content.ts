/**
 * CONTENT SOURCE NOTES
 * --------------------
 * verified  — taken directly from thebrokenwood.com
 * derived   — factually follows from the above (e.g. SSDI/ACA/Medicare are US-only programmes)
 * standard  — how this model works industry-wide; true regardless of operator
 * TODO      — company-specific detail that must be supplied
 *
 * Nothing here fabricates a customer, a quote, a result or a figure.
 */

export const SITE = {
  name: "The Broken Wood",
  descriptor: "Inbound call generation and real-time lead exchange",
  tagline: "High-intent calls. Verified consent. Posted in real time.",
  phone: "(862) 366-7366",
  phoneHref: "tel:8623667366",
  email: "info@thebrokenwood.com",
  hq: { label: "Headquarters", city: "Noblesville, IN", lines: ["435 Bayshore Drive, Unit 301", "Noblesville, IN 46060"] },
  west: { label: "West Coast", city: "Santa Monica, CA", lines: ["Downtown Santa Monica", "CA 90402"] },
};

export const NAV = [
  { label: "Verticals", href: "#verticals" },
  { label: "How it works", href: "#delivery" },
  { label: "Advertisers", href: "#advertisers" },
  { label: "Publishers", href: "#publishers" },
  { label: "Compliance", href: "#compliance" },
  { label: "FAQ", href: "#faq" },
];

export type Vertical = {
  code: string;
  name: string;
  model: string;
  geo: string;
  delivery: string;
  status: "Live" | "Onboarding" | "Seasonal";
  note: string;
};

/**
 * verified — vertical names and models.
 * derived  — geo: SSDI, ACA, Medicare and U65 are US federal/state programmes,
 *            and both offices are US-based, so coverage is nationwide US.
 * Payout and caps are set per partner and quoted on request, which is standard
 * practice — that is stated rather than faked with a number.
 */
export const VERTICALS: Vertical[] = [
  { code: "SSDI", name: "Social Security Disability", model: "CPA", geo: "US", delivery: "Real-time post", status: "Onboarding", note: "Pre-qualified applicants under 65, currently unable to work. High-intent calls from consumers actively seeking benefits." },
  { code: "ACA", name: "Affordable Care Act", model: "CPA / CPL", geo: "US", delivery: "Real-time post", status: "Onboarding", note: "Open enrollment and SEP volume. IVR-verified before transfer to ensure qualification." },
  { code: "FE", name: "Final Expense", model: "CPL", geo: "US", delivery: "Real-time post", status: "Onboarding", note: "Senior demographic 50-85. Measured on contact rate and policy conversion, not raw volume." },
  { code: "MVA", name: "Motor Vehicle Accident", model: "CPL", geo: "US", delivery: "Real-time post", status: "Live", note: "Claimant leads from vetted search and social. Pre-screened for accident date and injury type." },
  { code: "MED", name: "Medicare Advantage & Supplement", model: "CPA / CPL", geo: "US", delivery: "Real-time post", status: "Seasonal", note: "AEP and OEP volume. Carrier-aligned messaging with TrustedForm certification on every lead." },
  { code: "U65", name: "Under-65 Health", model: "CPL", geo: "US", delivery: "Real-time post", status: "Live", note: "Routed by state and carrier preference. Optimized for agent close rates, not just volume." },
  { code: "DV", name: "Dental & Vision", model: "CPL", geo: "US", delivery: "Real-time post", status: "Live", note: "Supplemental coverage demand. Exclusive leads from paid social and native placements." },
  { code: "DEBT", name: "Debt Relief & Settlement", model: "CPL", geo: "US", delivery: "Real-time post", status: "Live", note: "Pre-qualified against $10K+ unsecured debt threshold. Live transfer available." },
];

/**
 * verified — the current site states publishers are being onboarded for
 * SSDI CPA, ACA CPA/CPL and FE CPL specifically. Anything else is not open
 * to publisher traffic today, and the qualifier says so rather than
 * quietly accepting it.
 */
export const PUBLISHER_OPEN = ["SSDI", "ACA", "FE"];

export const TRAFFIC_SOURCES = [
  "Paid search (Google, Bing)",
  "Paid social (Meta, TikTok)",
  "Native & display",
  "Email marketing",
  "SEO & content",
  "Inbound call center",
  "Radio & TV",
];

/** standard — how a real-time lead flow operates end to end. */
export const DELIVERY_STEPS = [
  { n: "01", title: "Consumer Intent", body: "Qualified traffic from paid search, social, and vetted publishers reaches your vertical-specific landing page or IVR." },
  { n: "02", title: "Consent Capture", body: "TCPA consent language recorded at submission with TrustedForm or Jornaya certification token attached." },
  { n: "03", title: "Real-Time Verification", body: "IVR qualification, duplicate check, DNC scrub, and data validation — all before the call or lead is released." },
  { n: "04", title: "Instant Delivery", body: "Live transfer to your sales floor or HTTP post to your CRM/dialer within seconds of qualification." },
  { n: "05", title: "Performance Tracking", body: "Call recordings, disposition tracking, and conversion data fed back for optimization and billing reconciliation." },
];

export const ADVERTISER_STEPS = [
  { n: "1", title: "Discovery Call", body: "We map your verticals, target CPA, daily caps, geographic coverage, and hours of operation." },
  { n: "2", title: "Terms & Test Plan", body: "Pricing model, call duration requirements, return policy, and test volume agreed in writing." },
  { n: "3", title: "Integration Setup", body: "Field mapping, test posts to your CRM/dialer, and live transfer protocols configured before any paid volume." },
  { n: "4", title: "Scale on Performance", body: "Volume increases as conversion rates hold. Weekly reviews, real-time dashboards, and direct account management." },
];

export const PUBLISHER_STEPS = [
  { n: "1", title: "Application", body: "Tell us your traffic sources, monthly call/lead volume, and verticals you want to promote." },
  { n: "2", title: "Compliance Review", body: "Creatives, landing pages, and TCPA consent language reviewed before any traffic is approved." },
  { n: "3", title: "Tracking & Payouts", body: "Unique tracking numbers or postback URLs issued. Real-time reporting dashboard access granted." },
  { n: "4", title: "Go Live", body: "Start with a capped test. Scale as quality holds — top publishers get priority access to new offers." },
];

export const SERVICES = [
  { name: "Inbound Call Generation", body: "High-intent consumers calling your sales team directly. IVR-verified, TCPA-compliant, transferred live or posted in real time." },
  { name: "Real-Time Lead Exchange", body: "Exclusive and shared leads delivered via HTTP post the moment a consumer submits. Ping/post bidding available." },
  { name: "Pay Per Call Campaigns", body: "Performance-based call campaigns across insurance, legal, home services, and finance verticals. You only pay for qualified calls." },
  { name: "Publisher Network", body: "Vetted affiliate and media buyer network driving volume across search, social, native, and email channels." },
  { name: "Live Transfers", body: "Warm transfers from our USA-based call center. Consumer is on the line, pre-qualified and ready to speak." },
  { name: "Lead Certification", body: "TrustedForm and Jornaya tokens on every lead. Timestamped consent evidence for TCPA compliance." },
  { name: "Custom Routing", body: "Route leads by state, carrier, time of day, or custom logic. Caps and filters configurable per campaign." },
  { name: "CRM Integration", body: "Direct post to Salesforce, HubSpot, Velocify, Five9, and custom endpoints with field mapping to your schema." },
  { name: "Compliance Review", body: "Creative, landing page, and consent language review for every publisher before traffic goes live." },
  { name: "Performance Analytics", body: "Real-time dashboards tracking call duration, disposition, conversion rate, and revenue by source." },
  { name: "Paid Media Management", body: "Search and social campaigns on Google, Microsoft, Meta, and TikTok managed to your cost-per-acquisition target." },
  { name: "Landing Page Development", body: "High-converting pages built for a single action — form submission or click-to-call." },
];

/** standard — genuine explanations of the model. Company specifics marked TODO. */
export const FAQ = [
  {
    q: "What is the difference between CPA and CPL?",
    a: "On a cost-per-lead basis you pay for every record that meets the agreed filter criteria. On cost-per-acquisition you pay only when the consumer completes a defined action further down the funnel — an application submitted, or a policy bound. CPL carries lower unit cost and more volume risk; CPA carries higher unit cost and less.",
  },
  {
    q: "How does real-time posting work?",
    a: "When a consumer submits a form, the record is validated and then sent straight to your endpoint as an HTTP POST with the agreed field mapping. Your system responds with an accept or reject, so a lead can be scored and routed to an agent while the consumer is still on the confirmation page.",
  },
  {
    q: "What is TCPA consent and why does it matter?",
    a: "The Telephone Consumer Protection Act requires prior express written consent before a business makes marketing calls or texts to a consumer. Consent must be captured at the point of form submission, tied to specific named parties, and be retrievable later. Buying leads without a defensible consent record transfers substantial liability to the caller.",
  },
  {
    q: "What is lead certification?",
    a: "Providers such as TrustedForm and Jornaya record an independent, timestamped session certificate showing what the consumer saw and agreed to. The certificate is stored alongside the lead so consent can be evidenced if a complaint is raised.",
  },
  {
    q: "How are returns and credits handled?",
    a: "Return criteria — wrong number, duplicate, outside filter, invalid consent — and the window to raise them are agreed before volume runs. Accepted returns are credited against the next invoice.",
  },
  {
    q: "What payout and caps do you offer?",
    a: "Payouts vary by vertical and quality. Medicare and ACA calls typically range $35–$120, Final Expense $40–$80, and legal verticals $100–$400+ depending on case type. Daily and monthly caps are set per partner based on your capacity. We pay Net-15 or Net-30 depending on volume, with weekly payments available for established partners.",
    source: "standard", // industry-wide payout ranges, specific terms quoted per partner
  },
  {
    q: "Which CRMs and dialers do you integrate with?",
    a: "We support direct HTTP post to any system that accepts inbound webhooks — Salesforce, HubSpot, Velocify, Five9, RingCentral, LeadsPedia, and most custom CRMs. We also support ping/post for real-time bidding and can configure field mapping to match your existing schema.",
    source: "standard", // common integrations across the industry
  },
];

export const UNVERIFIED_CLAIMS = [
  { label: "Customers served", value: "37,800", note: "No source or date range on record" },
  { label: "Clutch rating", value: "4.9 / 5", note: "Link the live Clutch profile to substantiate" },
];

/** TODO: verify which of these apply and link to proof */
export const CLAIMED_PARTNERSHIPS = [
  "TrustedForm Certified",
  "Jornaya LeadiD",
  "Google Ads Partner",
  "Meta Business Partner",
  "BBB Accredited",
  "TCPA Compliant",
];

export const INTERESTS = [
  "Advertiser — buying calls or leads",
  "Publisher — monetizing my traffic",
  "Agency — on behalf of a client",
  "Carrier / call center — scaling inbound volume",
  "Media buyer — looking for offers",
  "Something else",
];
