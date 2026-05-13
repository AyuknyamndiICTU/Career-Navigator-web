import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { ApplyJobDto } from './dto/apply-job.dto';
import { RerankJobsDto } from './dto/rerank-jobs.dto';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
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

    const page =
      pageRaw && Number.isFinite(Number(pageRaw)) && Number(pageRaw) > 0
        ? Number(pageRaw)
        : 1;

    const limit =
      limitRaw && Number.isFinite(Number(limitRaw)) && Number(limitRaw) > 0
        ? Number(limitRaw)
        : 10;

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
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.jobsService.apply(authorization, jobId, dto);
  }

  @Post('index')
  @ApiOkResponse({
    description: 'Ingest ACTIVE job demand into OpenSearch index.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async indexJobs(
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.jobsService.ingestJobDemand(authorization);
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
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.jobsService.rerankJobs(authorization, dto);
  }
}
