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

import type {
  AuthUser,
} from '../auth/auth-user';

import {
  DatabaseService,
} from '../database/database.service';

export type MusicPermission =
  | 'OWNER_ONLY'
  | 'ANY_MEMBER';

export interface RoomMusicState {
  roomId: string;

  permission:
    MusicPermission;

  track: {
    url: string;
    title?: string;
    provider?: string;
    sharedBy: string;
  } | null;

  updatedAt: string;
}

@Injectable()
export class MusicService
  implements
    OnModuleInit,
    OnModuleDestroy
{
  private readonly redis;

  constructor(
    private readonly configService:
      ConfigService,

    private readonly databaseService:
      DatabaseService,
  ) {
    const redisUrl =
      this.configService.get<string>(
        'REDIS_URL',
      ) ??
      'redis://localhost:6379';

    this.redis =
      createClient({
        url: redisUrl,
      });

    this.redis.on(
      'error',
      (error) => {
        console.error(
          'Redis music error:',
          error,
        );
      },
    );
  }

  async onModuleInit() {
    await this.redis.connect();

    console.log(
      'Redis music service connected',
    );
  }

  async onModuleDestroy() {
    if (
      this.redis.isOpen
    ) {
      await this.redis.quit();
    }
  }

  async getState(
    roomId: string,
  ): Promise<
    RoomMusicState
  > {
    await this.ensureRoomExists(
      roomId,
    );

    const key =
      this.getMusicKey(
        roomId,
      );

    const stored =
      await this.redis.get(
        key,
      );

    if (!stored) {
      return {
        roomId,

        permission:
          'OWNER_ONLY',

        track:
          null,

        updatedAt:
          new Date().toISOString(),
      };
    }

    return JSON.parse(
      stored,
    ) as RoomMusicState;
  }

  async setTrack(
    input: {
      roomId: string;
      user: AuthUser;

      url: string;
      title?: string;
      provider?: string;
    },
  ): Promise<
    RoomMusicState
  > {
    const state =
      await this.getState(
        input.roomId,
      );

    await this.ensureCanControlMusic(
      input.roomId,
      input.user,
      state.permission,
    );

    const url =
      input.url.trim();

    if (!url) {
      throw new BadRequestException(
        'Music URL is required',
      );
    }

    try {
      new URL(url);
    } catch {
      throw new BadRequestException(
        'Music URL is invalid',
      );
    }

    const nextState:
      RoomMusicState = {
        roomId:
          input.roomId,

        permission:
          state.permission,

        track: {
          url,

          title:
            input.title?.trim() ||
            undefined,

          provider:
            input.provider?.trim() ||
            undefined,

          sharedBy:
            input.user.displayName,
        },

        updatedAt:
          new Date().toISOString(),
      };

    await this.saveState(
      nextState,
    );

    return nextState;
  }

  async clearTrack(
    roomId: string,
    user: AuthUser,
  ): Promise<
    RoomMusicState
  > {
    const state =
      await this.getState(
        roomId,
      );

    await this.ensureCanControlMusic(
      roomId,
      user,
      state.permission,
    );

    const nextState:
      RoomMusicState = {
        ...state,

        track:
          null,

        updatedAt:
          new Date().toISOString(),
      };

    await this.saveState(
      nextState,
    );

    return nextState;
  }

  async setPermission(
    roomId: string,
    user: AuthUser,
    permission:
      MusicPermission,
  ): Promise<
    RoomMusicState
  > {
    const owner =
      await this.isRoomOwner(
        roomId,
        user.id,
      );

    if (
      user.type !==
        'REGISTERED' ||
      !owner
    ) {
      throw new ForbiddenException(
        'Only the room owner can change music permissions',
      );
    }

    if (
      permission !==
        'OWNER_ONLY' &&
      permission !==
        'ANY_MEMBER'
    ) {
      throw new BadRequestException(
        'Invalid music permission',
      );
    }

    const state =
      await this.getState(
        roomId,
      );

    const nextState:
      RoomMusicState = {
        ...state,

        permission,

        updatedAt:
          new Date().toISOString(),
      };

    await this.saveState(
      nextState,
    );

    return nextState;
  }

  private async ensureCanControlMusic(
    roomId: string,
    user: AuthUser,
    permission:
      MusicPermission,
  ) {
    if (
      permission ===
      'ANY_MEMBER'
    ) {
      /*
       * The gateway already confirms this
       * identity is actively present.
       */
      return;
    }

    if (
      user.type !==
      'REGISTERED'
    ) {
      throw new ForbiddenException(
        'Only the room owner can control music',
      );
    }

    const owner =
      await this.isRoomOwner(
        roomId,
        user.id,
      );

    if (!owner) {
      throw new ForbiddenException(
        'Only the room owner can control music',
      );
    }
  }

  private async isRoomOwner(
    roomId: string,
    userId: string,
  ) {
    const room =
      await this.databaseService.client.room.findUnique({
        where: {
          id:
            roomId,
        },

        select: {
          ownerId:
            true,
        },
      });

    if (!room) {
      throw new NotFoundException(
        'Room not found',
      );
    }

    return (
      room.ownerId ===
      userId
    );
  }

  private async ensureRoomExists(
    roomId: string,
  ) {
    const room =
      await this.databaseService.client.room.findUnique({
        where: {
          id:
            roomId,
        },

        select: {
          id:
            true,
        },
      });

    if (!room) {
      throw new NotFoundException(
        'Room not found',
      );
    }
  }

  private async saveState(
    state: RoomMusicState,
  ) {
    await this.redis.set(
      this.getMusicKey(
        state.roomId,
      ),

      JSON.stringify(
        state,
      ),
    );
  }

  private getMusicKey(
    roomId: string,
  ) {
    return `vibe:music:${roomId}`;
  }
}