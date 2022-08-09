import { Module } from '@nestjs/common';
import { SessionWebSocket } from '../websockets/session.ws';

@Module({
  imports: [],
  controllers: [],
  providers: [SessionWebSocket],
  exports: [SessionWebSocket]
})

export class SessionWebSocketModule {}
