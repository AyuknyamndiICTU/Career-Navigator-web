import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { UploadModule } from './upload/upload.module';
import { ResumeModule } from './resume/resume.module';
import { JobsModule } from './jobs/jobs.module';
import { MentorsModule } from './mentors/mentors.module';
import { ConversationsModule } from './conversations/conversations.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    AuthModule,
    ProfileModule,
    UploadModule,
    ResumeModule,
    JobsModule,
    MentorsModule,
    ConversationsModule,
    RealtimeModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
