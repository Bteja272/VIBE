import {
  ConflictException,
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
    private readonly databaseService: DatabaseService,
  ) {}

  async createByDevUser(
    email: string,
    input: CreateRoomDto,
  ) {
    const user =
      await this.findUserByEmail(email);

    return this.create(
      user.id,
      input,
    );
  }

  async create(
    ownerId: string,
    input: CreateRoomDto,
  ) {
    const slug =
      this.createSlug(input.name);

    const room =
      await this.databaseService.client.room.create({
        data: {
          name: input.name,
          slug,
          description:
            input.description,

          visibility:
            input.visibility ??
            RoomVisibility.PRIVATE,

          ownerId,

          memberships: {
            create: {
              userId: ownerId,
              role: RoomRole.OWNER,
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

    return this.withCapacity(room);
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
          createdAt: 'desc',
        },
      });

    return rooms.map((room) =>
      this.withCapacity(room),
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

    return this.withCapacity(room);
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

    return this.withCapacity(room);
  }

  async join(
    roomId: string,
    email: string,
  ) {
    const user =
      await this.findUserByEmail(email);

    await this.ensureRoomExists(
      roomId,
    );

    /*
     * Joining must remain idempotent.
     *
     * If this user is already a member,
     * return the existing membership
     * instead of applying the room-capacity
     * check again.
     */
    const existingMembership =
      await this.databaseService.client.roomMembership.findUnique({
        where: {
          userId_roomId: {
            userId: user.id,
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

    const memberCount =
      await this.databaseService.client.roomMembership.count({
        where: {
          roomId,
        },
      });

    if (
      memberCount >=
      MAX_ROOM_CAPACITY
    ) {
      throw new ConflictException(
        'Room is full',
      );
    }

    return this.databaseService.client.roomMembership.create({
      data: {
        userId: user.id,
        roomId,
        role: RoomRole.MEMBER,
      },

      include: {
        user: true,
        room: true,
      },
    });
  }

  async leave(
    roomId: string,
    email: string,
  ) {
    const user =
      await this.findUserByEmail(email);

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

    /*
     * Owners cannot leave their membership
     * because Room.ownerId would then point
     * to a user who is no longer a member.
     *
     * Ownership transfer can be added later.
     */
    if (
      room.ownerId === user.id
    ) {
      throw new ForbiddenException(
        'Room owner cannot leave the room',
      );
    }

    const result =
      await this.databaseService.client.roomMembership.deleteMany({
        where: {
          userId: user.id,
          roomId,
        },
      });

    /*
     * deleteMany keeps leave idempotent.
     *
     * Calling leave again simply returns
     * left: false.
     */
    return {
      left:
        result.count > 0,
    };
  }

  async update(
    roomId: string,
    email: string,
    input: UpdateRoomDto,
  ) {
    const user =
      await this.findUserByEmail(email);

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
      room.ownerId !== user.id
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

  async remove(
    roomId: string,
    email: string,
  ) {
    const user =
      await this.findUserByEmail(email);

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
      room.ownerId !== user.id
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
    const memberCount =
      room.memberships.length;

    return {
      ...room,

      memberCount,

      capacity:
        MAX_ROOM_CAPACITY,

      isFull:
        memberCount >=
        MAX_ROOM_CAPACITY,
    };
  }

  private async findUserByEmail(
    email: string,
  ) {
    const user =
      await this.databaseService.client.user.findUnique({
        where: {
          email,
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
    const base = name
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