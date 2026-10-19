import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { CareerSkillsService } from './career-skills.service';
import { ChatService } from './chat.service';
import { InterviewService } from './interview.service';
import { CourseRecsService } from './course-recs.service';
import { AiSettingsController } from './byok/ai-settings.controller';
import {
  AdminAiController,
  AiHealthController,
} from './byok/admin-ai.controller';
import { AiUsageReportService } from './byok/ai-usage-report.service';

@Module({
  controllers: [
    AiController,
    AiSettingsController,
    AdminAiController,
    AiHealthController,
  ],
  providers: [
    CareerSkillsService,
    ChatService,
    InterviewService,
    CourseRecsService,
    AiUsageReportService,
  ],
})
export class AiModule {}
