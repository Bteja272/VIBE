import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { randomUUID } from 'crypto';

import type {
  AuthUser,
  VibeJwtPayload,
} from './auth-user';

import type {
  CreateRegisteredDto,
} from './dto/create-registered.dto';

import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async createGuest(
    displayName: string,
  ) {
    const guestId =
      `guest_${randomUUID()}`;

    const user: AuthUser = {
      id: guestId,
      displayName,
      type: 'GUEST',
    };

    const token =
      await this.createToken(
        user,
        '12h',
      );

    return {
      token,
      expiresIn: 43_200,
      user,
    };
  }

  async createRegistered(
    input: CreateRegisteredDto,
  ) {
    const databaseUser =
      await this.usersService.upsertRegisteredUser({
        email: input.email,
        displayName: input.displayName,
        imageUrl: input.imageUrl,
      });

    const user: AuthUser = {
      id: databaseUser.id,
      displayName:
        databaseUser.displayName ??
        input.displayName,

      type: 'REGISTERED',

      email: databaseUser.email,

      imageUrl:
        databaseUser.imageUrl ??
        undefined,
    };

    const token =
      await this.createToken(
        user,
        '15m',
      );

    return {
      token,
      expiresIn: 900,
      user,
    };
  }

  getProfile(
    user: AuthUser,
  ) {
    return {
      authenticated: true,
      user,
    };
  }

  private async createToken(
    user: AuthUser,
    expiresIn: string,
  ) {
    const payload: Omit<
      VibeJwtPayload,
      'sub'
    > = {
      displayName:
        user.displayName,

      type:
        user.type,

      email:
        user.email,

      imageUrl:
        user.imageUrl,
    };

    return this.jwtService.signAsync(
      payload,
      {
        subject: user.id,
        issuer: 'vibe-auth',
        audience: 'vibe-api',
        expiresIn:
          expiresIn as never,
      },
    );
  }
}