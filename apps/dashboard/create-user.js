const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Admin123!', 12);
  const user = await prisma.admin_user.upsert({
    where: { email: 'sammyabdel@thebrokenwood.com' },
    update: { password_hash: hash, name: 'Sammy' },
    create: { email: 'sammyabdel@thebrokenwood.com', password_hash: hash, name: 'Sammy', role: 'admin' }
  });
  console.log('Created/updated user:', user.email);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
