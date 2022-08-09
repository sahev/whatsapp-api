import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SessionService } from '../../business/services/session.service';

@Controller()
export class SessionController {
  constructor(
    private readonly sessionService: SessionService
  ) {}
  
  @Get('find/:id')
  find(@Param('id') id) {
    console.log(id, 'find id');
    
    return this.sessionService.find(id)
  }

  @Post('create/')
  async  create(@Body() data: CreateRequestDto) {    
    return await this.sessionService.add(data)
  }
}
