import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Request } from 'express';

@Injectable()
export class InternalAuthGuard
  implements CanActivate
{
  constructor(
    private readonly configService: ConfigService,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const request =
      context
        .switchToHttp()
        .getRequest<Request>();

    const expectedSecret =
      this.configService.get<string>(
        'VIBE_INTERNAL_SECRET',
      );

    if (!expectedSecret) {
      throw new Error(
        'VIBE_INTERNAL_SECRET is not configured',
      );
    }

    const providedSecret =
      request.headers[
        'x-vibe-internal-secret'
      ];

    if (
      typeof providedSecret !== 'string' ||
      providedSecret !== expectedSecret
    ) {
      throw new UnauthorizedException(
        'Invalid internal credentials',
      );
    }

    return true;
  }
}