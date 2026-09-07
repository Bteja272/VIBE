import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

interface UpsertRegisteredUserInput {
  email: string;
  displayName: string;
  imageUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly databaseService:
      DatabaseService,
  ) {}

  async findByEmail(
    email: string,
  ) {
    return this.databaseService.client.user.findUnique({
      where: {
        email,
      },
    });
  }

  async findById(
    id: string,
  ) {
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
        email:
          input.email,
      },

      /*
       * Do not overwrite displayName here.
       *
       * Once a user chooses a VIBE name,
       * Google login should not replace it.
       */
      update: {
        imageUrl:
          input.imageUrl ??
          null,
      },

      create: {
        email:
          input.email,

        /*
         * Google name is only an initial
         * fallback until onboarding is done.
         */
        displayName:
          input.displayName,

        imageUrl:
          input.imageUrl ??
          null,

        profileCompleted:
          false,
      },
    });
  }

  async updateDisplayName(
    userId: string,
    displayName: string,
  ) {
    const existing =
      await this.findById(
        userId,
      );

    if (!existing) {
      throw new NotFoundException(
        'User not found',
      );
    }

    return this.databaseService.client.user.update({
      where: {
        id:
          userId,
      },

      data: {
        displayName:
          displayName.trim(),

        profileCompleted:
          true,
      },
    });
  }
}