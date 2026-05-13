import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiBadRequestResponse } from '@nestjs/swagger';
import { MentorsService } from './mentors.service';

@ApiTags('mentors')
@Controller('mentors')
export class MentorsController {
  constructor(private readonly mentorsService: MentorsService) {}

  @Get()
  @ApiOkResponse({ description: 'Search mentors by skill/expertise.' })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  async search(
    @Query('q') q?: string,
    @Query('skill') skill?: string,
    @Query('expertise') expertise?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<unknown> {
    const { page, limit } = this.mentorsService.parsePagination({
      pageRaw,
      limitRaw,
    });

    return this.mentorsService.search({
      q,
      skill,
      expertise,
      page,
      limit,
    });
  }
}
