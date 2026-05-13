import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CvScanService } from './cv-scan.service';
import { CvScanWorkerService } from './worker/cv-scan-worker.service';

@Module({
  imports: [PrismaModule],
  providers: [CvScanService, CvScanWorkerService],
  exports: [CvScanService],
})
export class CvScanModule {}
