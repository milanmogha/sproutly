import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushProvider } from './providers/push.provider';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    // Recipients are filtered by their notificationPrefs before anything is sent.
    UsersModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
