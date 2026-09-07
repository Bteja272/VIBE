import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

export interface PresenceUser {
  presenceId: string;
  socketId: string;
  userEmail: string;
}

const MAX_ROOM_CAPACITY = 12;

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

  async isPresent(
    roomId: string,
    presenceId: string,
  ): Promise<boolean> {
    return this.redis.hExists(
      this.getPresenceKey(roomId),
      presenceId,
    );
  }

  async addUser(
    roomId: string,
    user: PresenceUser,
  ): Promise<boolean> {
    const key =
      this.getPresenceKey(roomId);

    /*
     * Atomic capacity check + insert.
     *
     * Existing presenceIds are allowed to update
     * their socketId. This makes refreshes safe.
     *
     * New presenceIds are rejected once the room
     * already contains 12 active participants.
     */
    const script = `
      local key = KEYS[1]
      local presenceId = ARGV[1]
      local userJson = ARGV[2]
      local capacity = tonumber(ARGV[3])

      if redis.call("HEXISTS", key, presenceId) == 1 then
        redis.call("HSET", key, presenceId, userJson)
        return 1
      end

      local count = redis.call("HLEN", key)

      if count >= capacity then
        return 0
      end

      redis.call("HSET", key, presenceId, userJson)
      return 1
    `;

    const result =
      await this.redis.eval(
        script,
        {
          keys: [key],

          arguments: [
            user.presenceId,
            JSON.stringify(user),
            String(MAX_ROOM_CAPACITY),
          ],
        },
      );

    return Number(result) === 1;
  }

  async removeUser(
    roomId: string,
    presenceId: string,
    socketId: string,
  ) {
    const key =
      this.getPresenceKey(roomId);

    const stored =
      await this.redis.hGet(
        key,
        presenceId,
      );

    if (!stored) {
      return;
    }

    let current: PresenceUser;

    try {
      current =
        JSON.parse(stored) as PresenceUser;
    } catch {
      await this.redis.hDel(
        key,
        presenceId,
      );

      return;
    }

    /*
     * A refresh creates a new socket but keeps
     * the same presenceId.
     *
     * The old socket may disconnect after the new
     * socket replaced it in Redis. Do not let the
     * old disconnect remove the new connection.
     */
    if (
      current.socketId !== socketId
    ) {
      return;
    }

    await this.redis.hDel(
      key,
      presenceId,
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
    const values =
      await this.redis.hVals(
        this.getPresenceKey(roomId),
      );

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

  async getCount(
    roomId: string,
  ): Promise<number> {
    return this.redis.hLen(
      this.getPresenceKey(roomId),
    );
  }

  private getPresenceKey(
    roomId: string,
  ) {
    return `vibe:presence:${roomId}`;
  }
}