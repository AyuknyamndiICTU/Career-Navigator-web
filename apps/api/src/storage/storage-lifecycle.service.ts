import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  keyKind,
  keyOwner,
  OBJECT_STORAGE,
  type ObjectStorage,
  type StoredObject,
} from './object-storage';

const QUEUE = 'storage-lifecycle';
const SCHEDULE = '30 3 * * *'; // nightly, 03:30 server time
// Objects younger than this are never deleted: an upload may be stored before its database row is written.
const GRACE_MS = 24 * 3_600_000;

export type LifecycleReport = {
  scanned: number;
  deleted: number;
  kept: number;
  skipped: number;
};

type Closeable = { close: () => Promise<void> };

/**
 * Storage retention (18.4): keeps the current CV plus the newest older versions (STORAGE_CV_VERSIONS_KEPT in total),
 * only the current profile picture, and nothing for users that no longer exist.
 */
@Injectable()
export class StorageLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageLifecycleService.name);
  private closeables: Closeable[] = [];

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async onModuleInit(): Promise<void> {
    if (
      !env.storage.lifecycleEnabled ||
      !env.redisUrl ||
      !this.storage.configured
    )
      return;
    const { Queue, Worker } = (await import('bullmq')) as unknown as {
      Queue: new (
        name: string,
        opts: unknown,
      ) => Closeable & {
        upsertJobScheduler: (
          id: string,
          repeat: unknown,
          template: unknown,
        ) => Promise<unknown>;
      };
      Worker: new (
        name: string,
        fn: () => Promise<unknown>,
        opts: unknown,
      ) => Closeable & {
        on: (event: string, cb: (...args: unknown[]) => void) => void;
      };
    };
    const connection = { url: env.redisUrl };
    const queue = new Queue(QUEUE, { connection });
    await queue.upsertJobScheduler(
      'nightly',
      { pattern: SCHEDULE },
      { name: 'clean', opts: { removeOnComplete: 10, removeOnFail: 10 } },
    );
    const worker = new Worker(QUEUE, () => this.run(), {
      connection,
      concurrency: 1,
    });
    worker.on('failed', (_job, err) =>
      this.logger.error(`Storage clean-up failed: ${(err as Error)?.message}`),
    );
    this.closeables = [worker, queue];
    this.logger.log(`Storage clean-up scheduled (${SCHEDULE}).`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      this.closeables.map((c) => c.close().catch(() => undefined)),
    );
  }

  /** Lists the whole bucket and deletes what the retention rules no longer keep. */
  async run(now = new Date()): Promise<LifecycleReport> {
    const all: StoredObject[] = [];
    let token: string | undefined;
    do {
      const page = await this.storage.list('', token);
      all.push(...page.objects);
      token = page.nextToken ?? undefined;
    } while (token);

    const owners = [
      ...new Set(
        all
          .map((o) => keyOwner(o.key))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [users, media, profiles] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: owners } },
        select: { id: true },
      }),
      this.prisma.uploadMedia.findMany({
        where: { userId: { in: owners } },
        select: { objectKey: true },
      }),
      this.prisma.profile.findMany({
        where: { userId: { in: owners } },
        select: { cvWizardData: true },
      }),
    ]);
    const existing = new Set(users.map((u) => u.id));
    const referenced = new Set(media.map((m) => m.objectKey));
    for (const p of profiles) {
      const photo = (p.cvWizardData as { photoUrl?: unknown } | null)?.photoUrl;
      if (typeof photo === 'string') referenced.add(photo);
    }

    const report: LifecycleReport = {
      scanned: all.length,
      deleted: 0,
      kept: 0,
      skipped: 0,
    };
    const groups = new Map<string, StoredObject[]>();
    const toDelete: string[] = [];
    for (const object of all) {
      const owner = keyOwner(object.key);
      const kind = keyKind(object.key);
      if (!owner || !kind) {
        report.skipped += 1;
        continue;
      }
      const young = now.getTime() - object.lastModified.getTime() < GRACE_MS;
      if (!existing.has(owner)) {
        if (young) report.kept += 1;
        else toDelete.push(object.key);
        continue;
      }
      const id = `${owner}:${kind}`;
      groups.set(id, [...(groups.get(id) ?? []), object]);
    }

    for (const [id, objects] of groups) {
      const keep = id.endsWith(':cv') ? env.storage.cvVersionsKept : 1;
      const current = objects.filter((o) => referenced.has(o.key));
      const others = objects
        .filter((o) => !referenced.has(o.key))
        .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
      const room = Math.max(0, keep - current.length);
      others.forEach((o, i) => {
        const young = now.getTime() - o.lastModified.getTime() < GRACE_MS;
        if (i < room || young) report.kept += 1;
        else toDelete.push(o.key);
      });
      report.kept += current.length;
    }

    for (const key of toDelete) {
      await this.storage.delete(key);
      report.deleted += 1;
    }
    this.logger.log(`Storage clean-up: ${JSON.stringify(report)}`);
    return report;
  }

  /** Removes every object of a user (for account deletion). */
  async deleteUserObjects(userId: string): Promise<number> {
    let deleted = 0;
    for (const prefix of [`users/${userId}/`, `${userId}/`]) {
      let token: string | undefined;
      do {
        const page = await this.storage.list(prefix, token);
        for (const object of page.objects) {
          if (keyOwner(object.key) !== userId) continue;
          await this.storage.delete(object.key);
          deleted += 1;
        }
        token = page.nextToken ?? undefined;
      } while (token);
    }
    return deleted;
  }
}
