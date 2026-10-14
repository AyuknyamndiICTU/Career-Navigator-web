import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Public } from '../auth/jwt-auth.guard';
import {
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { ApplyJobDto } from './dto/apply-job.dto';
import { RerankJobsDto } from './dto/rerank-jobs.dto';
import { parsePagination } from '../lib/pagination';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @Public()
  @ApiOkResponse({ description: 'Browse jobs with optional filters.' })
  async browse(
    @Query('q') q?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('location') location?: string,
    @Query('skill') skill?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<unknown> {
    const searchQuery = q ?? search;
    const { page, limit } = parsePagination(pageRaw, limitRaw);

    return this.jobsService.browse({
      searchQuery,
      status,
      location,
      skill,
      page,
      limit,
    });
  }

  @Post(':jobId/apply')
  @ApiOkResponse({ description: 'Apply to a job with a cover letter.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async apply(
    @Param('jobId') jobId: string,
    @Body() dto: ApplyJobDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.jobsService.apply(userId, jobId, dto);
  }

  @Post('index')
  @ApiOkResponse({
    description: 'Ingest ACTIVE job demand into OpenSearch index.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async indexJobs(): Promise<unknown> {
    return this.jobsService.ingestJobDemand();
  }

  @Post('rerank')
  @ApiOkResponse({
    description: 'AI rerank jobs with explanations and notify user.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  async rerankJobs(
    @Body() dto: RerankJobsDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.jobsService.rerankJobs(userId, dto);
  }

  @Post('matched')
  @ApiOkResponse({
    description:
      'Derive career-path skills from the user and return matched ranked jobs.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  async matchedJobs(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.jobsService.matchedJobs(userId);
  }

  @Get('my-applications')
  @ApiOkResponse({
    description: 'List current user job applications (for Level Up progress).',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async myApplications(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.jobsService.myApplications(userId);
  }
}
