import {
  BadRequestException,
} from '@nestjs/common';

import {
  JwtService,
} from '@nestjs/jwt';

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import type {
  Server,
  Socket,
} from 'socket.io';

import type {
  AuthUser,
  VibeJwtPayload,
} from '../auth/auth-user';

import {
  ChatService,
} from './chat.service';

import {
  MusicService,
  type MusicPermission,
} from './music.service';

import {
  PresenceService,
} from './presence.service';

interface RoomPayload {
  roomId: string;
}

interface EnterPresencePayload {
  roomId: string;
  presenceId: string;
}

interface ChatSendPayload {
  content: string;
}

interface MusicSetPayload {
  url: string;
  title?: string;
  provider?: string;
}

interface MusicPermissionPayload {
  permission:
    MusicPermission;
}

@WebSocketGateway({
  cors: {
    origin:
      'http://localhost:3000',
  },
})
export class RealtimeGateway
  implements
    OnGatewayInit<Server>,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService:
      JwtService,

    private readonly presenceService:
      PresenceService,

    private readonly chatService:
      ChatService,

    private readonly musicService:
      MusicService,
  ) {}

  afterInit(
    server: Server,
  ) {
    /*
     * Socket authentication is optional.
     *
     * Anonymous sockets may watch rooms.
     *
     * A provided JWT must be valid.
     */
    server.use(
      async (
        client,
        next,
      ) => {
        const token =
          client.handshake.auth?.token;

        if (
          typeof token !==
            'string' ||
          !token
        ) {
          next();
          return;
        }

        try {
          const payload =
            await this.jwtService.verifyAsync<VibeJwtPayload>(
              token,
              {
                issuer:
                  'vibe-auth',

                audience:
                  'vibe-api',
              },
            );

          if (
            !payload.sub ||
            !payload.displayName ||
            !payload.type
          ) {
            next(
              new Error(
                'Invalid authentication token',
              ),
            );

            return;
          }

          if (
            payload.type !==
              'GUEST' &&
            payload.type !==
              'REGISTERED'
          ) {
            next(
              new Error(
                'Invalid identity type',
              ),
            );

            return;
          }

          const user:
            AuthUser = {
              id:
                payload.sub,

              displayName:
                payload.displayName,

              type:
                payload.type,

              email:
                payload.email,

              imageUrl:
                payload.imageUrl,
            };

          client.data.user =
            user;

          next();
        } catch {
          next(
            new Error(
              'Invalid or expired authentication token',
            ),
          );
        }
      },
    );
  }

  handleConnection(
    client: Socket,
  ) {
    console.log(
      `Socket connected: ${client.id}`,
    );
  }

  async handleDisconnect(
    client: Socket,
  ) {
    console.log(
      `Socket disconnected: ${client.id}`,
    );

    await this.removeFromPresence(
      client,
    );
  }

  @SubscribeMessage(
    'room:watch',
  )
  async handleWatchRoom(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: RoomPayload,
  ) {
    const roomChannel =
      this.getRoomChannel(
        payload.roomId,
      );

    await client.join(
      roomChannel,
    );

    client.data.watchingRoomId =
      payload.roomId;

    await this.broadcastPresence(
      payload.roomId,
    );

    return {
      watching:
        true,

      roomId:
        payload.roomId,
    };
  }

  @SubscribeMessage(
    'presence:enter',
  )
  async handleEnterPresence(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload:
      EnterPresencePayload,
  ) {
    const user =
      client.data.user as
        | AuthUser
        | undefined;

    if (!user) {
      return {
        entered:
          false,

        roomId:
          payload.roomId,

        error:
          'Authentication required to enter the room',
      };
    }

    const roomChannel =
      this.getRoomChannel(
        payload.roomId,
      );

    await client.join(
      roomChannel,
    );

    const previousRoomId =
      client.data.roomId as
        | string
        | undefined;

    const previousPresenceId =
      client.data.presenceId as
        | string
        | undefined;

    if (
      previousRoomId &&
      previousPresenceId &&
      previousRoomId !==
        payload.roomId
    ) {
      await this.presenceService.removeUser(
        previousRoomId,
        previousPresenceId,
        client.id,
      );

      await this.broadcastPresence(
        previousRoomId,
      );
    }

    const entered =
      await this.presenceService.addUser(
        payload.roomId,
        {
          presenceId:
            payload.presenceId,

          socketId:
            client.id,

          userId:
            user.id,

          displayName:
            user.displayName,

          identityType:
            user.type,

          email:
            user.email,
        },
      );

    if (!entered) {
      return {
        entered:
          false,

        roomId:
          payload.roomId,

        error:
          'Room is full',
      };
    }

    client.data.roomId =
      payload.roomId;

    client.data.presenceId =
      payload.presenceId;

    await this.broadcastPresence(
      payload.roomId,
    );

    return {
      entered:
        true,

      roomId:
        payload.roomId,
    };
  }

  @SubscribeMessage(
    'presence:leave',
  )
  async handleLeavePresence(
    @ConnectedSocket()
    client: Socket,
  ) {
    const roomId =
      client.data.roomId as
        | string
        | undefined;

    if (!roomId) {
      return {
        left:
          false,
      };
    }

    await this.removeFromPresence(
      client,
    );

    return {
      left:
        true,

      roomId,
    };
  }

  @SubscribeMessage(
    'chat:history',
  )
  async handleChatHistory(
    @ConnectedSocket()
    client: Socket,
  ) {
    const roomId =
      client.data.watchingRoomId as
        | string
        | undefined;

    if (!roomId) {
      throw new BadRequestException(
        'You are not watching a room',
      );
    }

    const messages =
      await this.chatService.getHistory(
        roomId,
      );

    return {
      roomId,
      messages,
    };
  }

  @SubscribeMessage(
    'chat:send',
  )
  async handleChatSend(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload:
      ChatSendPayload,
  ) {
    const roomId =
      client.data.roomId as
        | string
        | undefined;

    const presenceId =
      client.data.presenceId as
        | string
        | undefined;

    const user =
      client.data.user as
        | AuthUser
        | undefined;

    if (
      !roomId ||
      !presenceId ||
      !user
    ) {
      return {
        sent:
          false,

        error:
          'Join the room before sending messages',
      };
    }

    const present =
      await this.presenceService.isPresent(
        roomId,
        presenceId,
      );

    if (!present) {
      return {
        sent:
          false,

        error:
          'You are not currently present in this room',
      };
    }

    const content =
      payload?.content?.trim();

    if (!content) {
      return {
        sent:
          false,

        error:
          'Message cannot be empty',
      };
    }

    if (
      content.length >
      500
    ) {
      return {
        sent:
          false,

        error:
          'Message cannot exceed 500 characters',
      };
    }

    try {
      const message =
        await this.chatService.addMessage({
          roomId,
          presenceId,

          userId:
            user.id,

          displayName:
            user.displayName,

          identityType:
            user.type,

          email:
            user.email,

          content,
        });

      this.server
        .to(
          this.getRoomChannel(
            roomId,
          ),
        )
        .emit(
          'chat:message',
          message,
        );

      return {
        sent:
          true,

        message,
      };
    } catch (
      error
    ) {
      console.error(
        'Failed to send chat message:',
        error,
      );

      return {
        sent:
          false,

        error:
          'Failed to send message',
      };
    }
  }

  @SubscribeMessage(
    'music:get',
  )
  async handleMusicGet(
    @ConnectedSocket()
    client: Socket,
  ) {
    const roomId =
      client.data.watchingRoomId as
        | string
        | undefined;

    if (!roomId) {
      return {
        ok:
          false,

        error:
          'You are not watching a room',
      };
    }

    const state =
      await this.musicService.getState(
        roomId,
      );

    return {
      ok:
        true,

      state,
    };
  }

  @SubscribeMessage(
    'music:set',
  )
  async handleMusicSet(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload:
      MusicSetPayload,
  ) {
    const roomId =
      client.data.roomId as
        | string
        | undefined;

    const presenceId =
      client.data.presenceId as
        | string
        | undefined;

    const user =
      client.data.user as
        | AuthUser
        | undefined;

    if (
      !roomId ||
      !presenceId ||
      !user
    ) {
      return {
        ok:
          false,

        error:
          'Join the room before controlling music',
      };
    }

    const present =
      await this.presenceService.isPresent(
        roomId,
        presenceId,
      );

    if (!present) {
      return {
        ok:
          false,

        error:
          'Join the room before controlling music',
      };
    }

    try {
      const state =
        await this.musicService.setTrack({
          roomId,
          user,

          url:
            payload?.url ??
            '',

          title:
            payload?.title,

          provider:
            payload?.provider,
        });

      this.server
        .to(
          this.getRoomChannel(
            roomId,
          ),
        )
        .emit(
          'music:update',
          state,
        );

      return {
        ok:
          true,

        state,
      };
    } catch (
      error
    ) {
      return {
        ok:
          false,

        error:
          error instanceof
            Error
            ? error.message
            : 'Unable to update music',
      };
    }
  }

  @SubscribeMessage(
    'music:clear',
  )
  async handleMusicClear(
    @ConnectedSocket()
    client: Socket,
  ) {
    const roomId =
      client.data.roomId as
        | string
        | undefined;

    const presenceId =
      client.data.presenceId as
        | string
        | undefined;

    const user =
      client.data.user as
        | AuthUser
        | undefined;

    if (
      !roomId ||
      !presenceId ||
      !user
    ) {
      return {
        ok:
          false,

        error:
          'Join the room before controlling music',
      };
    }

    const present =
      await this.presenceService.isPresent(
        roomId,
        presenceId,
      );

    if (!present) {
      return {
        ok:
          false,

        error:
          'Join the room before controlling music',
      };
    }

    try {
      const state =
        await this.musicService.clearTrack(
          roomId,
          user,
        );

      this.server
        .to(
          this.getRoomChannel(
            roomId,
          ),
        )
        .emit(
          'music:update',
          state,
        );

      return {
        ok:
          true,

        state,
      };
    } catch (
      error
    ) {
      return {
        ok:
          false,

        error:
          error instanceof
            Error
            ? error.message
            : 'Unable to clear music',
      };
    }
  }

  @SubscribeMessage(
    'music:permission',
  )
  async handleMusicPermission(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload:
      MusicPermissionPayload,
  ) {
    const roomId =
      client.data.watchingRoomId as
        | string
        | undefined;

    const user =
      client.data.user as
        | AuthUser
        | undefined;

    if (
      !roomId ||
      !user
    ) {
      return {
        ok:
          false,

        error:
          'Authentication required',
      };
    }

    try {
      const state =
        await this.musicService.setPermission(
          roomId,
          user,
          payload.permission,
        );

      this.server
        .to(
          this.getRoomChannel(
            roomId,
          ),
        )
        .emit(
          'music:update',
          state,
        );

      return {
        ok:
          true,

        state,
      };
    } catch (
      error
    ) {
      return {
        ok:
          false,

        error:
          error instanceof
            Error
            ? error.message
            : 'Unable to update music permission',
      };
    }
  }

  private async removeFromPresence(
    client: Socket,
  ) {
    const roomId =
      client.data.roomId as
        | string
        | undefined;

    const presenceId =
      client.data.presenceId as
        | string
        | undefined;

    if (
      !roomId ||
      !presenceId
    ) {
      return;
    }

    await this.presenceService.removeUser(
      roomId,
      presenceId,
      client.id,
    );

    client.data.roomId =
      undefined;

    client.data.presenceId =
      undefined;

    await this.broadcastPresence(
      roomId,
    );
  }

  private async broadcastPresence(
    roomId: string,
  ) {
    const users =
      await this.presenceService.getUsers(
        roomId,
      );

    this.server
      .to(
        this.getRoomChannel(
          roomId,
        ),
      )
      .emit(
        'presence:update',
        {
          roomId,
          users,

          count:
            users.length,
        },
      );
  }

  private getRoomChannel(
    roomId: string,
  ) {
    return `room:${roomId}`;
  }
}