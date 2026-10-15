import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
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
  providers: [AiService, AiUsageReportService],
})
export class AiModule {}
