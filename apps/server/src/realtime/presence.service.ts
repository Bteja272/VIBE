import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

export interface PresenceUser {
  socketId: string;
  userEmail: string;
}

@Injectable()
export class PresenceService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly redis;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ??
      'redis://localhost:6379';

    this.redis = createClient({
      url: redisUrl,
    });

    this.redis.on('error', (error) => {
      console.error(
        'Redis presence error:',
        error,
      );
    });
  }

  async onModuleInit() {
    await this.redis.connect();

    console.log(
      'Redis presence service connected',
    );
  }

  async onModuleDestroy() {
    if (this.redis.isOpen) {
      await this.redis.quit();
    }
  }

  async addUser(
    roomId: string,
    user: PresenceUser,
  ) {
    const key = this.getPresenceKey(roomId);

    await this.redis.hSet(
      key,
      user.socketId,
      JSON.stringify(user),
    );
  }

  async removeUser(
    roomId: string,
    socketId: string,
  ) {
    const key = this.getPresenceKey(roomId);

    await this.redis.hDel(
      key,
      socketId,
    );

    const remaining =
      await this.redis.hLen(key);

    if (remaining === 0) {
      await this.redis.del(key);
    }
  }

  async getUsers(
    roomId: string,
  ): Promise<PresenceUser[]> {
    const key = this.getPresenceKey(roomId);

    const values =
      await this.redis.hVals(key);

    return values
      .map((value) => {
        try {
          return JSON.parse(
            value,
          ) as PresenceUser;
        } catch {
          return null;
        }
      })
      .filter(
        (
          user,
        ): user is PresenceUser =>
          user !== null,
      );
  }

  private getPresenceKey(
    roomId: string,
  ) {
    return `vibe:presence:${roomId}`;
  }
}