import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MentorsController } from './mentors.controller';
import { MentorsService } from './mentors.service';

@Module({
  imports: [PrismaModule],
  controllers: [MentorsController],
  providers: [MentorsService],
})
export class MentorsModule {}
