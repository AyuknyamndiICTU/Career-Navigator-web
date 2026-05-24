import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CoursesController } from './courses.controller';
import { CourseCatalogScrapeService } from './course-catalog-scrape.service';

@Module({
  imports: [PrismaModule],
  controllers: [CoursesController],
  providers: [CourseCatalogScrapeService],
})
export class CoursesModule {}
