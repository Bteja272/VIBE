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

export type BoardMediaType = 'IMAGE' | 'YOUTUBE';

export interface RoomBoardState {
  roomId: string;
  revision: number;
  media: {
    type: BoardMediaType;
    url: string;
    title?: string;
    videoId?: string;
    updatedBy: string;
  } | null;
  updatedAt: string;
}

interface ParsedBoardMedia {
  type: BoardMediaType;
  url: string;
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

const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 120;

function parseHttpUrl(input: string): URL {
  const value = input.trim();

  if (!value) {
    throw new BadRequestException('Media URL is required');
  }

  if (value.length > MAX_URL_LENGTH) {
    throw new BadRequestException('Media URL is too long');
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new BadRequestException('Media URL is invalid');
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new BadRequestException(
      'Media URL must be a valid HTTP or HTTPS link',
    );
  }

  return parsed;
}

function parseYouTubeUrl(input: string): ParsedBoardMedia {
  const parsed = parseHttpUrl(input);

  const hostname = parsed.hostname.toLowerCase();

  if (!YOUTUBE_HOSTS.has(hostname) && !YOUTUBE_SHORT_HOSTS.has(hostname)) {
    throw new BadRequestException('Provide a valid YouTube video URL');
  }

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
    type: 'YOUTUBE',
    url: input.trim(),
    videoId,
  };
}

function parseBoardMedia(
  type: BoardMediaType,
  input: string,
): ParsedBoardMedia {
  if (type === 'YOUTUBE') {
    return parseYouTubeUrl(input);
  }

  if (type !== 'IMAGE') {
    throw new BadRequestException('Invalid room screen media type');
  }

  const parsed = parseHttpUrl(input);

  return {
    type: 'IMAGE',
    url: parsed.toString(),
  };
}

@Injectable()
export class BoardService implements OnModuleInit, OnModuleDestroy {
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
      console.error('Redis board error:', error);
    });
  }

  async onModuleInit() {
    await this.redis.connect();

    console.log('Redis board service connected');
  }

  async onModuleDestroy() {
    if (this.redis.isOpen) {
      await this.redis.quit();
    }
  }

  async getState(roomId: string): Promise<RoomBoardState> {
    await this.ensureRoomExists(roomId);

    const stored = await this.redis.get(this.getBoardKey(roomId));

    if (!stored) {
      return {
        roomId,
        revision: 0,
        media: null,
        updatedAt: new Date().toISOString(),
      };
    }

    const parsed = JSON.parse(stored) as Partial<RoomBoardState>;

    return {
      ...(parsed as RoomBoardState),
      revision:
        typeof parsed.revision === 'number' && Number.isFinite(parsed.revision)
          ? Math.max(0, parsed.revision)
          : 0,
    };
  }

  async setMedia(input: {
    roomId: string;
    user: AuthUser;
    type: BoardMediaType;
    url: string;
    title?: string;
  }): Promise<RoomBoardState> {
    await this.ensureOwner(input.roomId, input.user);

    const parsed = parseBoardMedia(input.type, input.url);

    const title = input.title?.trim();

    if (title && title.length > MAX_TITLE_LENGTH) {
      throw new BadRequestException(
        `Title cannot exceed ${MAX_TITLE_LENGTH} characters`,
      );
    }

    const current = await this.getState(input.roomId);

    const now = new Date().toISOString();

    const nextState: RoomBoardState = {
      roomId: input.roomId,
      revision: current.revision + 1,
      media: {
        type: parsed.type,
        url: parsed.url,
        title: title || undefined,
        videoId: parsed.videoId,
        updatedBy: input.user.displayName,
      },
      updatedAt: now,
    };

    await this.saveState(nextState);

    return nextState;
  }

  async clearMedia(roomId: string, user: AuthUser): Promise<RoomBoardState> {
    await this.ensureOwner(roomId, user);

    const current = await this.getState(roomId);

    const nextState: RoomBoardState = {
      roomId,
      revision: current.revision + 1,
      media: null,
      updatedAt: new Date().toISOString(),
    };

    await this.saveState(nextState);

    return nextState;
  }

  private async ensureOwner(roomId: string, user: AuthUser) {
    if (user.type !== 'REGISTERED') {
      throw new ForbiddenException(
        'Only the registered room owner can control the room screen',
      );
    }

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

    if (room.ownerId !== user.id) {
      throw new ForbiddenException(
        'Only the room owner can control the room screen',
      );
    }
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

  private async saveState(state: RoomBoardState) {
    await this.redis.set(this.getBoardKey(state.roomId), JSON.stringify(state));
  }

  private getBoardKey(roomId: string) {
    return `vibe:board:${roomId}`;
  }
}
