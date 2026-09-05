import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';

import type {
  AuthUser,
} from './auth-user';

import {
  AuthService,
} from './auth.service';

import {
  CurrentUser,
} from './current-user.decorator';

import {
  JwtAuthGuard,
} from './jwt-auth.guard';

import {
  InternalAuthGuard,
} from './internal-auth.guard';

import {
  CreateGuestDto,
} from './dto/create-guest.dto';

import {
  CreateRegisteredDto,
} from './dto/create-registered.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService:
      AuthService,
  ) {}

  @Post('guest')
  createGuest(
    @Body()
    body: CreateGuestDto,
  ) {
    return this.authService.createGuest(
      body.displayName,
    );
  }

  @UseGuards(
    InternalAuthGuard,
  )
  @Post('registered')
  createRegistered(
    @Body()
    body: CreateRegisteredDto,
  ) {
    return this.authService.createRegistered(
      body,
    );
  }

  @UseGuards(
    JwtAuthGuard,
  )
  @Get('me')
  getMe(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.authService.getProfile(
      user,
    );
  }
}