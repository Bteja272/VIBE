import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import type { Request } from 'express';

import type {
  AuthUser,
  VibeJwtPayload,
} from './auth-user';

interface AuthenticatedRequest
  extends Request {
  user?: AuthUser;
}

@Injectable()
export class JwtAuthGuard
  implements CanActivate
{
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();

    const token =
      this.extractBearerToken(
        request,
      );

    if (!token) {
      throw new UnauthorizedException(
        'Missing authentication token',
      );
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<VibeJwtPayload>(
          token,
          {
            issuer: 'vibe-auth',
            audience: 'vibe-api',
          },
        );

      if (
        !payload.sub ||
        !payload.displayName ||
        !payload.type
      ) {
        throw new UnauthorizedException(
          'Invalid authentication token',
        );
      }

      if (
        payload.type !== 'GUEST' &&
        payload.type !==
          'REGISTERED'
      ) {
        throw new UnauthorizedException(
          'Invalid identity type',
        );
      }

      request.user = {
        id: payload.sub,
        displayName:
          payload.displayName,
        type: payload.type,

        email:
          payload.email,

        imageUrl:
          payload.imageUrl,
      };

      return true;
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }
  }

  private extractBearerToken(
    request: Request,
  ): string | undefined {
    const authorization =
      request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [type, token] =
      authorization.split(' ');

    if (
      type !== 'Bearer' ||
      !token
    ) {
      return undefined;
    }

    return token;
  }
}