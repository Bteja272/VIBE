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
  AuthController,
} from './auth.controller';

import {
  AuthService,
} from './auth.service';

import {
  JwtAuthGuard,
} from './jwt-auth.guard';

import {
  InternalAuthGuard,
} from './internal-auth.guard';

import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ConfigModule,
    UsersModule,

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

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    JwtAuthGuard,
    InternalAuthGuard,
  ],

  exports: [
    JwtModule,
    JwtAuthGuard,
    AuthService,
  ],
})
export class AuthModule {}