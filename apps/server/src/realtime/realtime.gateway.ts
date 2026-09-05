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

interface JoinRoomPayload {
  roomId: string;
  userEmail: string;
}

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const roomChannel = `room:${payload.roomId}`;

    await client.join(roomChannel);

    client.data.roomId = payload.roomId;
    client.data.userEmail = payload.userEmail;

    this.server.to(roomChannel).emit('presence:joined', {
      socketId: client.id,
      roomId: payload.roomId,
      userEmail: payload.userEmail,
    });

    return {
      joined: true,
      roomId: payload.roomId,
    };
  }
}