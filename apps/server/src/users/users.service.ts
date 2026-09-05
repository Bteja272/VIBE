import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

interface UpsertRegisteredUserInput {
  email: string;
  displayName: string;
  imageUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async findByEmail(email: string) {
    return this.databaseService.client.user.findUnique({
      where: {
        email,
      },
    });
  }

  async findById(id: string) {
    return this.databaseService.client.user.findUnique({
      where: {
        id,
      },
    });
  }

  async upsertRegisteredUser(
    input: UpsertRegisteredUserInput,
  ) {
    return this.databaseService.client.user.upsert({
      where: {
        email: input.email,
      },

      update: {
        displayName: input.displayName,
        imageUrl: input.imageUrl ?? null,
      },

      create: {
        email: input.email,
        displayName: input.displayName,
        imageUrl: input.imageUrl ?? null,
      },
    });
  }
}