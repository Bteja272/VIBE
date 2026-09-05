import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

export interface PresenceUser {
  presenceId: string;
  socketId: string;
  userEmail: string;
}

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    this.redis = createClient({
      url: redisUrl,
    });

    this.redis.on('error', (error) => {
      console.error('Redis presence error:', error);
    });
  }
  async isPresent(roomId: string, presenceId: string): Promise<boolean> {
    const key = this.getPresenceKey(roomId);

    return this.redis.hExists(key, presenceId);
  }

  async onModuleInit() {
    await this.redis.connect();

    console.log('Redis presence service connected');
  }

  async onModuleDestroy() {
    if (this.redis.isOpen) {
      await this.redis.quit();
    }
  }

  async addUser(roomId: string, user: PresenceUser) {
    const key = this.getPresenceKey(roomId);

    /*
     * presenceId is the Redis field.
     *
     * A browser refresh creates a new socketId,
     * but keeps the same presenceId.
     *
     * hSet therefore replaces the old socket
     * instead of adding another person.
     */
    await this.redis.hSet(key, user.presenceId, JSON.stringify(user));
  }

  async removeUser(roomId: string, presenceId: string, socketId: string) {
    const key = this.getPresenceKey(roomId);

    const stored = await this.redis.hGet(key, presenceId);

    if (!stored) {
      return;
    }

    let current: PresenceUser;

    try {
      current = JSON.parse(stored) as PresenceUser;
    } catch {
      await this.redis.hDel(key, presenceId);

      return;
    }

    /*
     * Very important for refreshes:
     *
     * old socket disconnects AFTER the new socket
     * has replaced it in Redis.
     *
     * We must not let that old disconnect delete
     * the new active presence entry.
     */
    if (current.socketId !== socketId) {
      return;
    }

    await this.redis.hDel(key, presenceId);

    const remaining = await this.redis.hLen(key);

    if (remaining === 0) {
      await this.redis.del(key);
    }
  }

  async getUsers(roomId: string): Promise<PresenceUser[]> {
    const key = this.getPresenceKey(roomId);

    const values = await this.redis.hVals(key);

    return values
      .map((value) => {
        try {
          return JSON.parse(value) as PresenceUser;
        } catch {
          return null;
        }
      })
      .filter((user): user is PresenceUser => user !== null);
  }

  private getPresenceKey(roomId: string) {
    return `vibe:presence:${roomId}`;
  }
}
