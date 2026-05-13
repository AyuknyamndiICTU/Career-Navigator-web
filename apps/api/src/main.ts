import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    app.useWebSocketAdapter(new RedisIoAdapter(app, redisUrl));
  }

  const config = new DocumentBuilder()
    .setTitle('Career Navigator API')
    .setDescription('Career Navigator REST API documentation')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
