import { Module } from '@nestjs/common';
import { MessageWebSocket } from '../websockets/message.ws';

@Module({
  imports: [],
  controllers: [],
  providers: [MessageWebSocket],
  exports: [MessageWebSocket]
})

export class MessageWebSocketModule {}
