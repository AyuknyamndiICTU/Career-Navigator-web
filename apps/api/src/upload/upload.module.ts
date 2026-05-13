import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CvScanModule } from '../cv-scan/cv-scan.module';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [PrismaModule, CvScanModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
