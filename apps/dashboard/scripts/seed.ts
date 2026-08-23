import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Default test account
  const defaultHash = await bcrypt.hash('johndoe123', 12)
  await prisma.admin_user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      password_hash: defaultHash,
      name: 'Admin',
      role: 'admin',
    },
  })

  // GrovLabs admin account (Rayan)
  const rayanHash = await bcrypt.hash('Admin123!', 12)
  await prisma.admin_user.upsert({
    where: { email: 'rayan@grovlabs.com' },
    update: {
      password_hash: rayanHash,
      name: 'Rayan',
    },
    create: {
      email: 'rayan@grovlabs.com',
      password_hash: rayanHash,
      name: 'Rayan',
      role: 'admin',
    },
  })
  // GrovLabs team member account (Usman)
  const usmanHash = await bcrypt.hash('GrovLabs26!', 12)
  await prisma.admin_user.upsert({
    where: { email: 'uj@grovlabs.com' },
    update: {
      name: 'Usman',
    },
    create: {
      email: 'uj@grovlabs.com',
      password_hash: usmanHash,
      name: 'Usman',
      role: 'admin',
    },
  })

  console.log('Seed completed')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
