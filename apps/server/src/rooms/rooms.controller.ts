import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

const DEFAULT_DEV_USER = 'dev@vibe.local';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
  ) {}

  @Post()
  createRoom(
    @Body() input: CreateRoomDto,
    @Headers('x-dev-user-email') email?: string,
  ) {
    return this.roomsService.createByDevUser(
      this.resolveDevEmail(email),
      input,
    );
  }

  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  /*
   * Put this route before /:id so the intent is explicit.
   */
  @Get('slug/:slug')
  findBySlug(
    @Param('slug') slug: string,
  ) {
    return this.roomsService.findBySlug(slug);
  }

  @Get(':id')
  findById(
    @Param('id') roomId: string,
  ) {
    return this.roomsService.findById(roomId);
  }

  @Post(':id/join')
  joinRoom(
    @Param('id') roomId: string,
    @Headers('x-dev-user-email') email?: string,
  ) {
    return this.roomsService.join(
      roomId,
      this.resolveDevEmail(email),
    );
  }

  @Delete(':id/leave')
  leaveRoom(
    @Param('id') roomId: string,
    @Headers('x-dev-user-email') email?: string,
  ) {
    return this.roomsService.leave(
      roomId,
      this.resolveDevEmail(email),
    );
  }

  @Patch(':id')
  updateRoom(
    @Param('id') roomId: string,
    @Body() input: UpdateRoomDto,
    @Headers('x-dev-user-email') email?: string,
  ) {
    return this.roomsService.update(
      roomId,
      this.resolveDevEmail(email),
      input,
    );
  }

  @Delete(':id')
  deleteRoom(
    @Param('id') roomId: string,
    @Headers('x-dev-user-email') email?: string,
  ) {
    return this.roomsService.remove(
      roomId,
      this.resolveDevEmail(email),
    );
  }

  private resolveDevEmail(email?: string): string {
    const normalized = email?.trim();

    return normalized || DEFAULT_DEV_USER;
  }
}