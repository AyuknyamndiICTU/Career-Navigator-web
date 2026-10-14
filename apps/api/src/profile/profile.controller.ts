import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../auth/jwt-auth.guard';
import {
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpsertProfileDto } from './dto/profile.dto';
import { CreateEducationDto, UpdateEducationDto } from './dto/education.dto';
import {
  CreateWorkExperienceDto,
  UpdateWorkExperienceDto,
} from './dto/work-experience.dto';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { CreateReferenceDto, UpdateReferenceDto } from './dto/reference.dto';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOkResponse({ description: 'Fetch personal profile.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async getProfile(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.profileService.getProfile(userId);
  }

  @Put()
  @ApiOkResponse({ description: 'Upsert personal profile.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async upsertProfile(
    @Body() dto: UpsertProfileDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.profileService.upsertProfile(userId, dto);
  }

  @Get('education')
  @ApiOkResponse({ description: 'List educations.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async listEducations(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.profileService.listEducations(userId);
  }

  @Post('education')
  @ApiOkResponse({ description: 'Create an education entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async createEducation(
    @Body() dto: CreateEducationDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.profileService.createEducation(userId, dto);
  }

  @Put('education/:educationId')
  @ApiOkResponse({ description: 'Update an education entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async updateEducation(
    @Param('educationId') educationId: string,
    @Body() dto: UpdateEducationDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.profileService.updateEducation(userId, educationId, dto);
  }

  @Delete('education/:educationId')
  @ApiOkResponse({ description: 'Delete an education entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async deleteEducation(
    @Param('educationId') educationId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<{ message: string }> {
    return this.profileService.deleteEducation(userId, educationId);
  }

  @Get('work-experience')
  @ApiOkResponse({ description: 'List work experiences.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async listWorkExperiences(
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.profileService.listWorkExperiences(userId);
  }

  @Post('work-experience')
  @ApiOkResponse({ description: 'Create a work experience entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async createWorkExperience(
    @Body() dto: CreateWorkExperienceDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.profileService.createWorkExperience(userId, dto);
  }

  @Put('work-experience/:workExperienceId')
  @ApiOkResponse({ description: 'Update a work experience entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async updateWorkExperience(
    @Param('workExperienceId') workExperienceId: string,
    @Body() dto: UpdateWorkExperienceDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.profileService.updateWorkExperience(
      userId,
      workExperienceId,
      dto,
    );
  }

  @Delete('work-experience/:workExperienceId')
  @ApiOkResponse({ description: 'Delete a work experience entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async deleteWorkExperience(
    @Param('workExperienceId') workExperienceId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<{ message: string }> {
    return this.profileService.deleteWorkExperience(
      userId,
      workExperienceId,
    );
  }

  // -----------------------
  // Projects
  // -----------------------

  @Get('projects')
  @ApiOkResponse({ description: 'List projects.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async listProjects(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.profileService.listProjects(userId);
  }

  @Post('projects')
  @ApiOkResponse({ description: 'Create a project entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async createProject(
    @Body() dto: CreateProjectDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.profileService.createProject(userId, dto);
  }

  @Put('projects/:projectId')
  @ApiOkResponse({ description: 'Update a project entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async updateProject(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.profileService.updateProject(userId, projectId, dto);
  }

  @Delete('projects/:projectId')
  @ApiOkResponse({ description: 'Delete a project entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async deleteProject(
    @Param('projectId') projectId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<{ message: string }> {
    return this.profileService.deleteProject(userId, projectId);
  }

  // -----------------------
  // References
  // -----------------------

  @Get('references')
  @ApiOkResponse({ description: 'List references.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async listReferences(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.profileService.listReferences(userId);
  }

  @Post('references')
  @ApiOkResponse({ description: 'Create a reference entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async createReference(
    @Body() dto: CreateReferenceDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.profileService.createReference(userId, dto);
  }

  @Put('references/:referenceId')
  @ApiOkResponse({ description: 'Update a reference entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async updateReference(
    @Param('referenceId') referenceId: string,
    @Body() dto: UpdateReferenceDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.profileService.updateReference(userId, referenceId, dto);
  }

  @Delete('references/:referenceId')
  @ApiOkResponse({ description: 'Delete a reference entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async deleteReference(
    @Param('referenceId') referenceId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<{ message: string }> {
    return this.profileService.deleteReference(userId, referenceId);
  }
}
