import { Body, Controller, Get, Post } from '@nestjs/common';
import { WhatsAppService } from '../../business/services/whatsapp.service';

@Controller('chat')
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Post('send')
  sendMessage(@Body() data : SendMessageDTO)  {
    const session = this.whatsAppService.getSession(data.sessionId)
    const receiver = this.whatsAppService.formatPhone(data.receiver)
    const message = data.message;

    return this.whatsAppService.sendMessage(session, receiver, message, data.delayMs)
  }
}
