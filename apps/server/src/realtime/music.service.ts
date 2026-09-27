import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';

import type { AuthUser } from '../auth/auth-user';
import { DatabaseService } from '../database/database.service';

export type MusicPermission = 'OWNER_ONLY' | 'ANY_MEMBER';

export type PlaybackStatus = 'PLAYING' | 'PAUSED';

export type PlaybackAction = 'PLAY' | 'PAUSE' | 'SEEK';

export interface MusicPlaybackState {
  status: PlaybackStatus;
  positionSeconds: number;
  updatedAt: string;
}

export interface RoomMusicState {
  roomId: string;

  /*
   * Monotonically increasing room-music revision.
   *
   * Clients use this to reject stale Socket.IO acknowledgements
   * or broadcasts that arrive after a newer state.
   */
  revision: number;

  permission: MusicPermission;

  track: {
    trackId?: string;
    url: string;
    title?: string;
    provider?: string;
    videoId?: string;
    sharedBy: string;
  } | null;

  playback?: MusicPlaybackState | null;

  updatedAt: string;
}

export interface PlaybackCommand {
  roomId: string;
  user: AuthUser;
  trackId: string;
  action: PlaybackAction;
  positionSeconds: number;
}

interface ParsedMusicUrl {
  url: string;
  provider?: 'youtube';
  videoId?: string;
}

const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

const YOUTUBE_SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);

const MAX_POSITION_SECONDS = 86_400;

/*
 * Redis executes this script atomically.
 *
 * It verifies:
 * - a track still exists
 * - the command belongs to the current track
 * - the track supports shared playback
 * - the user still has permission
 *
 * Only after those checks does it update playback state.
 */
const UPDATE_PLAYBACK_SCRIPT = `
  local stored = redis.call('GET', KEYS[1])

  if not stored then
    return 'NO_TRACK'
  end

  local state = cjson.decode(stored)

  if not state.track or state.track == cjson.null then
    return 'NO_TRACK'
  end

  if not state.track.trackId or
     state.track.trackId ~= ARGV[1] then
    return 'STALE_TRACK'
  end

  if state.track.provider ~= 'youtube' then
    return 'UNSUPPORTED_TRACK'
  end

  if state.permission ~= 'ANY_MEMBER' and ARGV[2] ~= '1' then
    return 'FORBIDDEN'
  end

  local previousStatus = 'PAUSED'

  if state.playback and state.playback ~= cjson.null then
    previousStatus = state.playback.status
  end

  local nextStatus = previousStatus

  if ARGV[3] == 'PLAY' then
    nextStatus = 'PLAYING'
  elseif ARGV[3] == 'PAUSE' then
    nextStatus = 'PAUSED'
  elseif ARGV[3] ~= 'SEEK' then
    return 'INVALID_ACTION'
  end

  state.revision =
    (state.revision or 0) + 1

  state.playback = {
    status = nextStatus,
    positionSeconds = tonumber(ARGV[4]),
    updatedAt = ARGV[5]
  }

  state.updatedAt = ARGV[5]

  local encoded = cjson.encode(state)

  redis.call(
    'SET',
    KEYS[1],
    encoded
  )

  return encoded
`;

function parseMusicUrl(input: string): ParsedMusicUrl {
  const url = input.trim();

  if (!url) {
    throw new BadRequestException('Music URL is required');
  }

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('Music URL is invalid');
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new BadRequestException(
      'Music URL must be a valid HTTP or HTTPS link',
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(hostname) || YOUTUBE_SHORT_HOSTS.has(hostname)) {
    let videoId: string | null | undefined;

    if (YOUTUBE_SHORT_HOSTS.has(hostname)) {
      const pathParts = parsed.pathname.split('/').filter(Boolean);

      videoId = pathParts.length === 1 ? pathParts[0] : null;
    } else if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v');
    } else {
      const pathMatch = parsed.pathname.match(
        /^\/(?:shorts|live|embed)\/([^/]+)\/?$/,
      );

      videoId = pathMatch?.[1];
    }

    if (!videoId || !YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      throw new BadRequestException('Provide a valid YouTube video URL');
    }

    return {
      url,
      provider: 'youtube',
      videoId,
    };
  }

  return {
    url,
  };
}

@Injectable()
export class MusicService implements OnModuleInit, OnModuleDestroy {
  private readonly redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    this.redis = createClient({
      url: redisUrl,
    });

