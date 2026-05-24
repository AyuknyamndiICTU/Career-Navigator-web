import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { seedCourseScrapeCandidates } from './course-catalog-seed.service';
import { CourseCatalogScrapeService } from './course-catalog-scrape.service';

class SeedCoursesDto {
  truncateExisting?: boolean;
}

class ScrapeCoursesDto {
  platform?: string;
  truncateExisting?: boolean;
}

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseCatalogScrapeService: CourseCatalogScrapeService,
  ) {}

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('seed')
  @ApiOkResponse({
    description: 'Seed scraped course candidates into DB (bootstrap).',
  })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid bearer token.' })
  async seedCourses(@Body() body: SeedCoursesDto): Promise<{ seeded: number }> {
    const seeded = await seedCourseScrapeCandidates(this.prisma, {
      truncateExisting: Boolean(body?.truncateExisting),
    });

    return { seeded };
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('scrape')
  @ApiOkResponse({
    description: 'Run Phase 2 course scrapers and persist candidates into DB.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid bearer token.' })
  async scrapeCourses(@Body() body: ScrapeCoursesDto): Promise<{
    platformResults: Array<{ platform: string; persisted: number }>;
  }> {
    return this.courseCatalogScrapeService.scrapeAndPersistCourses({
      platform: body?.platform,
      truncateExisting: Boolean(body?.truncateExisting),
    });
  }
}
