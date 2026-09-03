import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  send(@Body() dto: SendNotificationDto, @CurrentUser() user: AuthUser) {
    return this.notificationsService.send(dto, user.schoolId);
  }

  @Get('me')
  myNotifications(
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationsService.findForUser(userId, user.schoolId);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.userId, user.schoolId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.markAsRead(id, user.userId, user.schoolId);
  }

  @Delete('clear-read')
  dismissRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.dismissRead(user.userId, user.schoolId);
  }

  @Delete(':id')
  dismiss(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.dismiss(id, user.userId, user.schoolId);
  }
}
