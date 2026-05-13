import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import IORedis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);

  constructor(
    app: any,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    const pubClient = new IORedis(this.redisUrl, { lazyConnect: true });
    const subClient = pubClient.duplicate();

    // Ensure redis pub/sub is ready (adapter will also work if already connected)
    void pubClient.connect().catch((e) => {
      this.logger.warn(`Failed to connect Redis pub client: ${String(e)}`);
    });
    void subClient.connect().catch((e) => {
      this.logger.warn(`Failed to connect Redis sub client: ${String(e)}`);
    });

    server.adapter(createAdapter(pubClient, subClient));
    return server;
  }
}
