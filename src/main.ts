import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
var ip = require("ip");

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.API_PORT);
}

bootstrap();

console.log(ip.address(), process.env.API_PORT);