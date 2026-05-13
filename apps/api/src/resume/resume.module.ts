import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ResumeController } from './resume.controller';
import { ResumeService } from './resume.service';

@Module({
  imports: [PrismaModule],
  controllers: [ResumeController],
  providers: [ResumeService],
})
export class ResumeModule {}
