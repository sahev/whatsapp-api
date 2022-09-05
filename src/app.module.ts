import { Module } from '@nestjs/common';
import { SessionModule } from './infra/modules/session.module';
import { SessionWebSocketModule } from './infra/modules/session.ws.module';
import { WhatsAppModule } from './infra/modules/whatsapp.module';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationModule } from './infra/modules/configuration.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      envFilePath: `${process.cwd()}/src/infra/configuration/${process.env.NODE_ENV}.env`
    }), 
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: './src/infra/database/database.test.db',
      logging: true,
      synchronize: true,
      entities: [],
      migrationsTableName: 'migrations_table',
      migrations: [
        "./src/infra/database/migrations/**.ts"
      ]
    }),
    SessionWebSocketModule,  
    SessionModule, 
    WhatsAppModule,
    ConfigurationModule
  ],
})

export class AppModule {}
