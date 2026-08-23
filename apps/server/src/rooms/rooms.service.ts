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

@Injectable()
export class RoomsService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async createByDevUser(
    email: string,
    input: CreateRoomDto,
  ) {
    const user = await this.findUserByEmail(email);

    return this.create(user.id, input);
  }

  async create(
    ownerId: string,
    input: CreateRoomDto,
  ) {
    const slug = this.createSlug(input.name);

    return this.databaseService.client.room.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        visibility:
          input.visibility ?? RoomVisibility.PRIVATE,
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
        memberships: true,
      },
    });
  }

  async findAll() {
    return this.databaseService.client.room.findMany({
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
  }

  async findById(roomId: string) {
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
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  async findBySlug(slug: string) {
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
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  async join(
    roomId: string,
    email: string,
  ) {
    const user = await this.findUserByEmail(email);

    await this.ensureRoomExists(roomId);

    /*
     * Upsert makes joining idempotent.
     *
     * If the membership already exists, Prisma simply
     * returns it instead of creating a duplicate.
     */
    return this.databaseService.client.roomMembership.upsert({
      where: {
        userId_roomId: {
          userId: user.id,
          roomId,
        },
      },

      update: {},

      create: {
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
    const user = await this.findUserByEmail(email);

    const room =
      await this.databaseService.client.room.findUnique({
        where: {
          id: roomId,
        },
      });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    /*
     * Owners cannot simply leave because that would create
     * a room with an ownerId pointing to someone who is no
     * longer a room member.
     *
     * Later we could add ownership transfer.
     */
    if (room.ownerId === user.id) {
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
     * deleteMany makes leave idempotent.
     *
     * Calling leave twice does not crash:
     * second call simply reports left = false.
     */
    return {
      left: result.count > 0,
    };
  }

  async update(
    roomId: string,
    email: string,
    input: UpdateRoomDto,
  ) {
    const user = await this.findUserByEmail(email);

    const room =
      await this.databaseService.client.room.findUnique({
        where: {
          id: roomId,
        },
      });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.ownerId !== user.id) {
      throw new ForbiddenException(
        'Only the room owner can update this room',
      );
    }

    return this.databaseService.client.room.update({
      where: {
        id: roomId,
      },

      data: {
        name: input.name,
        description: input.description,
        visibility: input.visibility,
      },

      include: {
        owner: true,
        memberships: true,
      },
    });
  }

  async remove(
    roomId: string,
    email: string,
  ) {
    const user = await this.findUserByEmail(email);

    const room =
      await this.databaseService.client.room.findUnique({
        where: {
          id: roomId,
        },
      });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.ownerId !== user.id) {
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

  private async findUserByEmail(email: string) {
    const user =
      await this.databaseService.client.user.findUnique({
        where: {
          email,
        },
      });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async ensureRoomExists(roomId: string) {
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
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  private createSlug(name: string): string {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${base}-${Date.now()}`;
  }
}