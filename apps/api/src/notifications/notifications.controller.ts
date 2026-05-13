import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOkResponse({ description: 'List notifications for current user.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async list(
    @Headers('authorization') authorization?: string,
    @Query('includeRead') includeReadRaw?: string,
  ): Promise<unknown> {
    const includeRead = includeReadRaw === 'true';
    return this.notificationsService.listNotifications(
      authorization,
      includeRead,
    );
  }

  @Get(':notificationId')
  @ApiOkResponse({ description: 'Get notification details.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async getOne(
    @Param('notificationId') notificationId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.notificationsService.getNotification(
      authorization,
      notificationId,
    );
  }

  @Post()
  @ApiOkResponse({ description: 'Create a notification for current user.' })
  @ApiBadRequestResponse({ description: 'Invalid input.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async create(
    @Body() dto: CreateNotificationDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.notificationsService.createNotification(authorization, dto);
  }

  @Post(':notificationId/read')
  @ApiOkResponse({ description: 'Mark notification as read.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async markRead(
    @Param('notificationId') notificationId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<{ message: string }> {
    return this.notificationsService.markAsRead(authorization, notificationId);
  }

  @Delete(':notificationId')
  @ApiOkResponse({ description: 'Delete notification.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async deleteOne(
    @Param('notificationId') notificationId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<{ message: string }> {
    return this.notificationsService.deleteNotification(
      authorization,
      notificationId,
    );
  }
}
