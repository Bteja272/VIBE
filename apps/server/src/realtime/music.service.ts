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

import { DatabaseService } from '../database/database.service';

export type MusicPermission =
  | 'OWNER_ONLY'
  | 'ANY_MEMBER';

export interface RoomMusicState {
  roomId: string;
  permission: MusicPermission;

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
  implements OnModuleInit, OnModuleDestroy
{
  private readonly redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ??
      'redis://localhost:6379';

    this.redis = createClient({
      url: redisUrl,
    });

    this.redis.on('error', (error) => {
      console.error(
        'Redis music error:',
        error,
      );
    });
  }

  async onModuleInit() {
    await this.redis.connect();

    console.log(
      'Redis music service connected',
    );
  }

  async onModuleDestroy() {
    if (this.redis.isOpen) {
      await this.redis.quit();
    }
  }

  async getState(
    roomId: string,
  ): Promise<RoomMusicState> {
    await this.ensureRoomExists(roomId);

    const key =
      this.getMusicKey(roomId);

    const stored =
      await this.redis.get(key);

    if (!stored) {
      return {
        roomId,
        permission: 'OWNER_ONLY',
        track: null,
        updatedAt:
          new Date().toISOString(),
      };
    }

    return JSON.parse(
      stored,
    ) as RoomMusicState;
  }

  async setTrack(input: {
    roomId: string;
    userEmail: string;
    url: string;
    title?: string;
    provider?: string;
  }): Promise<RoomMusicState> {
    const state =
      await this.getState(
        input.roomId,
      );

    await this.ensureCanControlMusic(
      input.roomId,
      input.userEmail,
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

    const nextState: RoomMusicState = {
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
          input.userEmail,
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
    userEmail: string,
  ): Promise<RoomMusicState> {
    const state =
      await this.getState(roomId);

    await this.ensureCanControlMusic(
      roomId,
      userEmail,
      state.permission,
    );

    const nextState: RoomMusicState = {
      ...state,

      track: null,

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
    userEmail: string,
    permission: MusicPermission,
  ): Promise<RoomMusicState> {
    const owner =
      await this.isRoomOwner(
        roomId,
        userEmail,
      );

    if (!owner) {
      throw new ForbiddenException(
        'Only the room owner can change music permissions',
      );
    }

    if (
      permission !== 'OWNER_ONLY' &&
      permission !== 'ANY_MEMBER'
    ) {
      throw new BadRequestException(
        'Invalid music permission',
      );
    }

    const state =
      await this.getState(
        roomId,
      );

    const nextState: RoomMusicState = {
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
        userEmail: string,
        _permission: MusicPermission,
        ) {
        const member =
            await this.isRoomMember(
            roomId,
            userEmail,
            );

        if (!member) {
            throw new ForbiddenException(
            'Join the room before controlling music',
            );
        }
        }


  private async isRoomOwner(
    roomId: string,
    email: string,
  ) {
    const user =
      await this.databaseService.client.user.findUnique({
        where: {
          email,
        },
      });

    if (!user) {
      return false;
    }

    const room =
      await this.databaseService.client.room.findUnique({
        where: {
          id: roomId,
        },

        select: {
          ownerId: true,
        },
      });

    if (!room) {
      throw new NotFoundException(
        'Room not found',
      );
    }

    return (
      room.ownerId === user.id
    );
  }

  private async isRoomMember(
    roomId: string,
    email: string,
  ) {
    const user =
      await this.databaseService.client.user.findUnique({
        where: {
          email,
        },
      });

    if (!user) {
      return false;
    }

    const membership =
      await this.databaseService.client.roomMembership.findUnique({
        where: {
          userId_roomId: {
            userId: user.id,
            roomId,
          },
        },
      });

    return Boolean(
      membership,
    );
  }

  private async ensureRoomExists(
    roomId: string,
  ) {
    const room =
      await this.databaseService.client.room.findUnique({
        where: {
          id: roomId,
        },

        select: {
          id: true,
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
      JSON.stringify(state),
    );
  }

  private getMusicKey(
    roomId: string,
  ) {
    return `vibe:music:${roomId}`;
  }
}