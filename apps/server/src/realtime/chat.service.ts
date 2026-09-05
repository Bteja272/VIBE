import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { randomUUID } from 'crypto';

export interface ChatMessage {
  id: string;
  roomId: string;
  presenceId: string;
  userEmail: string;
  content: string;
  createdAt: string;
}

@Injectable()
export class ChatService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly redis;

  private static readonly MAX_MESSAGES = 50;
  private static readonly MESSAGE_TTL_SECONDS =
    60 * 60 * 24;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ??
      'redis://localhost:6379';

    this.redis = createClient({
      url: redisUrl,
    });

    this.redis.on('error', (error) => {
      console.error(
        'Redis chat error:',
        error,
      );
    });
  }

  async onModuleInit() {
    await this.redis.connect();

    console.log(
      'Redis chat service connected',
    );
  }

  async onModuleDestroy() {
    if (this.redis.isOpen) {
      await this.redis.quit();
    }
  }

  async addMessage(input: {
    roomId: string;
    presenceId: string;
    userEmail: string;
    content: string;
  }): Promise<ChatMessage> {
    const content =
      input.content.trim();

    if (!content) {
      throw new BadRequestException(
        'Message cannot be empty',
      );
    }

    if (content.length > 500) {
      throw new BadRequestException(
        'Message cannot exceed 500 characters',
      );
    }

    const message: ChatMessage = {
      id: randomUUID(),

      roomId:
        input.roomId,

      presenceId:
        input.presenceId,

      userEmail:
        input.userEmail,

      content,

      createdAt:
        new Date().toISOString(),
    };

    const key =
      this.getChatKey(
        input.roomId,
      );

    await this.redis.rPush(
      key,
      JSON.stringify(message),
    );

    /*
     * Keep only the newest 50 messages.
     */
    await this.redis.lTrim(
      key,
      -ChatService.MAX_MESSAGES,
      -1,
    );

    /*
     * Chat is intentionally temporary for now.
     */
    await this.redis.expire(
      key,
      ChatService.MESSAGE_TTL_SECONDS,
    );

    return message;
  }

  async getHistory(
    roomId: string,
  ): Promise<ChatMessage[]> {
    const key =
      this.getChatKey(roomId);

    const values =
      await this.redis.lRange(
        key,
        0,
        -1,
      );

    return values
      .map((value) => {
        try {
          return JSON.parse(
            value,
          ) as ChatMessage;
        } catch {
          return null;
        }
      })
      .filter(
        (
          message,
        ): message is ChatMessage =>
          message !== null,
      );
  }

  private getChatKey(
    roomId: string,
  ) {
    return `vibe:chat:${roomId}`;
  }
}