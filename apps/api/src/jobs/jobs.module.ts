import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JobsController } from './jobs.controller';
import { JobBrowseService } from './job-browse.service';
import { JobApplicationsService } from './job-applications.service';
import { JobMatchService } from './job-match.service';

@Module({
  imports: [PrismaModule],
  controllers: [JobsController],
  providers: [JobBrowseService, JobApplicationsService, JobMatchService],
})
export class JobsModule {}
