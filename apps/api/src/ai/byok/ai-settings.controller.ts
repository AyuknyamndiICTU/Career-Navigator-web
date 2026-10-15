import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/jwt-auth.guard';
import { AiCredentialsService } from './ai-credentials.service';
import { AiUsageReportService } from './ai-usage-report.service';
import {
  CreateAiCredentialDto,
  UpdateAiCredentialDto,
  UpdateAiPreferencesDto,
  UsageQueryDto,
} from './dto/ai-credential.dto';

/** Settings → AI providers: own keys, per-feature models and usage. Keys are never returned. */
@ApiTags('ai')
@Controller('ai')
export class AiSettingsController {
  constructor(
    private readonly credentials: AiCredentialsService,
    private readonly reports: AiUsageReportService,
  ) {}

  @Get('providers')
  providers() {
    return this.reports.providers();
  }

  @Get('credentials')
  listCredentials(@CurrentUser('sub') userId: string) {
    return this.credentials.list(userId);
  }

  @Post('credentials')
  createCredential(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateAiCredentialDto,
  ) {
    return this.credentials.create(userId, dto);
  }

  @Patch('credentials/:id')
  updateCredential(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiCredentialDto,
  ) {
    return this.credentials.update(userId, id, dto);
  }

  @Delete('credentials/:id')
  removeCredential(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.credentials.remove(userId, id);
  }

  @Post('credentials/:id/test')
  @HttpCode(200)
  testCredential(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.credentials.test(userId, id);
  }

  @Get('credentials/:id/models')
  credentialModels(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.credentials.models(userId, id);
  }

  @Get('preferences')
  preferences(@CurrentUser('sub') userId: string) {
    return this.credentials.getPreferences(userId);
  }

  @Put('preferences')
  updatePreferences(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateAiPreferencesDto,
  ) {
    return this.credentials.updatePreferences(userId, dto);
  }

  @Get('usage')
  usage(@CurrentUser('sub') userId: string, @Query() query: UsageQueryDto) {
    return this.reports.report(userId, query);
  }

  @Get('usage/summary')
  usageSummary(@CurrentUser('sub') userId: string) {
    return this.reports.summary(userId);
  }
}
