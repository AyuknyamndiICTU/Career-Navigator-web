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

  @Get('work-experience')
  @ApiOkResponse({ description: 'List work experiences.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async listWorkExperiences(
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.listWorkExperiences(authorization);
  }

  @Post('work-experience')
  @ApiOkResponse({ description: 'Create a work experience entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async createWorkExperience(
    @Body() dto: CreateWorkExperienceDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.createWorkExperience(authorization, dto);
  }

  @Put('work-experience/:workExperienceId')
  @ApiOkResponse({ description: 'Update a work experience entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async updateWorkExperience(
    @Param('workExperienceId') workExperienceId: string,
    @Body() dto: UpdateWorkExperienceDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.updateWorkExperience(
      authorization,
      workExperienceId,
      dto,
    );
  }

  @Delete('work-experience/:workExperienceId')
  @ApiOkResponse({ description: 'Delete a work experience entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async deleteWorkExperience(
    @Param('workExperienceId') workExperienceId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<{ message: string }> {
    return this.profileService.deleteWorkExperience(
      authorization,
      workExperienceId,
    );
  }

  // -----------------------
  // Projects
  // -----------------------

  @Get('projects')
  @ApiOkResponse({ description: 'List projects.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async listProjects(
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.listProjects(authorization);
  }

  @Post('projects')
  @ApiOkResponse({ description: 'Create a project entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async createProject(
    @Body() dto: CreateProjectDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.createProject(authorization, dto);
  }

  @Put('projects/:projectId')
  @ApiOkResponse({ description: 'Update a project entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async updateProject(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.updateProject(authorization, projectId, dto);
  }

  @Delete('projects/:projectId')
  @ApiOkResponse({ description: 'Delete a project entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async deleteProject(
    @Param('projectId') projectId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<{ message: string }> {
    return this.profileService.deleteProject(authorization, projectId);
  }

  // -----------------------
  // References
  // -----------------------

  @Get('references')
  @ApiOkResponse({ description: 'List references.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async listReferences(
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.listReferences(authorization);
  }

  @Post('references')
  @ApiOkResponse({ description: 'Create a reference entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async createReference(
    @Body() dto: CreateReferenceDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.createReference(authorization, dto);
  }

  @Put('references/:referenceId')
  @ApiOkResponse({ description: 'Update a reference entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async updateReference(
    @Param('referenceId') referenceId: string,
    @Body() dto: UpdateReferenceDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.profileService.updateReference(authorization, referenceId, dto);
  }

  @Delete('references/:referenceId')
  @ApiOkResponse({ description: 'Delete a reference entry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async deleteReference(
    @Param('referenceId') referenceId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<{ message: string }> {
    return this.profileService.deleteReference(authorization, referenceId);
  }
}
