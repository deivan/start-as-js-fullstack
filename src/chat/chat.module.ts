import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';

@Module({
  controllers: [ChatController],
  providers: [ChatGateway],
  // Експортуємо шлюз, якщо його метрики знадобляться в інших системних модулях
  exports: [ChatGateway] 
})
export class ChatModule {}
