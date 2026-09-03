import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { UsersService } from '../users/users.service';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { SendNotificationDto } from './dto/send-notification.dto';
import { PushProvider } from './providers/push.provider';

/** One notification, addressed to whoever `sendMany` decides should get it. */
export interface NotificationPayload {
  title: string;
  body: string;
  type?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly pushProvider: PushProvider,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Fans one notification out to many recipients, skipping anyone who has
   * switched `pref` off (see `notificationPrefs` on the user).
   *
   * Never throws: a notification is a side effect of the thing that triggered
   * it, and failing to send one must not fail marking attendance or generating
   * an invoice. Returns how many were actually stored.
   */
  async sendMany(
    recipients: string[],
    payload: NotificationPayload,
    schoolId: string | null,
    pref?: string,
  ): Promise<number> {
    if (!schoolId) {
      return 0;
    }
    try {
      const unique = [...new Set(recipients.filter(Boolean))];
      const targets = pref
        ? await this.usersService.filterByNotificationPref(unique, pref)
        : unique;
      if (targets.length === 0) {
        return 0;
      }

      const now = new Date();
      await this.notificationModel.insertMany(
        targets.map((recipient) => ({
          ...payload,
          recipient: new Types.ObjectId(recipient),
          schoolId: new Types.ObjectId(schoolId),
          sentAt: now,
        })),
      );
      // One call for the whole audience: the provider resolves each user to
      // their devices and batches the send.
      await this.pushProvider.sendToUsers(targets, payload);
      return targets.length;
    } catch (error) {
      this.logger.error(
        `Failed to send "${payload.title}" to ${recipients.length} recipient(s)`,
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    }
  }

  async send(
    dto: SendNotificationDto,
    schoolId: string | null,
  ): Promise<Notification> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    await this.pushProvider.sendToUsers([dto.recipient], {
      title: dto.title,
      body: dto.body,
      type: dto.type,
      data: dto.data,
    });
    return this.notificationModel.create({
      ...dto,
      recipient: new Types.ObjectId(dto.recipient),
      sentAt: new Date(),
      schoolId,
    });
  }

  findForUser(
    userId: string,
    schoolId: string | null,
  ): Promise<Notification[]> {
    return this.notificationModel
      .find(scopeFilter({ recipient: new Types.ObjectId(userId) }, schoolId))
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
  }

  async markAsRead(
    id: string,
    userId: string,
    schoolId: string | null,
  ): Promise<Notification | null> {
    return this.notificationModel
      .findOneAndUpdate(
        scopeFilter(
          { _id: id, recipient: new Types.ObjectId(userId) },
          schoolId,
        ),
        { read: true },
        { new: true },
      )
      .exec();
  }

  async markAllRead(
    userId: string,
    schoolId: string | null,
  ): Promise<{ updated: number }> {
    const res = await this.notificationModel
      .updateMany(
        scopeFilter(
          { recipient: new Types.ObjectId(userId), read: { $ne: true } },
          schoolId,
        ),
        { read: true },
      )
      .exec();
    return { updated: res.modifiedCount };
  }

  async dismissRead(
    userId: string,
    schoolId: string | null,
  ): Promise<{ deleted: number }> {
    const res = await this.notificationModel
      .deleteMany(
        scopeFilter(
          { recipient: new Types.ObjectId(userId), read: true },
          schoolId,
        ),
      )
      .exec();
    return { deleted: res.deletedCount };
  }

  async dismiss(
    id: string,
    userId: string,
    schoolId: string | null,
  ): Promise<void> {
    await this.notificationModel
      .deleteOne(
        scopeFilter(
          { _id: id, recipient: new Types.ObjectId(userId) },
          schoolId,
        ),
      )
      .exec();
  }
}
