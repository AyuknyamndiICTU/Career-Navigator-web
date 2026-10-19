import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './client';
import { env } from '../config/env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = env.databaseUrl;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }

    // pg has no connect timeout by default; Prisma 6 used 5 s.
    const adapter = new PrismaPg({
      connectionString,
      connectionTimeoutMillis: 5_000,
    });

    super({ adapter });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
