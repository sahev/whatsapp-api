import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { WhatsAppController } from 'src/api/controllers/whatsapp.controller';
import { WhatsAppService } from '../../business/services/whatsapp.service';
import { MessageWebSocket } from '../websockets/message.ws';
import { SessionWebSocket } from '../websockets/session.ws';

@Module({
  imports: [HttpModule, SessionWebSocket, MessageWebSocket],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, SessionWebSocket, MessageWebSocket],
})
export class WhatsAppModule {}
