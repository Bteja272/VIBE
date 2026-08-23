import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { CreateRoomDto } from './dto/create-room.dto';
import { RoomsService } from './rooms.service';

const DEV_USER_EMAIL = 'dev@vibe.local';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
  ) {}

  @Post()
  createRoom(
    @Body() input: CreateRoomDto,
  ) {
    return this.roomsService.createByDevUser(
      DEV_USER_EMAIL,
      input,
    );
  }

  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  @Get(':id')
  findById(
    @Param('id') roomId: string,
  ) {
    return this.roomsService.findById(roomId);
  }
}