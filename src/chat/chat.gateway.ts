import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Клієнт підключився до WS: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Клієнт відключився від WS: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody('room') room: string,
  ) {
    client.join(room);
    client.to(room).emit('roomMessage', {
      sender: 'System',
      message: `Користувач ${client.id} увійшов до кімнати.`,
      timestamp: new Date().toISOString(),
    });
    return { status: 'success', joinedRoom: room };
  }

  @SubscribeMessage('sendMessage')
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { room: string; message: string },
  ) {
    this.server.to(payload.room).emit('roomMessage', {
      sender: client.id,
      message: payload.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Метод для виклику з REST контролерів з метою моніторингу
  getGatewayMetrics() {
    return {
      connectedClientsCount: this.server?.engine?.clientsCount || 0,
      adapterType: 'RedisIoAdapter',
    };
  }
}
