import { Module } from '@nestjs/common';
import { SessionModule } from './infra/modules/session.module';
import { SessionWebSocketModule } from './infra/modules/session.ws.module';
import { WhatsAppModule } from './infra/modules/whatsapp.module';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationModule } from './infra/modules/configuration.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      envFilePath: `${process.cwd()}/src/infra/configuration/${process.env.NODE_ENV}.env`
    }),
    SessionWebSocketModule,  
    SessionModule, 
    WhatsAppModule,
    ConfigurationModule
  ],
})

export class AppModule {}
