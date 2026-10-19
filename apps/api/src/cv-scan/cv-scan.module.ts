import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CvScanService } from './cv-scan.service';
import { CvScanWorkerService } from './worker/cv-scan-worker.service';
import { CvTextExtractor } from './worker/cv-text-extractor.service';
import { CvAiParser } from './worker/cv-ai-parser.service';
import { CvProfilePopulator } from './worker/cv-profile-populator.service';

@Module({
  imports: [PrismaModule],
  providers: [
    CvScanService,
    CvScanWorkerService,
    CvTextExtractor,
    CvAiParser,
    CvProfilePopulator,
  ],
  exports: [CvScanService],
})
export class CvScanModule {}
