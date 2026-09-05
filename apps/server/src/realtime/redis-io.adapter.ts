import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import type { ServerOptions } from 'socket.io';

import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor:
    | ReturnType<typeof createAdapter>
    | undefined;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl =
      process.env.REDIS_URL ?? 'redis://localhost:6379';

    const pubClient = createClient({
      url: redisUrl,
    });

    const subClient = pubClient.duplicate();

    pubClient.on('error', (error) => {
      console.error(
        'Redis Socket.IO publisher error:',
        error,
      );
    });

    subClient.on('error', (error) => {
      console.error(
        'Redis Socket.IO subscriber error:',
        error,
      );
    });

    await Promise.all([
      pubClient.connect(),
      subClient.connect(),
    ]);

    this.adapterConstructor = createAdapter(
      pubClient,
      subClient,
    );

    console.log(
      `Socket.IO Redis adapter connected: ${redisUrl}`,
    );
  }

  createIOServer(
    port: number,
    options?: ServerOptions,
  ) {
    const server = super.createIOServer(
      port,
      options,
    );

    if (!this.adapterConstructor) {
      throw new Error(
        'Redis Socket.IO adapter is not initialized',
      );
    }

    server.adapter(this.adapterConstructor);

    return server;
  }
}