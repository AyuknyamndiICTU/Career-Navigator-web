import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CvScanService } from './cv-scan.service';
import { CvScanWorkerService } from './worker/cv-scan-worker.service';
import { CvTextExtractor } from './worker/cv-text-extractor.service';
import { CvAiParser } from './worker/cv-ai-parser.service';
import { CvProfilePopulator } from './worker/cv-profile-populator.service';
import { CvScanProcessor } from './worker/cv-scan-processor.service';
import { CvServerOcr } from './worker/cv-server-ocr.service';

@Module({
  imports: [PrismaModule],
  providers: [
    CvScanService,
    CvScanWorkerService,
    CvTextExtractor,
    CvAiParser,
    CvProfilePopulator,
    CvScanProcessor,
    CvServerOcr,
  ],
  exports: [CvScanService, CvScanProcessor, CvProfilePopulator, CvAiParser],
})
export class CvScanModule {}
