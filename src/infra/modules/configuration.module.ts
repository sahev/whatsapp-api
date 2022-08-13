import { Module } from '@nestjs/common';
import { ConfigurationController } from 'src/api/controllers/configuration.controller';
import { ConfigurationService } from 'src/business/services/configuration.service';

@Module({
  imports: [],
  controllers: [ConfigurationController],
  providers: [ConfigurationService],
})
export class ConfigurationModule {}
