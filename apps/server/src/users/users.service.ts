import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async findById(userId: string) {
    const user = await this.databaseService.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.databaseService.client.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}