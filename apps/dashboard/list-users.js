const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ['error']
});

async function main() {
  const users = await prisma.admin_user.findMany({ select: { email: true, name: true } });
  console.log('Existing users:', users);
}

main()
  .catch(e => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
