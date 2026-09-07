import {
  Module,
} from '@nestjs/common';

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import {
  JwtModule,
} from '@nestjs/jwt';

import {
  ChatService,
} from './chat.service';

import {
  MusicService,
} from './music.service';

import {
  PresenceService,
} from './presence.service';

import {
  RealtimeGateway,
} from './realtime.gateway';

@Module({
  imports: [
    ConfigModule,

    JwtModule.registerAsync({
      imports: [
        ConfigModule,
      ],

      inject: [
        ConfigService,
      ],

      useFactory: (
        configService:
          ConfigService,
      ) => {
        const secret =
          configService.get<string>(
            'BACKEND_JWT_SECRET',
          );

        if (!secret) {
          throw new Error(
            'BACKEND_JWT_SECRET is not configured',
          );
        }

        return {
          secret,
        };
      },
    }),
  ],

  providers: [
    ChatService,
    MusicService,
    PresenceService,
    RealtimeGateway,
  ],
})
export class RealtimeModule {}