import { Global, Module } from '@nestjs/common';
import { MessagingGateway } from './messaging.gateway';

@Global()
@Module({
  providers: [MessagingGateway],
  exports: [MessagingGateway],
})
export class RealtimeModule {}
