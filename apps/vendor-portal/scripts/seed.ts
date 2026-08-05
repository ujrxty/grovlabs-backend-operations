import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Update Auto Insurance RTB payout_display
  await prisma.campaign.upsert({
    where: { name: 'Auto Insurance RTB' },
    update: { payout_display: '$20-$90' },
    create: {
      name: 'Auto Insurance RTB',
      industry: 'Insurance',
      call_type: 'Live Transfers',
      payout: 25.00,
      payout_display: '$20-$90',
      payout_type: 'per_conversion',
      billing_cycle: 'weekly',
      geographic_focus: 'Nationwide',
      is_active: true,
      sort_order: 0,
    },
  })
  console.log('Updated Auto Insurance RTB payout_display')

  // Upsert Home Insurance Inbounds
  await prisma.campaign.upsert({
    where: { name: 'Home Insurance Inbounds' },
    update: {
      payout_display: '$20-$80',
      min_duration: 120,
      geographic_focus: 'Nationwide',
      requirements: 'Duration: 120-180s. Top Performing States: NE, MN, IN, GA, VA, AL, OH, KY, MO, PA, CO, TX, TN, AZ, MD, NH, UT, OK, WA, IL',
      description: 'Home insurance inbound calls. Top Performing States: NE, MN, IN, GA, VA, AL, OH, KY, MO, PA, CO, TX, TN, AZ, MD, NH, UT, OK, WA, IL. Hours of Operation: 24/7. Caps: None.',
    },
    create: {
      name: 'Home Insurance Inbounds',
      industry: 'Insurance',
      call_type: 'Inbound Calls',
      description: 'Home insurance inbound calls. Top Performing States: NE, MN, IN, GA, VA, AL, OH, KY, MO, PA, CO, TX, TN, AZ, MD, NH, UT, OK, WA, IL. Hours of Operation: 24/7. Caps: None.',
      payout: 20.00,
      payout_display: '$20-$80',
      payout_type: 'per_conversion',
      billing_cycle: 'weekly',
      min_duration: 120,
      geographic_focus: 'Nationwide',
      requirements: 'Duration: 120-180s. Top Performing States: NE, MN, IN, GA, VA, AL, OH, KY, MO, PA, CO, TX, TN, AZ, MD, NH, UT, OK, WA, IL',
      is_active: true,
      sort_order: 1,
    },
  })
  console.log('Upserted Home Insurance Inbounds')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