    this.redis.on('error', (error) => {
      console.error('Redis music error:', error);
    });
  }

  async onModuleInit() {
    await this.redis.connect();

    console.log('Redis music service connected');
  }

  async onModuleDestroy() {
    if (this.redis.isOpen) {
      await this.redis.quit();
    }
  }

  async getState(roomId: string): Promise<RoomMusicState> {
    await this.ensureRoomExists(roomId);

    const stored = await this.redis.get(this.getMusicKey(roomId));

    if (!stored) {
      return {
        roomId,
        revision: 0,
        permission: 'OWNER_ONLY',
        track: null,
        playback: null,
        updatedAt: new Date().toISOString(),
      };
    }

    const parsed = JSON.parse(stored) as Partial<RoomMusicState>;

    /*
     * Existing Redis state created before revisions were introduced
     * may not contain revision yet.
     *
     * Normalize that state here instead of forcing a Redis migration.
     */
    return {
      ...(parsed as RoomMusicState),
      revision:
        typeof parsed.revision === 'number' && Number.isFinite(parsed.revision)
          ? Math.max(0, parsed.revision)
          : 0,
    };
  }

  async setTrack(input: {
    roomId: string;
    user: AuthUser;
    url: string;
    title?: string;
  }): Promise<RoomMusicState> {
    const state = await this.getState(input.roomId);

    await this.ensureCanControlMusic(
      input.roomId,
      input.user,
      state.permission,
    );

    const parsedUrl = parseMusicUrl(input.url);

    const now = new Date().toISOString();

    const nextState: RoomMusicState = {
      roomId: input.roomId,

      revision: state.revision + 1,

      permission: state.permission,

      track: {
        trackId: randomUUID(),
        url: parsedUrl.url,

        title: input.title?.trim() || undefined,

        provider: parsedUrl.provider,

        videoId: parsedUrl.videoId,

        sharedBy: input.user.displayName,
      },

      playback:
        parsedUrl.provider === 'youtube'
          ? {
              status: 'PAUSED',
              positionSeconds: 0,
              updatedAt: now,
            }
          : null,

      updatedAt: now,
    };

    await this.saveState(nextState);

    return nextState;
  }

  async clearTrack(roomId: string, user: AuthUser): Promise<RoomMusicState> {
    const state = await this.getState(roomId);

    await this.ensureCanControlMusic(roomId, user, state.permission);

    const nextState: RoomMusicState = {
      ...state,

      revision: state.revision + 1,

      track: null,

      playback: null,

      updatedAt: new Date().toISOString(),
    };

    await this.saveState(nextState);

    return nextState;
  }

  async setPermission(
    roomId: string,
    user: AuthUser,
    permission: MusicPermission,
  ): Promise<RoomMusicState> {
    const owner = await this.isRoomOwner(roomId, user.id);

    if (user.type !== 'REGISTERED' || !owner) {
      throw new ForbiddenException(
        'Only the room owner can change music permissions',
      );
    }

    if (permission !== 'OWNER_ONLY' && permission !== 'ANY_MEMBER') {
      throw new BadRequestException('Invalid music permission');
    }

    const state = await this.getState(roomId);

    const nextState: RoomMusicState = {
      ...state,

      revision: state.revision + 1,

      permission,

      updatedAt: new Date().toISOString(),
    };

    await this.saveState(nextState);

    return nextState;
  }

  async updatePlayback(command: PlaybackCommand): Promise<RoomMusicState> {
    const { roomId, user, trackId, action, positionSeconds } = command;

    await this.ensureRoomExists(roomId);

    if (typeof trackId !== 'string' || !trackId.trim()) {
      throw new BadRequestException('Track ID is required');
    }

    if (action !== 'PLAY' && action !== 'PAUSE' && action !== 'SEEK') {
      throw new BadRequestException('Invalid playback action');
    }

    if (
      typeof positionSeconds !== 'number' ||
      !Number.isFinite(positionSeconds) ||
      positionSeconds < 0 ||
      positionSeconds > MAX_POSITION_SECONDS
    ) {
      throw new BadRequestException('Invalid playback position');
    }

    const isOwner =
      user.type === 'REGISTERED' && (await this.isRoomOwner(roomId, user.id));

    const now = new Date().toISOString();

    const result = await this.redis.eval(UPDATE_PLAYBACK_SCRIPT, {
      keys: [this.getMusicKey(roomId)],

      arguments: [
        trackId,
        isOwner ? '1' : '0',
        action,
        String(positionSeconds),
        now,
      ],
    });

    if (result === 'NO_TRACK') {
      throw new BadRequestException('No shared track is available');
    }

    if (result === 'STALE_TRACK') {
      throw new BadRequestException(
        'This track has been replaced. Refresh the player.',
      );
    }

    if (result === 'UNSUPPORTED_TRACK') {
      throw new BadRequestException(
        'Shared playback is currently supported for YouTube only',
      );
    }

    if (result === 'FORBIDDEN') {
      throw new ForbiddenException('Only the room owner can control music');
    }

    if (result === 'INVALID_ACTION') {
      throw new BadRequestException('Invalid playback action');
    }

    if (typeof result !== 'string') {
      throw new Error('Unexpected Redis playback response');
    }

    const parsed = JSON.parse(result) as RoomMusicState;

    /*
     * The Lua script always increments revision before returning,
     * but normalizing here keeps the TypeScript contract defensive
     * if legacy state somehow reaches this path.
     */
    return {
      ...parsed,

      revision:
        typeof parsed.revision === 'number' && Number.isFinite(parsed.revision)
          ? Math.max(0, parsed.revision)
          : 0,
    };
  }

  private async ensureCanControlMusic(
    roomId: string,
    user: AuthUser,
    permission: MusicPermission,
  ) {
    if (permission === 'ANY_MEMBER') {
      /*
       * The realtime gateway verifies active room presence
       * before calling this service.
       */
      return;
    }

    if (
      user.type !== 'REGISTERED' ||
      !(await this.isRoomOwner(roomId, user.id))
    ) {
      throw new ForbiddenException('Only the room owner can control music');
    }
  }

  private async isRoomOwner(roomId: string, userId: string) {
    const room = await this.databaseService.client.room.findUnique({
      where: {
        id: roomId,
      },

      select: {
        ownerId: true,
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room.ownerId === userId;
  }

  private async ensureRoomExists(roomId: string) {
    const room = await this.databaseService.client.room.findUnique({
      where: {
        id: roomId,
      },

      select: {
        id: true,
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }
  }

  private async saveState(state: RoomMusicState) {
    await this.redis.set(
      this.getMusicKey(state.roomId),

      JSON.stringify(state),
    );
  }

  private getMusicKey(roomId: string) {
    return `vibe:music:${roomId}`;
  }
}
