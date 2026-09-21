
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

import type { AuthUser } from '../auth/auth-user';
import { DatabaseService } from '../database/database.service';

export type MusicPermission = 'OWNER_ONLY' | 'ANY_MEMBER';

export interface RoomMusicState {
  roomId: string;
  permission: MusicPermission;

  track: {
    url: string;
    title?: string;
    provider?: string;
    videoId?: string;
    sharedBy: string;
  } | null;

  updatedAt: string;
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

const YOUTUBE_SHORT_HOSTS = new Set([
  'youtu.be',
  'www.youtu.be',
]);

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
      throw new BadRequestException(
        'Provide a valid YouTube video URL',
      );
    }

    return {
      url,
      provider: 'youtube',
      videoId,
    };
  }

  // Other music services remain supported as links, not embeds.
  return { url };
}

@Injectable()
export class MusicService implements OnModuleInit, OnModuleDestroy {
  private readonly redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ??
      'redis://localhost:6379';

    this.redis = createClient({ url: redisUrl });

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
        permission: 'OWNER_ONLY',
        track: null,
        updatedAt: new Date().toISOString(),
      };
    }

    return JSON.parse(stored) as RoomMusicState;
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

    const nextState: RoomMusicState = {
      roomId: input.roomId,
      permission: state.permission,
      track: {
        url: parsedUrl.url,
        title: input.title?.trim() || undefined,
        provider: parsedUrl.provider,
        videoId: parsedUrl.videoId,
        sharedBy: input.user.displayName,
      },
      updatedAt: new Date().toISOString(),
    };

    await this.saveState(nextState);

    return nextState;
  }

  async clearTrack(
    roomId: string,
    user: AuthUser,
  ): Promise<RoomMusicState> {
    const state = await this.getState(roomId);

    await this.ensureCanControlMusic(
      roomId,
      user,
      state.permission,
    );

    const nextState: RoomMusicState = {
      ...state,
      track: null,
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
      permission,
      updatedAt: new Date().toISOString(),
    };

    await this.saveState(nextState);

    return nextState;
  }

  private async ensureCanControlMusic(
    roomId: string,
    user: AuthUser,
    permission: MusicPermission,
  ) {
    if (permission === 'ANY_MEMBER') {
      // The gateway verifies active presence before calling this method.
      return;
    }

    if (user.type !== 'REGISTERED') {
      throw new ForbiddenException(
        'Only the room owner can control music',
      );
    }

    const owner = await this.isRoomOwner(roomId, user.id);

    if (!owner) {
      throw new ForbiddenException(
        'Only the room owner can control music',
      );
    }
  }

  private async isRoomOwner(roomId: string, userId: string) {
    const room = await this.databaseService.client.room.findUnique({
      where: { id: roomId },
      select: { ownerId: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room.ownerId === userId;
  }

  private async ensureRoomExists(roomId: string) {
    const room = await this.databaseService.client.room.findUnique({
      where: { id: roomId },
      select: { id: true },
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