import { Controller, Get } from '@nestjs/common';
import { ConfigurationService } from 'src/business/services/configuration.service';

@Controller('configuration')
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}
    @Get('env') 
    GetEnvConfiguration() {
      return this.configurationService.GetEnvConfiguration()
    }
}
