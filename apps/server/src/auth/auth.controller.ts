import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';

import type { AuthUser } from './auth-user';

import { AuthService } from './auth.service';

import { CurrentUser } from './current-user.decorator';

import { JwtAuthGuard } from './jwt-auth.guard';

import { InternalAuthGuard } from './internal-auth.guard';

import { CreateGuestDto } from './dto/create-guest.dto';

import { CreateRegisteredDto } from './dto/create-registered.dto';

import { UpdateProfileDto } from './dto/update-profile.dto';

import { UpdateAvatarDto } from './dto/update-avatar.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('guest')
  createGuest(
    @Body()
    body: CreateGuestDto,
  ) {
    return this.authService.createGuest(body.displayName, body.avatarId);
  }

  @UseGuards(InternalAuthGuard)
  @Post('registered')
  createRegistered(
    @Body()
    body: CreateRegisteredDto,
  ) {
    return this.authService.createRegistered(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.authService.getProfile(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(
    @CurrentUser()
    user: AuthUser,

    @Body()
    body: UpdateProfileDto,
  ) {
    return this.authService.updateRegisteredProfile(user, body.displayName);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('avatar')
  updateAvatar(
    @CurrentUser()
    user: AuthUser,

    @Body()
    body: UpdateAvatarDto,
  ) {
    return this.authService.updateRegisteredAvatar(user, body.avatarId);
  }
}
