import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SessionController } from 'src/api/controllers/session.controller';
import { SessionService } from 'src/business/services/session.service';
import { WhatsAppService } from '../../business/services/whatsapp.service';
import { MessageWebSocket } from '../websockets/message.ws';
import { SessionWebSocket } from '../websockets/session.ws';
import { WhatsAppModule } from './whatsapp.module';

@Module({
  imports: [HttpModule, WhatsAppModule],
  controllers: [SessionController],
  providers: [WhatsAppService, SessionWebSocket, SessionService, MessageWebSocket],
})
export class SessionModule {}
