import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

export interface PresenceUser {
  presenceId: string;
  socketId: string;

  userId: string;
  displayName: string;

  identityType: 'GUEST' | 'REGISTERED';

  email?: string;
  avatarId?: string;

  lastSeenAt: string;
}

type PresenceUserInput = Omit<PresenceUser, 'lastSeenAt'>;

const MAX_ROOM_CAPACITY = 12;

const PRESENCE_STALE_AFTER_MS = 75_000;

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

  async onModuleInit() {
    await this.redis.connect();

    console.log('Redis presence service connected');
  }

  async onModuleDestroy() {
    if (this.redis.isOpen) {
      await this.redis.quit();
    }
  }

  async isPresent(roomId: string, presenceId: string): Promise<boolean> {
    return this.redis.hExists(this.getPresenceKey(roomId), presenceId);
  }

  async addUser(roomId: string, user: PresenceUserInput): Promise<boolean> {
    /*
     * Clear abandoned entries before
     * calculating room capacity.
     */
    await this.removeStaleUsers(roomId);

    const key = this.getPresenceKey(roomId);

    const storedUser: PresenceUser = {
      ...user,

      lastSeenAt: new Date().toISOString(),
    };

    /*
     * Also deduplicate by logical userId.
     *
     * presenceId protects refresh/socket
     * replacement.
     *
     * userId prevents the same VIBE
     * identity appearing multiple times.
     */
    const script = `
      local key = KEYS[1]

      local presenceId = ARGV[1]
      local userJson = ARGV[2]
      local capacity = tonumber(ARGV[3])
      local userId = ARGV[4]

      local entries =
        redis.call(
          "HGETALL",
          key
        )

      for i = 1, #entries, 2 do
        local existingPresenceId =
          entries[i]

        local existingJson =
          entries[i + 1]

        local ok, existingUser =
          pcall(
            cjson.decode,
            existingJson
          )

        if (
          ok and
          existingUser["userId"] == userId and
          existingPresenceId ~= presenceId
        ) then
          redis.call(
            "HDEL",
            key,
            existingPresenceId
          )
        end
      end

      if redis.call(
        "HEXISTS",
        key,
        presenceId
      ) == 1 then
        redis.call(
          "HSET",
          key,
          presenceId,
          userJson
        )

        return 1
      end

      local count =
        redis.call(
          "HLEN",
          key
        )

      if count >= capacity then
        return 0
      end

      redis.call(
        "HSET",
        key,
        presenceId,
        userJson
      )

      return 1
    `;

    const result = await this.redis.eval(script, {
      keys: [key],

      arguments: [
        user.presenceId,

        JSON.stringify(storedUser),

        String(MAX_ROOM_CAPACITY),

        user.userId,
      ],
    });

    return Number(result) === 1;
  }

  async heartbeat(
    roomId: string,
    presenceId: string,
    socketId: string,
  ): Promise<boolean> {
    const key = this.getPresenceKey(roomId);

    const stored = await this.redis.hGet(key, presenceId);

    if (!stored) {
      return false;
    }

    let current: PresenceUser;

    try {
      current = JSON.parse(stored) as PresenceUser;
    } catch {
      await this.redis.hDel(key, presenceId);

      return false;
    }

    /*
     * A heartbeat from an old socket
     * must not keep a replacement
     * connection alive.
     */
    if (current.socketId !== socketId) {
      return false;
    }

    current.lastSeenAt = new Date().toISOString();

    await this.redis.hSet(key, presenceId, JSON.stringify(current));

    return true;
  }

  async removeStaleUsers(roomId: string): Promise<boolean> {
    const key = this.getPresenceKey(roomId);

    const entries = await this.redis.hGetAll(key);

    const now = Date.now();

    const stalePresenceIds: string[] = [];

    for (const [presenceId, value] of Object.entries(entries)) {
      try {
        const user = JSON.parse(value) as PresenceUser;

        /*
         * Entries created before heartbeat
         * support have no lastSeenAt and
         * should be removed.
         */
        if (!user.lastSeenAt) {
          stalePresenceIds.push(presenceId);

          continue;
        }

        const lastSeen = Date.parse(user.lastSeenAt);

        if (
          !Number.isFinite(lastSeen) ||
          now - lastSeen > PRESENCE_STALE_AFTER_MS
        ) {
          stalePresenceIds.push(presenceId);
        }
      } catch {
        stalePresenceIds.push(presenceId);
      }
    }

    if (stalePresenceIds.length === 0) {
      return false;
    }

    await this.redis.hDel(key, stalePresenceIds);

    const remaining = await this.redis.hLen(key);

    if (remaining === 0) {
      await this.redis.del(key);
    }

    return true;
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
    const values = await this.redis.hVals(this.getPresenceKey(roomId));

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

  async getCount(roomId: string): Promise<number> {
    return this.redis.hLen(this.getPresenceKey(roomId));
  }

  private getPresenceKey(roomId: string) {
    return `vibe:presence:${roomId}`;
  }
}
