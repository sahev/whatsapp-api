import { Controller, Get } from '@nestjs/common';
import { WhatsAppService } from '../../business/services/whatsapp.service';

@Controller()
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

}
