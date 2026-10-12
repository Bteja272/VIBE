import { BadRequestException } from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

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

import type { Server, Socket } from 'socket.io';

import type { AuthUser, VibeJwtPayload } from '../auth/auth-user';

import { ChatService } from './chat.service';

import {
  MusicService,
  type MusicPermission,
  type PlaybackAction,
} from './music.service';

import { PresenceService } from './presence.service';

import { randomUUID } from 'node:crypto';

interface RoomPayload {
  roomId: string;
}

interface EnterPresencePayload {
  roomId: string;

  presenceId: string;
}

interface PresenceSeatPayload {
  seatId: string;
}

interface ChatSendPayload {
  content: string;
}

interface MusicSetPayload {
  url: string;

  title?: string;
}

interface MusicPermissionPayload {
  permission: MusicPermission;
}

interface MusicPlaybackPayload {
  trackId: string;

  action: PlaybackAction;

  positionSeconds: number;
}

interface DmSendPayload {
  recipientUserId: string;

  content: string;
}

interface DirectMessage {
  id: string;

  roomId: string;

  senderUserId: string;

  senderDisplayName: string;

  senderIdentityType: 'GUEST' | 'REGISTERED';

  senderAvatarId?: string;

  recipientUserId: string;

  content: string;

  createdAt: string;
}

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
  },
})
export class RealtimeGateway
  implements OnGatewayInit<Server>, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,

    private readonly presenceService: PresenceService,

    private readonly chatService: ChatService,

    private readonly musicService: MusicService,
  ) {}

  afterInit(server: Server) {
    /*

     * Socket authentication is optional.

     *

     * Anonymous sockets may watch rooms.

     *

     * A provided JWT must be valid.

     */

    server.use(async (client, next) => {
      const token = client.handshake.auth?.token;

      if (typeof token !== 'string' || !token) {
        next();

        return;
      }

      try {
        const payload = await this.jwtService.verifyAsync<VibeJwtPayload>(
          token,

          {
            issuer: 'vibe-auth',

            audience: 'vibe-api',
          },
        );

        if (!payload.sub || !payload.displayName || !payload.type) {
          next(new Error('Invalid authentication token'));

          return;
        }

        if (payload.type !== 'GUEST' && payload.type !== 'REGISTERED') {
          next(new Error('Invalid identity type'));

          return;
        }

        const user: AuthUser = {
          id: payload.sub,

          displayName: payload.displayName,

          type: payload.type,

          email: payload.email,

          imageUrl: payload.imageUrl,

          avatarId: payload.avatarId,
        };

        client.data.user = user;

        next();
      } catch {
        next(new Error('Invalid or expired authentication token'));
      }
    });
  }

  handleConnection(client: Socket) {
    console.log(`Socket connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Socket disconnected: ${client.id}`);

    await this.removeFromPresence(client);
  }

  @SubscribeMessage('room:watch')
  async handleWatchRoom(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: RoomPayload,
  ) {
    const roomChannel = this.getRoomChannel(payload.roomId);

    await client.join(roomChannel);

    client.data.watchingRoomId = payload.roomId;

    await this.broadcastPresence(payload.roomId);

    await this.presenceService.removeStaleUsers(payload.roomId);

    return {
      watching: true,

      roomId: payload.roomId,
    };
  }

  @SubscribeMessage('presence:enter')
  async handleEnterPresence(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: EnterPresencePayload,
  ) {
    const user = client.data.user as AuthUser | undefined;

    if (!user) {
      return {
        entered: false,

        roomId: payload.roomId,

        error: 'Authentication required to enter the room',
      };
    }

    const roomChannel = this.getRoomChannel(payload.roomId);

    await client.join(roomChannel);

    const previousRoomId = client.data.roomId as string | undefined;

    const previousPresenceId = client.data.presenceId as string | undefined;

    if (
      previousRoomId &&
      previousPresenceId &&
      previousRoomId !== payload.roomId
    ) {
      await this.presenceService.removeUser(
        previousRoomId,

        previousPresenceId,

        client.id,
      );

      await this.broadcastPresence(previousRoomId);
    }

    const entered = await this.presenceService.addUser(payload.roomId, {
      presenceId: payload.presenceId,

      socketId: client.id,

      userId: user.id,

      displayName: user.displayName,

      identityType: user.type,

      email: user.email,

      avatarId: user.avatarId,
    });

    if (!entered) {
      return {
        entered: false,

        roomId: payload.roomId,

        error: 'Room is full',
      };
    }

    const seatId = await this.presenceService.ensureSeat(
      payload.roomId,

      payload.presenceId,

      client.id,
    );

    if (!seatId) {
      await this.presenceService.removeUser(
        payload.roomId,

        payload.presenceId,

        client.id,
      );

      return {
        entered: false,

        roomId: payload.roomId,

        error: 'Unable to assign a room seat',
      };
    }

    client.data.roomId = payload.roomId;

    client.data.presenceId = payload.presenceId;

    await this.broadcastPresence(payload.roomId);

    return {
      entered: true,

      roomId: payload.roomId,
    };
  }

  @SubscribeMessage('presence:seat')
  async handlePresenceSeat(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: PresenceSeatPayload,
  ) {
    const roomId = client.data.roomId as string | undefined;

    const presenceId = client.data.presenceId as string | undefined;

    if (!roomId || !presenceId) {
      return {
        moved: false,

        error: 'Join the room before choosing a seat',
      };
    }

    const seatId = payload?.seatId?.trim();

    if (!seatId) {
      return {
        moved: false,

        error: 'Seat is required',
      };
    }

    const result = await this.presenceService.moveSeat(
      roomId,

      presenceId,

      client.id,

      seatId,
    );

    if (!result.moved) {
      return result;
    }

    await this.broadcastPresence(roomId);

    return {
      moved: true,

      seatId,
    };
  }

  @SubscribeMessage('presence:heartbeat')
  async handlePresenceHeartbeat(
    @ConnectedSocket()
    client: Socket,
  ) {
    const roomId = client.data.roomId as string | undefined;

    const presenceId = client.data.presenceId as string | undefined;

    if (!roomId || !presenceId) {
      return {
        alive: false,
      };
    }

    const alive = await this.presenceService.heartbeat(
      roomId,

      presenceId,

      client.id,
    );

    /*

     * While an active participant is

     * heartbeating, also clean abandoned

     * participants in the same room.

     */

    const removed = await this.presenceService.removeStaleUsers(roomId);

    if (removed) {
      await this.broadcastPresence(roomId);
    }

    return {
      alive,

      roomId,
    };
  }

  @SubscribeMessage('presence:leave')
  async handleLeavePresence(
    @ConnectedSocket()
    client: Socket,
  ) {
    const roomId = client.data.roomId as string | undefined;

    if (!roomId) {
      return {
        left: false,
      };
    }

    await this.removeFromPresence(client);

    return {
      left: true,

      roomId,
    };
  }

  @SubscribeMessage('chat:history')
  async handleChatHistory(
    @ConnectedSocket()
    client: Socket,
  ) {
    const roomId = client.data.watchingRoomId as string | undefined;

    if (!roomId) {
      throw new BadRequestException('You are not watching a room');
    }

    const messages = await this.chatService.getHistory(roomId);

    return {
      roomId,

      messages,
    };
  }

  @SubscribeMessage('chat:send')
  async handleChatSend(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: ChatSendPayload,
  ) {
    const roomId = client.data.roomId as string | undefined;

    const presenceId = client.data.presenceId as string | undefined;

    const user = client.data.user as AuthUser | undefined;

    if (!roomId || !presenceId || !user) {
      return {
        sent: false,

        error: 'Join the room before sending messages',
      };
    }

    const present = await this.presenceService.isPresent(roomId, presenceId);

    if (!present) {
      return {
        sent: false,

        error: 'You are not currently present in this room',
      };
    }

    const content = payload?.content?.trim();

    if (!content) {
      return {
        sent: false,

        error: 'Message cannot be empty',
      };
    }

    if (content.length > 500) {
      return {
        sent: false,

        error: 'Message cannot exceed 500 characters',
      };
    }

    try {
      const message = await this.chatService.addMessage({
        roomId,

        presenceId,

        userId: user.id,

        displayName: user.displayName,

        identityType: user.type,

        email: user.email,

        avatarId: user.avatarId,

        content,
      });

      this.server.to(this.getRoomChannel(roomId)).emit('chat:message', message);

      return {
        sent: true,

        message,
      };
    } catch (error) {
      console.error('Failed to send chat message:', error);

      return {
        sent: false,

        error: 'Failed to send message',
      };
    }
  }

  @SubscribeMessage('dm:send')
  async handleDmSend(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: DmSendPayload,
  ) {
    const roomId = client.data.roomId as string | undefined;

    const presenceId = client.data.presenceId as string | undefined;

    const user = client.data.user as AuthUser | undefined;

    if (!roomId || !presenceId || !user) {
      return {
        sent: false,

        error: 'Join the room before sending direct messages',
      };
    }

    const senderPresent = await this.presenceService.isPresent(
      roomId,

      presenceId,
    );

    if (!senderPresent) {
      return {
        sent: false,

        error: 'You are not currently present in this room',
      };
    }

    const recipientUserId = payload?.recipientUserId?.trim();

    if (!recipientUserId) {
      return {
        sent: false,

        error: 'Recipient is required',
      };
    }

    if (recipientUserId === user.id) {
      return {
        sent: false,

        error: 'You cannot message yourself',
      };
    }

    const content = payload?.content?.trim();

    if (!content) {
      return {
        sent: false,

        error: 'Message cannot be empty',
      };
    }

    if (content.length > 500) {
      return {
        sent: false,

        error: 'Message cannot exceed 500 characters',
      };
    }

    /*

     * Clean abandoned presence records before

     * resolving the recipient.

     */

    const removed = await this.presenceService.removeStaleUsers(roomId);

    if (removed) {
      await this.broadcastPresence(roomId);
    }

    const recipient = await this.presenceService.getUserById(
      roomId,

      recipientUserId,
    );

    if (!recipient) {
      return {
        sent: false,

        error: 'That participant is no longer in the room',
      };
    }

    /*

     * Presence stores the socket that currently owns

     * this logical VIBE identity.

     *

     * Do not broadcast DMs to room:${roomId}.

     */

    const recipientSocket = this.server.sockets.sockets.get(recipient.socketId);

    if (!recipientSocket?.connected) {
      return {
        sent: false,

        error: 'That participant is no longer available',
      };
    }

    const message: DirectMessage = {
      id: randomUUID(),

      roomId,

      senderUserId: user.id,

      senderDisplayName: user.displayName,

      senderIdentityType: user.type,

      senderAvatarId: user.avatarId,

      recipientUserId: recipient.userId,

      content,

      createdAt: new Date().toISOString(),
    };

    /*

     * Send only to the two participants involved.

     *

     * Sender receives the same event as the recipient,

     * which lets the frontend use one message path

     * instead of separately appending acknowledgements.

     */

    this.server.to([client.id, recipient.socketId]).emit('dm:message', message);

    return {
      sent: true,

      message,
    };
  }

  @SubscribeMessage('music:get')
  async handleMusicGet(
    @ConnectedSocket()
    client: Socket,
  ) {
    const roomId = client.data.watchingRoomId as string | undefined;

    if (!roomId) {
      return {
        ok: false,

        error: 'You are not watching a room',
      };
    }

    const state = await this.musicService.getState(roomId);

    return {
      ok: true,

      state,
    };
  }

  @SubscribeMessage('music:set')
  async handleMusicSet(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: MusicSetPayload,
  ) {
    const roomId = client.data.roomId as string | undefined;

    const presenceId = client.data.presenceId as string | undefined;

    const user = client.data.user as AuthUser | undefined;

    if (!roomId || !presenceId || !user) {
      return {
        ok: false,

        error: 'Join the room before controlling music',
      };
    }

    const present = await this.presenceService.isPresent(roomId, presenceId);

    if (!present) {
      return {
        ok: false,

        error: 'Join the room before controlling music',
      };
    }

    try {
      const state = await this.musicService.setTrack({
        roomId,

        user,

        url: payload?.url ?? '',

        title: payload?.title,
      });

      this.server.to(this.getRoomChannel(roomId)).emit('music:update', state);

      return {
        ok: true,

        state,
      };
    } catch (error) {
      return {
        ok: false,

        error:
          error instanceof Error ? error.message : 'Unable to update music',
      };
    }
  }

  @SubscribeMessage('music:clear')
  async handleMusicClear(
    @ConnectedSocket()
    client: Socket,
  ) {
    const roomId = client.data.roomId as string | undefined;

    const presenceId = client.data.presenceId as string | undefined;

    const user = client.data.user as AuthUser | undefined;

    if (!roomId || !presenceId || !user) {
      return {
        ok: false,

        error: 'Join the room before controlling music',
      };
    }

    const present = await this.presenceService.isPresent(roomId, presenceId);

    if (!present) {
      return {
        ok: false,

        error: 'Join the room before controlling music',
      };
    }

    try {
      const state = await this.musicService.clearTrack(roomId, user);

      this.server.to(this.getRoomChannel(roomId)).emit('music:update', state);

      return {
        ok: true,

        state,
      };
    } catch (error) {
      return {
        ok: false,

        error: error instanceof Error ? error.message : 'Unable to clear music',
      };
    }
  }

  @SubscribeMessage('music:permission')
  async handleMusicPermission(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: MusicPermissionPayload,
  ) {
    const roomId = client.data.watchingRoomId as string | undefined;

    const user = client.data.user as AuthUser | undefined;

    if (!roomId || !user) {
      return {
        ok: false,

        error: 'Authentication required',
      };
    }

    try {
      const state = await this.musicService.setPermission(
        roomId,

        user,

        payload.permission,
      );

      this.server.to(this.getRoomChannel(roomId)).emit('music:update', state);

      return {
        ok: true,

        state,
      };
    } catch (error) {
      return {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Unable to update music permission',
      };
    }
  }

  @SubscribeMessage('music:playback')
  async handleMusicPlayback(
    @ConnectedSocket() client: Socket,

    @MessageBody() payload: MusicPlaybackPayload,
  ) {
    const roomId = client.data.roomId as string | undefined;

    const presenceId = client.data.presenceId as string | undefined;

    const user = client.data.user as AuthUser | undefined;

    if (!roomId || !presenceId || !user) {
      return {
        ok: false,

        error: 'Join the room before controlling playback',
      };
    }

    const present = await this.presenceService.isPresent(roomId, presenceId);

    if (!present) {
      return {
        ok: false,

        error: 'You are not currently present in this room',
      };
    }

    try {
      const state = await this.musicService.updatePlayback({
        roomId,

        user,

        trackId: payload?.trackId,

        action: payload?.action,

        positionSeconds: payload?.positionSeconds,
      });

      this.server.to(this.getRoomChannel(roomId)).emit('music:update', state);

      return {
        ok: true,

        state,
      };
    } catch (error) {
      return {
        ok: false,

        error:
          error instanceof Error ? error.message : 'Unable to update playback',
      };
    }
  }

  private async removeFromPresence(client: Socket) {
    const roomId = client.data.roomId as string | undefined;

    const presenceId = client.data.presenceId as string | undefined;

    if (!roomId || !presenceId) {
      return;
    }

    await this.presenceService.removeUser(roomId, presenceId, client.id);

    client.data.roomId = undefined;

    client.data.presenceId = undefined;

    await this.broadcastPresence(roomId);
  }

  private async broadcastPresence(roomId: string) {
    const users = await this.presenceService.getUsers(roomId);

    this.server.to(this.getRoomChannel(roomId)).emit('presence:update', {
      roomId,

      users,

      count: users.length,
    });
  }

  private getRoomChannel(roomId: string) {
    return `room:${roomId}`;
  }
}
