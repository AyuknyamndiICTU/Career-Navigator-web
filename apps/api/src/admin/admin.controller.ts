import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { FeedbackStatus, UserRole } from '@prisma/client';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';

class SetUserRoleDto {
  role!: UserRole;
}

class SetFeedbackStatusDto {
  status!: FeedbackStatus;
}

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('users')
  @ApiOkResponse({ description: 'List users (admin).' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid bearer token.' })
  async listUsers() {
    return this.adminService.listUsers();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch('users/:userId/role')
  @ApiOkResponse({ description: 'Set user role (admin).' })
  async setUserRole(
    @Param('userId') userId: string,
    @Body() body: SetUserRoleDto,
  ) {
    return this.adminService.setUserRole(userId, body.role);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('feedback')
  @ApiOkResponse({ description: 'List feedback items (admin).' })
  async listFeedback(@Query('status') status?: FeedbackStatus) {
    return this.adminService.listFeedback(status);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch('feedback/:feedbackId/status')
  @ApiOkResponse({ description: 'Update feedback status (admin).' })
  async setFeedbackStatus(
    @Param('feedbackId') feedbackId: string,
    @Body() body: SetFeedbackStatusDto,
  ) {
    return this.adminService.setFeedbackStatus(feedbackId, body.status);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('analytics/engagement')
  @ApiOkResponse({ description: 'Engagement analytics (admin).' })
  async engagementAnalytics() {
    return this.adminService.getEngagementAnalytics();
  }

  @UseGuards(RolesGuard)
  @Roles('USER', 'ADMIN')
  @Get('analytics/dashboard')
  @ApiOkResponse({ description: 'Dashboard KPI counters (USER/Admin).' })
  async dashboardAnalytics() {
    return this.adminService.getDashboardKpis();
  }
}
