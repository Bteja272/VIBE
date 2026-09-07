import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import type {
  AuthUser,
} from '../auth/auth-user';

import {
  CurrentUser,
} from '../auth/current-user.decorator';

import {
  JwtAuthGuard,
} from '../auth/jwt-auth.guard';

import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService:
      RoomsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createRoom(
    @Body()
    input: CreateRoomDto,

    @CurrentUser()
    user: AuthUser,
  ) {
    this.ensureRegisteredUser(user);

    return this.roomsService.create(
      user.id,
      input,
    );
  }

  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  @Get('slug/:slug')
  findBySlug(
    @Param('slug')
    slug: string,
  ) {
    return this.roomsService.findBySlug(
      slug,
    );
  }

  @Get(':id')
  findById(
    @Param('id')
    roomId: string,
  ) {
    return this.roomsService.findById(
      roomId,
    );
  }

  /*
   * Registered users get persistent
   * RoomMembership rows.
   *
   * Guests do not call this endpoint.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  joinRoom(
    @Param('id')
    roomId: string,

    @CurrentUser()
    user: AuthUser,
  ) {
    this.ensureRegisteredUser(user);

    return this.roomsService.joinByUserId(
      roomId,
      user.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/leave')
  leaveRoom(
    @Param('id')
    roomId: string,

    @CurrentUser()
    user: AuthUser,
  ) {
    this.ensureRegisteredUser(user);

    return this.roomsService.leaveByUserId(
      roomId,
      user.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateRoom(
    @Param('id')
    roomId: string,

    @Body()
    input: UpdateRoomDto,

    @CurrentUser()
    user: AuthUser,
  ) {
    this.ensureRegisteredUser(user);

    return this.roomsService.updateByUserId(
      roomId,
      user.id,
      input,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteRoom(
    @Param('id')
    roomId: string,

    @CurrentUser()
    user: AuthUser,
  ) {
    this.ensureRegisteredUser(user);

    return this.roomsService.removeByUserId(
      roomId,
      user.id,
    );
  }

  private ensureRegisteredUser(
    user: AuthUser,
  ) {
    if (
      user.type !==
      'REGISTERED'
    ) {
      throw new ForbiddenException(
        'This operation requires a registered account',
      );
    }
  }
}