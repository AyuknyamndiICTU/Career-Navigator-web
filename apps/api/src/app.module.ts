import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ProfileModule } from './profile/profile.module';
import { UploadModule } from './upload/upload.module';
import { ResumeModule } from './resume/resume.module';
import { JobsModule } from './jobs/jobs.module';
import { MentorsModule } from './mentors/mentors.module';
import { ConversationsModule } from './conversations/conversations.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiModule } from './ai/ai.module';
import { AdminModule } from './admin/admin.module';
import { VideoModule } from './video/video.module';
import { StorageModule } from './storage/storage.module';
import { CoursesModule } from './courses/courses.module';
import { HealthModule } from './health/health.module';
import { AiGatewayModule } from './ai/gateway/ai-gateway.module';
import { RequestContextMiddleware } from './logging/request-context.middleware';
import { AllExceptionsFilter } from './logging/all-exceptions.filter';
import { PublicConfigController } from './config/public-config.controller';

@Module({
  imports: [
    HealthModule,
    AiGatewayModule,
    AuthModule,
    ProfileModule,
    UploadModule,
    ResumeModule,
    JobsModule,
    MentorsModule,
    ConversationsModule,
    RealtimeModule,
    NotificationsModule,
    AiModule,
    AdminModule,
    VideoModule,
    StorageModule,
    CoursesModule,
  ],
  controllers: [AppController, PublicConfigController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*splat}');
  }
}
