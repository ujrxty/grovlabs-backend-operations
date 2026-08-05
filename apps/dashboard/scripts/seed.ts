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

  // TBW admin account
  const sammyHash = await bcrypt.hash('Admin123!', 12)
  await prisma.admin_user.upsert({
    where: { email: 'sammyabdel@thebrokenwood.com' },
    update: {
      password_hash: sammyHash,
      name: 'Sammy',
    },
    create: {
      email: 'sammyabdel@thebrokenwood.com',
      password_hash: sammyHash,
      name: 'Sammy',
      role: 'admin',
    },
  })
  // BSBW team member account (Usman)
  const usmanHash = await bcrypt.hash('BSBW26!', 12)
  await prisma.admin_user.upsert({
    where: { email: 'uj@thebrokenwood.com' },
    update: {
      name: 'Usman',
    },
    create: {
      email: 'uj@thebrokenwood.com',
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
