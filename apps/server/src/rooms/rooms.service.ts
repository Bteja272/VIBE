import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  RoomRole,
  RoomVisibility,
} from '@vibe/database';

import { DatabaseService } from '../database/database.service';
import { CreateRoomDto } from './dto/create-room.dto';

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
      await this.databaseService.client.user.findUnique({
        where: { email },
      });

    if (!user) {
      throw new NotFoundException(
        'Development user not found',
      );
    }

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
        memberships: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(roomId: string) {
    const room =
      await this.databaseService.client.room.findUnique({
        where: { id: roomId },
        include: {
          owner: true,
          memberships: true,
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