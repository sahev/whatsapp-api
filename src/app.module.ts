import { Module } from '@nestjs/common';
import { SessionController } from './api/controllers/session.controller';
import { WhatsAppController } from './api/controllers/whatsapp.controller';
import { SessionService } from './business/services/session.service';
import { WhatsAppService } from './business/services/whatsapp.service';
import { SessionModule } from './infra/modules/session.module';
import { SessionWebSocketModule } from './infra/modules/session.ws.module';
import { WhatsAppModule } from './infra/modules/whatsapp.module';
import { SessionWebSocket } from './infra/websockets/session.ws';

@Module({
  imports: [SessionWebSocketModule,  SessionModule, WhatsAppModule],

})
export class AppModule {}
