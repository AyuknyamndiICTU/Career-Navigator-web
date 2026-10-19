import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from './src/generated/prisma/client';

if (existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running the seed.');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error(
      'Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) before running the seed.',
    );
  }
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN', isActive: true, passwordHash },
    });
    console.log(`Admin user updated: ${email}`);
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

  console.log(`Admin user created: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
