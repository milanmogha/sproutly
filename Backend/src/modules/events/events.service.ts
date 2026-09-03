import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { UserRole } from '../../common/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Event, EventAudience, EventDocument } from './schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationDocument,
} from './schemas/event-registration.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { RegisterEventDto } from './dto/register-event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name)
    private readonly eventModel: Model<EventDocument>,
    @InjectModel(EventRegistration.name)
    private readonly registrationModel: Model<EventRegistrationDocument>,
    private readonly usersService: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    dto: CreateEventDto,
    createdBy: string,
    schoolId: string | null,
  ): Promise<Event> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const event = await this.eventModel.create({
      ...dto,
      createdBy: new Types.ObjectId(createdBy),
      schoolId,
    });

    // An event nobody is told about is just a database row.
    const audience = dto.audience ?? EventAudience.ALL;
    const roles =
      audience === EventAudience.TEACHERS
        ? [UserRole.TEACHER]
        : audience === EventAudience.PARENTS
          ? [UserRole.PARENT]
          : [UserRole.PARENT, UserRole.TEACHER];
    const recipients = await this.usersService.findUserIdsForSchoolByRoles(
      schoolId,
      roles,
    );
    const when = new Date(dto.startDate).toDateString();
    await this.notifications.sendMany(
      recipients,
      {
        title: `New event: ${dto.title}`,
        body: dto.venue ? `${when} at ${dto.venue}.` : `${when}.`,
        type: 'event',
        data: { eventId: String(event._id), startDate: when },
      },
      schoolId,
      'eventReminders',
    );
    return event;
  }

  async findAll(
    page = 1,
    limit = 20,
    schoolId: string | null,
    upcoming = false,
  ): Promise<PaginatedResult<Event>> {
    const skip = (page - 1) * limit;
    const filter: FilterQuery<EventDocument> = scopeFilter(
      { isActive: true },
      schoolId,
    );
    if (upcoming) {
      filter.startDate = { $gte: new Date(new Date().setHours(0, 0, 0, 0)) };
    }
    const [data, total] = await Promise.all([
      this.eventModel
        .find(filter)
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.eventModel.countDocuments(filter).exec(),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, schoolId: string | null): Promise<Event> {
    const doc = await this.eventModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!doc) {
      throw new NotFoundException('Event not found');
    }
    return doc;
  }

  async update(
    id: string,
    dto: Partial<CreateEventDto>,
    schoolId: string | null,
  ): Promise<Event> {
    const doc = await this.eventModel
      .findOneAndUpdate(scopeFilter({ _id: id }, schoolId), dto, {
        new: true,
      })
      .exec();
    if (!doc) {
      throw new NotFoundException('Event not found');
    }
    return doc;
  }

  async remove(id: string, schoolId: string | null): Promise<void> {
    const res = await this.eventModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) {
      throw new NotFoundException('Event not found');
    }
    await this.registrationModel.deleteMany({ eventId: res._id }).exec();
  }

  // ── Registrations ───────────────────────────────────────

  async register(
    eventId: string,
    dto: RegisterEventDto,
    userId: string,
    schoolId: string | null,
  ): Promise<EventRegistration> {
    const event = await this.findOne(eventId, schoolId);
    if (!event.isActive) {
      throw new BadRequestException('Event is not open for registration');
    }
    try {
      return await this.registrationModel.create({
        eventId: new Types.ObjectId(eventId),
        userId: new Types.ObjectId(userId),
        studentId: dto.studentId ? new Types.ObjectId(dto.studentId) : null,
        notes: dto.notes ?? null,
        schoolId,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException('Already registered for this event');
      }
      throw err;
    }
  }

  async registrations(
    eventId: string,
    schoolId: string | null,
  ): Promise<EventRegistration[]> {
    await this.findOne(eventId, schoolId);
    return this.registrationModel
      .find(scopeFilter({ eventId: new Types.ObjectId(eventId) }, schoolId))
      .sort({ createdAt: -1 })
      .exec();
  }

  async myRegistrations(
    userId: string,
    schoolId: string | null,
  ): Promise<EventRegistration[]> {
    return this.registrationModel
      .find(scopeFilter({ userId: new Types.ObjectId(userId) }, schoolId))
      .sort({ createdAt: -1 })
      .exec();
  }
}
