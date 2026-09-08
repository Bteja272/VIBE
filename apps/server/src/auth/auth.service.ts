import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { randomUUID } from 'crypto';

import type { AuthUser, VibeJwtPayload } from './auth-user';

import { isVibeAvatarId } from './avatar';

import type { CreateRegisteredDto } from './dto/create-registered.dto';

import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,

    private readonly usersService: UsersService,
  ) {}

  async createGuest(displayName: string, avatarId: string) {
    if (!isVibeAvatarId(avatarId)) {
      throw new BadRequestException('Invalid VIBE avatar');
    }

    const guestId = `guest_${randomUUID()}`;

    const user: AuthUser = {
      id: guestId,

      displayName,

      type: 'GUEST',

      avatarId,
    };

    const token = await this.createToken(user, '12h');

    return {
      token,

      expiresIn: 43_200,

      profileCompleted: true,

      user,
    };
  }

  async createRegistered(input: CreateRegisteredDto) {
    const databaseUser = await this.usersService.upsertRegisteredUser({
      email: input.email,

      displayName: input.displayName,

      imageUrl: input.imageUrl,
    });

    const user: AuthUser = {
      id: databaseUser.id,

      displayName: databaseUser.displayName ?? input.displayName,

      type: 'REGISTERED',

      email: databaseUser.email,

      imageUrl: databaseUser.imageUrl ?? undefined,

      avatarId: databaseUser.avatarId ?? undefined,
    };

    const token = await this.createToken(user, '15m');

    return {
      token,

      expiresIn: 900,

      profileCompleted:
        databaseUser.profileCompleted && Boolean(databaseUser.avatarId),

      user,
    };
  }

  async updateRegisteredProfile(authUser: AuthUser, displayName: string) {
    if (authUser.type !== 'REGISTERED') {
      throw new ForbiddenException('Guest profiles are temporary');
    }

    const databaseUser = await this.usersService.updateDisplayName(
      authUser.id,
      displayName,
    );

    const user: AuthUser = {
      id: databaseUser.id,

      displayName: databaseUser.displayName ?? displayName,

      type: 'REGISTERED',

      email: databaseUser.email,

      imageUrl: databaseUser.imageUrl ?? undefined,

      avatarId: databaseUser.avatarId ?? undefined,
    };

    /*
     * Issue a fresh token because
     * displayName and avatarId are part
     * of the trusted JWT identity.
     */
    const token = await this.createToken(user, '15m');

    return {
      token,

      expiresIn: 900,

      profileCompleted:
  databaseUser.profileCompleted &&
  Boolean(
    databaseUser.avatarId,
  ),

      user,
    };
  }

  async updateRegisteredAvatar(authUser: AuthUser, avatarId: string) {
    if (authUser.type !== 'REGISTERED') {
      throw new ForbiddenException('Guest profiles are temporary');
    }

    if (!isVibeAvatarId(avatarId)) {
      throw new BadRequestException('Invalid VIBE avatar');
    }

    const databaseUser = await this.usersService.updateAvatarId(
      authUser.id,
      avatarId,
    );

    const user: AuthUser = {
      id: databaseUser.id,

      displayName: databaseUser.displayName ?? authUser.displayName,

      type: 'REGISTERED',

      email: databaseUser.email,

      imageUrl: databaseUser.imageUrl ?? undefined,

      avatarId: databaseUser.avatarId ?? undefined,
    };

    /*
     * Issue a fresh JWT because realtime
     * services derive avatar identity
     * from the verified token.
     */
    const token = await this.createToken(user, '15m');

    return {
      token,

      expiresIn: 900,

      profileCompleted: databaseUser.profileCompleted && Boolean(databaseUser.avatarId),

      user,
    };
  }

  getProfile(user: AuthUser) {
    return {
      authenticated: true,

      user,
    };
  }

  private async createToken(user: AuthUser, expiresIn: string) {
    const payload: Omit<VibeJwtPayload, 'sub'> = {
      displayName: user.displayName,

      type: user.type,

      email: user.email,

      imageUrl: user.imageUrl,

      avatarId: user.avatarId,
    };

    return this.jwtService.signAsync(payload, {
      subject: user.id,

      issuer: 'vibe-auth',

      audience: 'vibe-api',

      expiresIn: expiresIn as never,
    });
  }
}
