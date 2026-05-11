import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpsertProfileDto } from './dto/profile.dto';
import { CreateEducationDto, UpdateEducationDto } from './dto/education.dto';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOkResponse({ description: 'Fetch personal profile.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async getProfile(
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.getProfile(authorization);
  }

  @Put()
  @ApiOkResponse({ description: 'Upsert personal profile.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async upsertProfile(
    @Body() dto: UpsertProfileDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.upsertProfile(authorization, dto);
  }

  @Get('education')
  @ApiOkResponse({ description: 'List educations.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async listEducations(
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.listEducations(authorization);
  }

  @Post('education')
  @ApiOkResponse({ description: 'Create an education entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async createEducation(
    @Body() dto: CreateEducationDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.createEducation(authorization, dto);
  }

  @Put('education/:educationId')
  @ApiOkResponse({ description: 'Update an education entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async updateEducation(
    @Param('educationId') educationId: string,
    @Body() dto: UpdateEducationDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.updateEducation(authorization, educationId, dto);
  }

  @Delete('education/:educationId')
  @ApiOkResponse({ description: 'Delete an education entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async deleteEducation(
    @Param('educationId') educationId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<{ message: string }> {
    return this.profileService.deleteEducation(authorization, educationId);
  }
}
