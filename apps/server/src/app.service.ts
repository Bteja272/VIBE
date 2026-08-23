import { Injectable } from '@nestjs/common';

import { DatabaseService } from './database/database.service';

@Injectable()
export class AppService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  getHello(): string {
    return 'VIBE backend is running';
  }

  async getDatabaseHealth() {
    await this.databaseService.client.$queryRaw`
      SELECT 1
    `;

    return {
      database: 'connected',
    };
  }
}