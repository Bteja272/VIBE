import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  RoomRole,
  RoomVisibility,
} from '@vibe/database';

import { DatabaseService } from '../database/database.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

const MAX_ROOM_CAPACITY = 12;

@Injectable()
export class RoomsService {
  constructor(
    private readonly databaseService:
      DatabaseService,
  ) {}

  async create(
    ownerId: string,
    input: CreateRoomDto,
  ) {
    await this.ensureUserExistsById(
      ownerId,
    );

    const slug =
      this.createSlug(
        input.name,
      );

    const room =
      await this.databaseService.client.room.create({
        data: {
          name:
            input.name,

          slug,

          description:
            input.description,

          visibility:
            input.visibility ??
            RoomVisibility.PRIVATE,

          ownerId,

          memberships: {
            create: {
              userId:
                ownerId,

              role:
                RoomRole.OWNER,
            },
          },
        },

        include: {
          owner: true,

          memberships: {
            include: {
              user: true,
            },
          },
        },
      });

    return this.withCapacity(
      room,
    );
  }

  async findAll() {
    const rooms =
      await this.databaseService.client.room.findMany({
        include: {
          owner: true,

          memberships: {
            include: {
              user: true,
            },
          },
        },

        orderBy: {
          createdAt:
            'desc',
        },
      });

    return rooms.map(
      (room) =>
        this.withCapacity(
          room,
        ),
    );
  }

  async findById(
    roomId: string,
  ) {
    const room =
      await this.databaseService.client.room.findUnique({
        where: {
          id: roomId,
        },

        include: {
          owner: true,

          memberships: {
            include: {
              user: true,
            },
          },
        },
      });

    if (!room) {
      throw new NotFoundException(
        'Room not found',
      );
    }

    return this.withCapacity(
      room,
    );
  }

  async findBySlug(
    slug: string,
  ) {
    const room =
      await this.databaseService.client.room.findUnique({
        where: {
          slug,
        },

        include: {
          owner: true,

          memberships: {
            include: {
              user: true,
            },
          },
        },
      });

    if (!room) {
      throw new NotFoundException(
        'Room not found',
      );
    }

    return this.withCapacity(
      room,
    );
  }

  async joinByUserId(
    roomId: string,
    userId: string,
  ) {
    await this.ensureRoomExists(
      roomId,
    );

    await this.ensureUserExistsById(
      userId,
    );

    const existingMembership =
      await this.databaseService.client.roomMembership.findUnique({
        where: {
          userId_roomId: {
            userId,
            roomId,
          },
        },

        include: {
          user: true,
          room: true,
        },
      });

    if (existingMembership) {
      return existingMembership;
    }

    return this.databaseService.client.roomMembership.create({
      data: {
        userId,
        roomId,

        role:
          RoomRole.MEMBER,
      },

      include: {
        user: true,
        room: true,
      },
    });
  }

  async leaveByUserId(
    roomId: string,
    userId: string,
  ) {
    const room =
      await this.databaseService.client.room.findUnique({
        where: {
          id: roomId,
        },
      });

    if (!room) {
      throw new NotFoundException(
        'Room not found',
      );
    }

    if (
      room.ownerId ===
      userId
    ) {
      throw new ForbiddenException(
        'Room owner cannot leave the room',
      );
    }

    const result =
      await this.databaseService.client.roomMembership.deleteMany({
        where: {
          userId,
          roomId,
        },
      });

    return {
      left:
        result.count > 0,
    };
  }

  async updateByUserId(
    roomId: string,
    userId: string,
    input: UpdateRoomDto,
  ) {
    const room =
      await this.databaseService.client.room.findUnique({
        where: {
          id: roomId,
        },
      });

    if (!room) {
      throw new NotFoundException(
        'Room not found',
      );
    }

    if (
      room.ownerId !==
      userId
    ) {
      throw new ForbiddenException(
        'Only the room owner can update this room',
      );
    }

    const updatedRoom =
      await this.databaseService.client.room.update({
        where: {
          id: roomId,
        },

        data: {
          name:
            input.name,

          description:
            input.description,

          visibility:
            input.visibility,
        },

        include: {
          owner: true,

          memberships: {
            include: {
              user: true,
            },
          },
        },
      });

    return this.withCapacity(
      updatedRoom,
    );
  }

  async removeByUserId(
    roomId: string,
    userId: string,
  ) {
    const room =
      await this.databaseService.client.room.findUnique({
        where: {
          id: roomId,
        },
      });

    if (!room) {
      throw new NotFoundException(
        'Room not found',
      );
    }

    if (
      room.ownerId !==
      userId
    ) {
      throw new ForbiddenException(
        'Only the room owner can delete this room',
      );
    }

    await this.databaseService.client.room.delete({
      where: {
        id: roomId,
      },
    });

    return {
      deleted: true,
    };
  }

  private withCapacity<
    T extends {
      memberships: unknown[];
    },
  >(room: T) {
    return {
      ...room,

      memberCount:
        room.memberships.length,

      capacity:
        MAX_ROOM_CAPACITY,
    };
  }

  private async ensureUserExistsById(
    userId: string,
  ) {
    const user =
      await this.databaseService.client.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    return user;
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

    return room;
  }

  private createSlug(
    name: string,
  ): string {
    const base =
      name
        .trim()
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          '-',
        )
        .replace(
          /^-+|-+$/g,
          '',
        );

    return `${base}-${Date.now()}`;
  }
}