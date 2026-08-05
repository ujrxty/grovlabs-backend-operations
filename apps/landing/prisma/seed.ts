import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed test campaigns
  const campaigns = [
    {
      name: 'Medicare Advantage',
      industry: 'Insurance',
      call_type: 'Inbound',
      description: 'Medicare Advantage plans for seniors 65+',
      payout: 45.00,
      payout_display: '$45/qualified call',
      payout_type: 'per_call',
      billing_cycle: 'weekly',
      min_duration: 90,
      geographic_focus: 'United States',
      allowed_traffic: 'Paid search, social media, email marketing',
      restricted_traffic: 'No robocalls, no cold calling',
      requirements: 'Caller must be 65+ or turning 65 within 3 months',
      compliance_notes: 'TCPA compliant, CMS guidelines required',
      is_active: true,
      sort_order: 1,
    },
    {
      name: 'Auto Insurance',
      industry: 'Insurance',
      call_type: 'Inbound',
      description: 'Auto insurance quotes for drivers',
      payout: 25.00,
      payout_display: '$25/qualified call',
      payout_type: 'per_call',
      billing_cycle: 'weekly',
      min_duration: 60,
      geographic_focus: 'United States',
      allowed_traffic: 'Paid search, display ads, native ads',
      restricted_traffic: 'No incentivized traffic',
      requirements: 'Valid driver license, vehicle owner',
      compliance_notes: 'TCPA compliant',
      is_active: true,
      sort_order: 2,
    },
    {
      name: 'Home Services - HVAC',
      industry: 'Home Services',
      call_type: 'Inbound',
      description: 'HVAC repair and installation leads',
      payout: 35.00,
      payout_display: '$35/qualified call',
      payout_type: 'per_call',
      billing_cycle: 'weekly',
      min_duration: 45,
      geographic_focus: 'United States',
      allowed_traffic: 'Search, social, local ads',
      restricted_traffic: 'No robocalls',
      requirements: 'Homeowner or authorized renter',
      compliance_notes: 'TCPA compliant',
      is_active: true,
      sort_order: 3,
    },
    {
      name: 'Debt Relief',
      industry: 'Financial',
      call_type: 'Inbound',
      description: 'Debt consolidation and relief services',
      payout: 55.00,
      payout_display: '$55/qualified call',
      payout_type: 'per_call',
      billing_cycle: 'weekly',
      min_duration: 120,
      geographic_focus: 'United States',
      allowed_traffic: 'Search, email, social',
      restricted_traffic: 'No cold calling, no misleading claims',
      requirements: 'Minimum $10,000 unsecured debt',
      compliance_notes: 'FTC compliance required, TCPA compliant',
      is_active: true,
      sort_order: 4,
    },
  ]

  for (const campaign of campaigns) {
    await prisma.campaign.upsert({
      where: { name: campaign.name },
      update: campaign,
      create: campaign,
    })
  }

  console.log('Seeded', campaigns.length, 'campaigns')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
