import { Module } from '@nestjs/common';

import { ChatService } from './chat.service';
import { MusicService } from './music.service';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  providers: [
    ChatService,
    MusicService,
    PresenceService,
    RealtimeGateway,
  ],
})
export class RealtimeModule {}