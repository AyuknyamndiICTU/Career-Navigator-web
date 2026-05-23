import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@careernavigator.com';
  const password = 'AdminPassword123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN', isActive: true, passwordHash },
    });
    console.log(`Admin user updated: ${email} / ${password}`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      profile: {
        create: {
          firstName: 'System',
          lastName: 'Admin',
          headline: 'Administrator',
        }
      }
    },
  });

  console.log(`Admin user created: ${email} / ${password}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
