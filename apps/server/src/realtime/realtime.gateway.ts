import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import type { Server, Socket } from 'socket.io';

import {
  PresenceService,
} from './presence.service';

interface RoomPayload {
  roomId: string;
}

interface EnterPresencePayload {
  roomId: string;
  userEmail: string;
}

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
  },
})
export class RealtimeGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly presenceService:
      PresenceService,
  ) {}

  handleConnection(client: Socket) {
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

  /*
   * User opened the room page.
   *
   * They receive realtime updates,
   * but they are NOT counted as present.
   */
  @SubscribeMessage('room:watch')
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

    await client.join(roomChannel);

    client.data.watchingRoomId =
      payload.roomId;

    await this.broadcastPresence(
      payload.roomId,
    );

    return {
      watching: true,
      roomId: payload.roomId,
    };
  }

  /*
   * User explicitly joins the room.
   */
  @SubscribeMessage('presence:enter')
  async handleEnterPresence(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: EnterPresencePayload,
  ) {
    const roomChannel =
      this.getRoomChannel(
        payload.roomId,
      );

    await client.join(roomChannel);

    /*
     * If this socket was somehow present
     * in a different room first, clean it up.
     */
    const previousRoomId =
      client.data.roomId as
        | string
        | undefined;

    if (
      previousRoomId &&
      previousRoomId !== payload.roomId
    ) {
      await this.presenceService.removeUser(
        previousRoomId,
        client.id,
      );

      await this.broadcastPresence(
        previousRoomId,
      );
    }

    client.data.roomId =
      payload.roomId;

    client.data.userEmail =
      payload.userEmail;

    await this.presenceService.addUser(
      payload.roomId,
      {
        socketId: client.id,
        userEmail:
          payload.userEmail,
      },
    );

    await this.broadcastPresence(
      payload.roomId,
    );

    return {
      entered: true,
      roomId: payload.roomId,
    };
  }

  /*
   * User explicitly leaves live presence.
   */
  @SubscribeMessage('presence:leave')
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
        left: false,
      };
    }

    await this.removeFromPresence(
      client,
    );

    return {
      left: true,
      roomId,
    };
  }

  private async removeFromPresence(
    client: Socket,
  ) {
    const roomId =
      client.data.roomId as
        | string
        | undefined;

    if (!roomId) {
      return;
    }

    await this.presenceService.removeUser(
      roomId,
      client.id,
    );

    client.data.roomId =
      undefined;

    client.data.userEmail =
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
        this.getRoomChannel(roomId),
      )
      .emit('presence:update', {
        roomId,
        users,
        count: users.length,
      });
  }

  private getRoomChannel(
    roomId: string,
  ) {
    return `room:${roomId}`;
  }
}