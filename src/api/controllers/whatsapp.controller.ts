import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { WhatsAppService } from '../../business/services/whatsapp.service';

@Controller('chat')
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Post('send')
  sendMessage(@Body() data : SendMessageDTO)  {
    const session = this.whatsAppService.getSession(data.sessionId)
    const receiver = this.whatsAppService.formatPhone(data.receiver)
    const message = data.message;

    return this.whatsAppService.sendMessage(data.sessionId, session, receiver, message, data.delayMs)
  }

  @Get('find/:id')
  find(@Param('id') id) {
    return this.whatsAppService.isSessionExists(id)
  }

  @Get('status/:id')
  status(@Param('id') id) {
    return this.whatsAppService.status(id)
  }
}
