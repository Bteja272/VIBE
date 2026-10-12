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

  seatId?: string;

  lastSeenAt: string;
}

type PresenceUserInput = Omit<PresenceUser, 'lastSeenAt'>;

const MAX_ROOM_CAPACITY = 12;

const PRESENCE_STALE_AFTER_MS = 75_000;

const SEAT_IDS = [
  'seat-1',
  'seat-2',
  'seat-3',
  'seat-4',
  'seat-5',
  'seat-6',
  'seat-7',
  'seat-8',
  'seat-9',
  'seat-10',
  'seat-11',
  'seat-12',
] as const;

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

  async getUserById(
    roomId: string,
    userId: string,
  ): Promise<PresenceUser | null> {
    const users = await this.getUsers(roomId);

    return users.find((user) => user.userId === userId) ?? null;
  }

  async addUser(roomId: string, user: PresenceUserInput): Promise<boolean> {
    /*
     * Clear abandoned entries before calculating room capacity.
     */
    await this.removeStaleUsers(roomId);

    const key = this.getPresenceKey(roomId);

    const storedUser: PresenceUser = {
      ...user,
      lastSeenAt: new Date().toISOString(),
    };

    /*
     * Deduplicate by logical userId and preserve an already-assigned seat
     * across socket replacement/reconnect.
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

      local preservedSeatId = nil

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

        if ok then
          if (
            (
              existingPresenceId == presenceId or
              existingUser["userId"] == userId
            ) and
            existingUser["seatId"]
          ) then
            preservedSeatId =
              existingUser["seatId"]
          end

          if (
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
      end

      local decodeOk, decodedUser =
        pcall(
          cjson.decode,
          userJson
        )

      if (
        decodeOk and
        preservedSeatId and
        not decodedUser["seatId"]
      ) then
        decodedUser["seatId"] =
          preservedSeatId

        userJson =
          cjson.encode(decodedUser)
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

  async ensureSeat(
    roomId: string,
    presenceId: string,
    socketId: string,
  ): Promise<string | null> {
    const key = this.getPresenceKey(roomId);

    /*
     * Seat allocation is atomic so two participants cannot be assigned
     * the same empty seat during concurrent room entry.
     */
    const script = `
      local key = KEYS[1]

      local presenceId = ARGV[1]
      local socketId = ARGV[2]

      local currentJson =
        redis.call(
          "HGET",
          key,
          presenceId
        )

      if not currentJson then
        return ""
      end

      local ok, current =
        pcall(
          cjson.decode,
          currentJson
        )

      if not ok then
        return ""
      end

      if current["socketId"] ~= socketId then
        return ""
      end

      local validSeats = {}

      for i = 3, #ARGV do
        validSeats[ARGV[i]] = true
      end

      local entries =
        redis.call(
          "HGETALL",
          key
        )

      local occupied = {}

      for i = 1, #entries, 2 do
        local otherPresenceId =
          entries[i]

        local otherJson =
          entries[i + 1]

        local parsedOk, otherUser =
          pcall(
            cjson.decode,
            otherJson
          )

        if (
          parsedOk and
          otherPresenceId ~= presenceId and
          otherUser["seatId"] and
          validSeats[otherUser["seatId"]]
        ) then
          occupied[otherUser["seatId"]] = true
        end
      end

      if (
        current["seatId"] and
        validSeats[current["seatId"]] and
        not occupied[current["seatId"]]
      ) then
        return current["seatId"]
      end

      for i = 3, #ARGV do
        local seatId = ARGV[i]

        if not occupied[seatId] then
          current["seatId"] = seatId

          redis.call(
            "HSET",
            key,
            presenceId,
            cjson.encode(current)
          )

          return seatId
        end
      end

      return ""
    `;

    const result = await this.redis.eval(script, {
      keys: [key],

      arguments: [presenceId, socketId, ...SEAT_IDS],
    });

    return typeof result === 'string' && result ? result : null;
  }

  async moveSeat(
    roomId: string,
    presenceId: string,
    socketId: string,
    seatId: string,
  ): Promise<{
    moved: boolean;
    error?: string;
  }> {
    if (!SEAT_IDS.includes(seatId as (typeof SEAT_IDS)[number])) {
      return {
        moved: false,
        error: 'Invalid seat',
      };
    }

    const key = this.getPresenceKey(roomId);

    /*
     * Validate occupancy and update the participant in one Redis operation.
     * This prevents two clients from claiming the same seat concurrently.
     */
    const script = `
      local key = KEYS[1]

      local presenceId = ARGV[1]
      local socketId = ARGV[2]
      local requestedSeat = ARGV[3]

      local currentJson =
        redis.call(
          "HGET",
          key,
          presenceId
        )

      if not currentJson then
        return 0
      end

      local ok, current =
        pcall(
          cjson.decode,
          currentJson
        )

      if not ok then
        return 0
      end

      if current["socketId"] ~= socketId then
        return 0
      end

      local entries =
        redis.call(
          "HGETALL",
          key
        )

      for i = 1, #entries, 2 do
        local otherPresenceId =
          entries[i]

        local otherJson =
          entries[i + 1]

        if otherPresenceId ~= presenceId then
          local parsedOk, otherUser =
            pcall(
              cjson.decode,
              otherJson
            )

          if (
            parsedOk and
            otherUser["seatId"] == requestedSeat
          ) then
            return -1
          end
        end
      end

      current["seatId"] = requestedSeat

      redis.call(
        "HSET",
        key,
        presenceId,
        cjson.encode(current)
      )

      return 1
    `;

    const result = Number(
      await this.redis.eval(script, {
        keys: [key],

        arguments: [presenceId, socketId, seatId],
      }),
    );

    if (result === -1) {
      return {
        moved: false,
        error: 'That seat is already occupied',
      };
    }

    if (result !== 1) {
      return {
        moved: false,
        error: 'You are no longer present in this room',
      };
    }

    return {
      moved: true,
    };
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
     * A heartbeat from an old socket must not keep a replacement
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
        if (typeof value !== 'string') {
          continue;
        }

        const user = JSON.parse(value) as PresenceUser;

        /*
         * Entries created before heartbeat support have no lastSeenAt and
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
