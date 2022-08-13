import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SessionService } from '../../business/services/session.service';

@Controller('session')
export class SessionController {
  constructor(
    private readonly sessionService: SessionService
  ) {}
  
  @Get('find/:id')
  find(@Param('id') id) {
    return this.sessionService.find(id)
  }

  @Get('status/:id')
  status(@Param('id') id) {
    return this.sessionService.status(id)
  }

  @Post('create')
  async  create(@Body() data: CreateSessionRequestDto) {    
    return await this.sessionService.add(data)
  }

  @Post('delete')
  async delete(@Body() data: DeleteSessionRequestDto) {    
    return await this.sessionService.delete(data)
  }
}
