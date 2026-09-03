import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { StudentsService } from '../students/students.service';
import { ClassesService } from '../classes/classes.service';
import { Message, MessageDocument } from './schemas/message.schema';
import {
  Circular,
  CircularAudience,
  CircularDocument,
} from './schemas/circular.schema';
import {
  PtmRequest,
  PtmRequestDocument,
  PtmStatus,
} from './schemas/ptm-request.schema';
import {
  EmergencyAlert,
  EmergencyAlertDocument,
} from './schemas/emergency-alert.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateCircularDto } from './dto/create-circular.dto';
import { CreatePtmRequestDto } from './dto/create-ptm-request.dto';
import { CreateClassPtmDto } from './dto/create-class-ptm.dto';
import { RespondPtmDto } from './dto/respond-ptm.dto';
import { CreateEmergencyAlertDto } from './dto/create-emergency-alert.dto';
import { QueryCircularsDto } from './dto/query-circulars.dto';
import type { ChatGateway } from './chat.gateway';

/** One person the signed-in user is allowed to open a chat with. */
export interface ChatContact {
  userId: string;
  name: string;
  role: string;
  email: string | null;
}

/** One conversation, collapsed to its most recent message. */
export interface ChatThread extends ChatContact {
  lastMessage: string;
  lastAt: Date | null;
  /** Messages in this thread addressed to me that I haven't read. */
  unread: number;
}

/** Who counts as "the office" — the school-side staff a query is escalated to. */
const OFFICE_ROLES = [UserRole.ADMIN, UserRole.PRINCIPAL];

@Injectable()
export class CommunicationService {
  // Optional: injected for REST-sent messages to push via Socket.IO.
  private gateway: ChatGateway | null = null;

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Circular.name)
    private readonly circularModel: Model<CircularDocument>,
    @InjectModel(PtmRequest.name)
    private readonly ptmModel: Model<PtmRequestDocument>,
    @InjectModel(EmergencyAlert.name)
    private readonly alertModel: Model<EmergencyAlertDocument>,
    private readonly notifications: NotificationsService,
    private readonly usersService: UsersService,
    private readonly studentsService: StudentsService,
    // Class-wide PTMs need each class's roster and its class teacher.
    private readonly classesService: ClassesService,
  ) {}

  /** Called by the module to wire the gateway after construction (avoids circular dep). */
  setGateway(gateway: ChatGateway): void {
    this.gateway = gateway;
  }

  // ── Messages ────────────────────────────────────────────

  /**
   * Who may message whom.
   *
   * The office talks to anyone in its school. Otherwise the one permitted
   * pairing is a teacher and a parent **who share a child** — which is exactly
   * what the portal's composer offers: a teacher picks from their own class
   * rosters, a parent picks their child's class teacher.
   *
   * Asserted here because the endpoint accepted any `recipientId` at all, so a
   * hand-made request could reach a parent whose child the sender does not
   * teach, or another teacher entirely.
   */
  private async assertMayMessage(
    sender: AuthUser,
    recipientId: string,
    recipientRole: string,
  ): Promise<void> {
    const senderIsOffice = OFFICE_ROLES.includes(sender.role as UserRole);
    const recipientIsOffice = OFFICE_ROLES.includes(recipientRole as UserRole);
    if (senderIsOffice || recipientIsOffice) {
      return;
    }

    // Neither end is the office, so this has to be a teacher and a parent.
    const pairing =
      sender.role === UserRole.TEACHER && recipientRole === UserRole.PARENT
        ? { teacherId: sender.userId, parentId: recipientId }
        : sender.role === UserRole.PARENT && recipientRole === UserRole.TEACHER
          ? { teacherId: recipientId, parentId: sender.userId }
          : null;
    if (!pairing) {
      throw new ForbiddenException(
        'Messages go through the school office.',
      );
    }

    if (!(await this.sharesAChild(pairing.teacherId, pairing.parentId, sender.schoolId))) {
      throw new ForbiddenException(
        'You can only message a teacher or parent you share a child with.',
      );
    }
  }

  /** True when the parent has a child in a class this teacher is class teacher of. */
  private async sharesAChild(
    teacherId: string,
    parentId: string,
    schoolId: string | null,
  ): Promise<boolean> {
    const taught = await this.classesService.studentIdsForTeacher(
      teacherId,
      schoolId,
    );
    if (!taught.length) {
      return false;
    }
    const children = await this.studentsService.findAll(
      { parentUserId: parentId, limit: 100 },
      schoolId,
    );
    const taughtIds = new Set(taught.map(String));
    return children.data.some((child) =>
      taughtIds.has(String((child as unknown as { _id: unknown })._id)),
    );
  }

  async sendMessage(
    dto: SendMessageDto,
    sender: AuthUser,
  ): Promise<Message> {
    const schoolId = sender.schoolId;
    const senderId = sender.userId;
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    // The recipient has to exist and sit in the sender's own school.
    // `findOne` scopes by school, so an id from another tenant is a 404 here
    // rather than a message written into a void nobody can ever read.
    const recipient = await this.usersService.findOne(dto.recipientId, schoolId);
    await this.assertMayMessage(sender, dto.recipientId, recipient.role);

    const doc = await this.messageModel.create({
      sender: new Types.ObjectId(senderId),
      recipient: new Types.ObjectId(dto.recipientId),
      subject: dto.subject ?? null,
      body: dto.body,
      relatedStudent: dto.relatedStudent
        ? new Types.ObjectId(dto.relatedStudent)
        : null,
      schoolId,
    });
    await doc.populate('sender', 'name role email');

    // Real-time delivery via Socket.IO when the recipient is online;
    // otherwise an in-app notification.
    if (this.gateway?.isOnline(dto.recipientId)) {
      // Gateway handles delivery — just emit on the server side.
      this.gateway.server
        .to(dto.recipientId)
        .emit('newMessage', doc.toObject());
      this.gateway.server
        .to(senderId)
        .emit('messageSent', doc.toObject());
    } else {
      const senderName =
        (doc.sender as unknown as { name?: string })?.name ?? 'Someone';
      try {
        await this.notifications.send(
          {
            recipient: dto.recipientId,
            title: `New message from ${senderName}`,
            body:
              dto.body.length > 120 ? `${dto.body.slice(0, 117)}…` : dto.body,
            // `type` + `data` let the app open the thread straight from the
            // notification instead of dumping the user on the inbox.
            type: 'message',
            data: {
              messageId: String(doc._id),
              senderId,
              senderName,
            },
          },
          schoolId,
        );
      } catch {
        // Notification delivery is best-effort — never fail the send.
      }
    }
    return doc;
  }

  inbox(userId: string, schoolId: string | null): Promise<Message[]> {
    return this.messageModel
      .find(
        scopeFilter({ recipient: new Types.ObjectId(userId) }, schoolId),
      )
      .sort({ createdAt: -1 })
      .populate('sender', 'name role email')
      .populate('recipient', 'name role email')
      .exec();
  }

  sent(userId: string, schoolId: string | null): Promise<Message[]> {
    return this.messageModel
      .find(scopeFilter({ sender: new Types.ObjectId(userId) }, schoolId))
      .sort({ createdAt: -1 })
      .populate('sender', 'name role email')
      .populate('recipient', 'name role email')
      .exec();
  }

  conversation(
    userId: string,
    otherId: string,
    schoolId: string | null,
  ): Promise<Message[]> {
    const me = new Types.ObjectId(userId);
    const other = new Types.ObjectId(otherId);
    return this.messageModel
      .find(
        scopeFilter(
          {
            $or: [
              { sender: me, recipient: other },
              { sender: other, recipient: me },
            ],
          },
          schoolId,
        ),
      )
      .sort({ createdAt: 1 })
      .populate('sender', 'name role email')
      .populate('recipient', 'name role email')
      .populate('relatedStudent', 'firstName lastName')
      .exec();
  }

  async markRead(
    id: string,
    userId: string,
    schoolId: string | null,
  ): Promise<Message> {
    const doc = await this.messageModel
      .findOneAndUpdate(
        scopeFilter(
          { _id: id, recipient: new Types.ObjectId(userId) },
          schoolId,
        ),
        { read: true, readAt: new Date() },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('Message not found');
    return doc;
  }

  /**
   * Who this user may start a chat with.
   *
   * Admins/principals resolve queries, so they see every teacher and parent in
   * the school. Teachers and parents see the office (admins/principals) — the
   * people who answer those queries. Teacher↔parent chats are *not* listed
   * here: those pickers are roster-driven (a teacher's classes, a parent's
   * class teacher) and stay that way, so no one gains a new peer to message.
   */
  async chatContacts(user: AuthUser): Promise<ChatContact[]> {
    if (!user.schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const isOffice = OFFICE_ROLES.includes(user.role as UserRole);
    const roles = isOffice
      ? [UserRole.TEACHER, UserRole.PARENT]
      : OFFICE_ROLES;

    const users = await this.usersService.findForSchoolByRoles(
      user.schoolId,
      roles,
    );
    return users
      .map((u) => ({
        userId: String((u as unknown as { _id: Types.ObjectId })._id),
        name: u.name,
        role: u.role,
        email: u.email ?? null,
      }))
      .filter((c) => c.userId !== user.userId);
  }

  /**
   * Every conversation this user is part of, newest first — sent *and*
   * received, so a thread you opened and got no reply to still shows up.
   * (Grouping the inbox alone would hide it, which bites admins most: they
   * usually message first.)
   */
  async threads(userId: string, schoolId: string | null): Promise<ChatThread[]> {
    const me = new Types.ObjectId(userId);
    const match: FilterQuery<MessageDocument> = {
      $or: [{ sender: me }, { recipient: me }],
    };
    if (schoolId) {
      match.schoolId = new Types.ObjectId(schoolId);
    }

    return this.messageModel.aggregate<ChatThread>([
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          // The other party is whichever end of the message isn't me.
          _id: {
            $cond: [{ $eq: ['$sender', me] }, '$recipient', '$sender'],
          },
          lastMessage: { $first: '$body' },
          lastAt: { $first: '$createdAt' },
          unread: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipient', me] },
                    { $eq: ['$read', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      // Drop threads whose other party no longer exists.
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: { $toString: '$_id' },
          name: '$user.name',
          role: '$user.role',
          email: { $ifNull: ['$user.email', null] },
          lastMessage: 1,
          lastAt: 1,
          unread: 1,
        },
      },
      { $sort: { lastAt: -1 } },
    ]);
  }

  async unreadCount(
    userId: string,
    schoolId: string | null,
  ): Promise<{ unread: number }> {
    const unread = await this.messageModel
      .countDocuments(
        scopeFilter(
          { recipient: new Types.ObjectId(userId), read: false },
          schoolId,
        ),
      )
      .exec();
    return { unread };
  }

  // ── Circulars ───────────────────────────────────────────

  async createCircular(
    dto: CreateCircularDto,
    publishedBy: string,
    schoolId: string | null,
  ): Promise<Circular> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const circular = await this.circularModel.create({
      ...dto,
      classId: dto.classId ? new Types.ObjectId(dto.classId) : null,
      publishedBy: new Types.ObjectId(publishedBy),
      schoolId,
    });

    // A circular is a broadcast — it has to reach its audience's bell, not just
    // the circulars list. No pref gate: this is the school talking to everyone.
    const recipients = await this.circularRecipients(dto, schoolId);
    await this.notifications.sendMany(
      recipients,
      {
        title: dto.title,
        body: dto.body.length > 120 ? `${dto.body.slice(0, 117)}…` : dto.body,
        type: 'circular',
        data: { circularId: String(circular._id) },
      },
      schoolId,
    );
    return circular;
  }

  /** Who a circular is addressed to, per its audience. */
  private async circularRecipients(
    dto: CreateCircularDto,
    schoolId: string,
  ): Promise<string[]> {
    const audience = dto.audience ?? CircularAudience.ALL;

    // A class circular goes to that class's parents only.
    if (audience === CircularAudience.CLASS && dto.classId) {
      const roster = await this.studentsService.findByClass(
        dto.classId,
        schoolId,
      );
      return roster
        .map((s) => s.parentUserId)
        .filter((p): p is Types.ObjectId => !!p)
        .map(String);
    }

    const roles: UserRole[] =
      audience === CircularAudience.PARENTS
        ? [UserRole.PARENT]
        : audience === CircularAudience.TEACHERS
          ? [UserRole.TEACHER]
          : audience === CircularAudience.STAFF
            ? [UserRole.TEACHER, UserRole.ADMIN, UserRole.PRINCIPAL]
            : [UserRole.PARENT, UserRole.TEACHER];
    return this.usersService.findUserIdsForSchoolByRoles(schoolId, roles);
  }

  listCirculars(
    query: QueryCircularsDto,
    schoolId: string | null,
  ): Promise<Circular[]> {
    const filter: FilterQuery<CircularDocument> = {};
    if (query.audience) filter.audience = query.audience;
    if (query.classId) filter.classId = new Types.ObjectId(query.classId);
    return this.circularModel
      .find(scopeFilter(filter, schoolId))
      .sort({ pinned: -1, publishedAt: -1 })
      .exec();
  }

  async getCircular(
    id: string,
    schoolId: string | null,
  ): Promise<Circular> {
    const doc = await this.circularModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!doc) throw new NotFoundException('Circular not found');
    return doc;
  }

  async removeCircular(id: string, schoolId: string | null): Promise<void> {
    const res = await this.circularModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) throw new NotFoundException('Circular not found');
  }

  // ── PTM requests (school-initiated; the admin decides) ──
  //
  // Flow: a teacher raises the request → the admin schedules or declines it →
  // the parent is notified of the outcome. A parent never requests a meeting
  // and never accepts one; they are told what was decided.

  async createPtm(
    dto: CreatePtmRequestDto,
    user: AuthUser,
  ): Promise<PtmRequest> {
    if (!user.schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const isTeacher = user.role === UserRole.TEACHER;
    const doc = await this.ptmModel.create({
      student: new Types.ObjectId(dto.studentId),
      requestedBy: new Types.ObjectId(user.userId),
      // The parent side of the meeting — the student's linked parent, so the
      // request shows in that parent's list once it's decided.
      parent: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
      // A teacher raising it is the teacher side. An admin raising it leaves
      // the teacher slot open (or takes the one named in the DTO).
      teacher: isTeacher
        ? new Types.ObjectId(user.userId)
        : dto.teacherId
          ? new Types.ObjectId(dto.teacherId)
          : null,
      reason: dto.reason,
      preferredSlots: dto.preferredSlots ?? [],
      schoolId: user.schoolId,
    });

    // The admin is the one who acts on this, so tell them it's waiting.
    // Best-effort: a failed notification must not fail the request.
    try {
      const admins = await this.usersService.findProfileAdminsForSchool(
        user.schoolId,
      );
      await this.notifications.sendMany(
        admins.filter((id) => id !== user.userId),
        {
          title: 'New PTM request',
          body:
            dto.reason.length > 120
              ? `${dto.reason.slice(0, 117)}…`
              : dto.reason,
          type: 'ptm',
          data: { ptmId: String(doc._id) },
        },
        user.schoolId,
      );
    } catch {
      // ignored — the request is still visible in the admin's PTM list.
    }
    return doc;
  }

  /**
   * A PTM called for whole classes at once — a "PTM day" for 1A and 2A, say.
   * One meeting is created per student, so every parent sees and is notified
   * about *their own child's* meeting rather than a broadcast.
   *
   * Who calls it decides what comes out:
   *
   *  * **Admin** — the decider, so the meetings are created already
   *    `scheduled` (a date is required) and every parent is notified. Making
   *    the admin approve their own request afterwards would be a pointless step.
   *  * **Teacher** — raises `requested` meetings for classes they teach; the
   *    admin then schedules or declines them. Parents hear nothing yet: there
   *    is no meeting until the office confirms one.
   *
   * Students with no linked parent account are skipped — there's nobody to
   * notify — and reported back in the count so the caller knows.
   */
  async createPtmForClasses(
    dto: CreateClassPtmDto,
    user: AuthUser,
  ): Promise<{ created: number; skipped: number }> {
    if (!user.schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const schoolId = user.schoolId;
    const isOffice = OFFICE_ROLES.includes(user.role as UserRole);

    if (isOffice && !dto.scheduledAt) {
      throw new BadRequestException(
        'scheduledAt is required — a meeting the office calls is already confirmed',
      );
    }
    // A teacher's request has no date until the office sets one.
    const scheduledAt =
      isOffice && dto.scheduledAt ? new Date(dto.scheduledAt) : null;

    let created = 0;
    let skipped = 0;
    const parents: string[] = [];
    const teachers = new Set<string>();

    for (const classId of dto.classIds) {
      // The class's own teacher takes the meeting, so it also lands in their
      // list and they can mark it done afterwards.
      const klass = await this.classesService.findOne(classId, schoolId);
      const classTeacherId = this.idOf(
        (klass as unknown as { classTeacher?: unknown }).classTeacher,
      );

      // A teacher may only call a PTM for a class they actually teach.
      if (!isOffice && classTeacherId !== user.userId) {
        throw new ForbiddenException(
          'You can only request a meeting for a class you teach',
        );
      }

      const teacherId = isOffice ? classTeacherId : user.userId;
      if (teacherId) teachers.add(teacherId);

      const roster = await this.studentsService.findByClass(classId, schoolId);
      const docs = roster
        .filter((s) => {
          if (s.parentUserId) return true;
          skipped++;
          return false;
        })
        .map((s) => {
          const parentId = String(s.parentUserId);
          parents.push(parentId);
          return {
            student: (s as unknown as { _id: Types.ObjectId })._id,
            parent: new Types.ObjectId(parentId),
            teacher: teacherId ? new Types.ObjectId(teacherId) : null,
            requestedBy: new Types.ObjectId(user.userId),
            reason: dto.reason,
            preferredSlots: [],
            status: isOffice ? PtmStatus.SCHEDULED : PtmStatus.REQUESTED,
            scheduledAt,
            responseNote: dto.responseNote ?? null,
            schoolId,
          };
        });

      if (docs.length > 0) {
        await this.ptmModel.insertMany(docs);
        created += docs.length;
      }
    }

    if (created === 0) return { created, skipped };

    try {
      if (isOffice && scheduledAt) {
        // Confirmed: everyone affected hears about it once.
        await this.notifications.sendMany(
          [...new Set([...parents, ...teachers])],
          {
            title: 'Parent-teacher meeting scheduled',
            body: `The school scheduled a meeting for ${scheduledAt.toDateString()}: ${dto.reason}`,
            type: 'ptm',
            data: { scheduledAt: scheduledAt.toISOString() },
          },
          schoolId,
        );
      } else {
        // Nothing is decided yet — tell the admins, who have to act on it.
        const admins =
          await this.usersService.findProfileAdminsForSchool(schoolId);
        await this.notifications.sendMany(
          admins.filter((id) => id !== user.userId),
          {
            title: `New PTM request for ${dto.classIds.length > 1 ? 'classes' : 'a class'}`,
            body: `${created} students: ${dto.reason}`,
            type: 'ptm',
          },
          schoolId,
        );
      }
    } catch {
      // Best-effort — the meetings are created and visible in-app.
    }

    return { created, skipped };
  }

  /** Id of a ref that may be a raw ObjectId or a populated document. */
  private idOf(ref: unknown): string | null {
    if (!ref) return null;
    if (ref instanceof Types.ObjectId) return String(ref);
    if (typeof ref === 'string') return ref;
    const id = (ref as { _id?: unknown })._id;
    return id ? String(id) : null;
  }

  /** Requests I created, plus (for parents) requests addressed to me. */
  ptmRequestedBy(
    userId: string,
    schoolId: string | null,
  ): Promise<PtmRequest[]> {
    const me = new Types.ObjectId(userId);
    return this.ptmModel
      .find(
        scopeFilter({ $or: [{ requestedBy: me }, { parent: me }] }, schoolId),
      )
      .sort({ createdAt: -1 })
      .exec();
  }

  ptmForTeacher(
    userId: string,
    schoolId: string | null,
  ): Promise<PtmRequest[]> {
    // Unassigned requests (teacher: null) are visible to every teacher so
    // any of them can pick one up; responding assigns it to the responder.
    return this.ptmModel
      .find(
        scopeFilter(
          {
            $or: [{ teacher: new Types.ObjectId(userId) }, { teacher: null }],
          },
          schoolId,
        ),
      )
      .sort({ createdAt: -1 })
      .exec();
  }

  /** The admin's queue. Populated: they need to see who the meeting is about
   *  and which teacher asked for it before they can decide. */
  ptmAll(schoolId: string | null): Promise<PtmRequest[]> {
    return this.ptmModel
      .find(scopeFilter({}, schoolId))
      .sort({ createdAt: -1 })
      .populate('student', 'firstName lastName')
      .populate('requestedBy', 'name role')
      .exec();
  }

  /**
   * Acting on a request. Who may do what:
   *
   *  * **Accept (schedule) / reject (decline) / cancel** — the admin only. The
   *    school decides whether a meeting happens.
   *  * **Mark completed** — the admin, or the teacher the meeting is with (they
   *    are the one who actually held it).
   *
   * A meeting can only be completed once it has actually happened: it must be
   * scheduled, and its date must have arrived. (Parents reach none of this —
   * the route excludes them.)
   */
  async respondPtm(
    id: string,
    dto: RespondPtmDto,
    user: AuthUser,
  ): Promise<PtmRequest> {
    const existing = await this.ptmModel
      .findOne(scopeFilter({ _id: id }, user.schoolId))
      .exec();
    if (!existing) throw new NotFoundException('PTM request not found');

    const isOffice = OFFICE_ROLES.includes(user.role as UserRole);

    if (dto.status === PtmStatus.COMPLETED) {
      this.assertMayComplete(existing, user, isOffice);
    } else if (!isOffice) {
      throw new ForbiddenException(
        'Only the school office can accept or reject a meeting request',
      );
    }

    // Scheduling is a commitment to a date: that date is what every parent is
    // told, and completion is gated on it having arrived. A dateless
    // `scheduled` would therefore create a meeting nobody could ever close, so
    // refuse it here rather than trusting each client to ask for the date.
    if (
      dto.status === PtmStatus.SCHEDULED &&
      !dto.scheduledAt &&
      !existing.scheduledAt
    ) {
      throw new BadRequestException(
        'Scheduling a meeting needs a date and time',
      );
    }

    const patch: Record<string, unknown> = { status: dto.status };
    if (dto.scheduledAt) patch.scheduledAt = new Date(dto.scheduledAt);
    if (dto.responseNote !== undefined) patch.responseNote = dto.responseNote;

    const doc = await this.ptmModel
      .findOneAndUpdate(
        scopeFilter({ _id: id }, user.schoolId),
        patch,
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('PTM request not found');

    await this.notifyPtmDecision(doc, user);
    return doc;
  }

  /**
   * A meeting may be marked done by the admin or by the teacher it's with —
   * and only once it has actually taken place.
   *
   * "Taken place" is judged by the *day*, not the minute: a meeting booked for
   * 3pm today can be closed off at 3.30pm without the server insisting the
   * clock has passed some exact instant, but tomorrow's meeting cannot be
   * completed today.
   */
  private assertMayComplete(
    doc: PtmRequestDocument,
    user: AuthUser,
    isOffice: boolean,
  ): void {
    const mine =
      String(doc.teacher) === user.userId ||
      String(doc.requestedBy) === user.userId;
    if (!isOffice && !(user.role === UserRole.TEACHER && mine)) {
      throw new ForbiddenException(
        'Only the school office or the meeting’s teacher can mark it completed',
      );
    }

    if (doc.status !== PtmStatus.SCHEDULED || !doc.scheduledAt) {
      throw new BadRequestException(
        'Only a scheduled meeting can be marked completed',
      );
    }

    const day = new Date(doc.scheduledAt);
    day.setHours(0, 0, 0, 0);
    if (Date.now() < day.getTime()) {
      throw new BadRequestException(
        'This meeting cannot be marked completed before the date it is scheduled for',
      );
    }
  }

  /**
   * Tells the parent what the school decided — this is the parent's whole
   * involvement in a PTM — and lets the teacher who raised it know too.
   */
  private async notifyPtmDecision(
    doc: PtmRequestDocument,
    user: AuthUser,
  ): Promise<void> {
    if (!user.schoolId) return;
    // Closing off a meeting that already happened is bookkeeping — the parent
    // was there. Don't ping them about it.
    if (doc.status === PtmStatus.COMPLETED) return;

    const when = doc.scheduledAt
      ? ` for ${doc.scheduledAt.toDateString()}`
      : '';
    const scheduled = doc.status === PtmStatus.SCHEDULED;
    const title = scheduled
      ? 'Parent-teacher meeting scheduled'
      : `Parent-teacher meeting ${doc.status}`;
    // Never call it "your meeting request" — the parent didn't request it, the
    // school called it.
    const body = scheduled
      ? `The school scheduled a meeting${when}: ${doc.reason}`
      : `The school ${doc.status} the meeting: ${doc.reason}`;

    // The parent, plus whoever raised it (unless that's the responder).
    const recipients = new Set<string>();
    if (doc.parent) recipients.add(String(doc.parent));
    if (String(doc.requestedBy) !== user.userId) {
      recipients.add(String(doc.requestedBy));
    }
    if (recipients.size === 0) return;

    try {
      await this.notifications.sendMany(
        [...recipients],
        {
          title,
          body: body.length > 160 ? `${body.slice(0, 157)}…` : body,
          type: 'ptm',
          data: { ptmId: String(doc._id) },
        },
        user.schoolId,
      );
    } catch {
      // Best-effort: the decision is already saved and visible in-app.
    }
  }

  // ── Emergency alerts ────────────────────────────────────

  createAlert(
    dto: CreateEmergencyAlertDto,
    sentBy: string,
    schoolId: string | null,
  ): Promise<EmergencyAlert> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    return this.alertModel.create({
      ...dto,
      classId: dto.classId ? new Types.ObjectId(dto.classId) : null,
      sentBy: new Types.ObjectId(sentBy),
      schoolId,
    });
  }

  listAlerts(schoolId: string | null): Promise<EmergencyAlert[]> {
    return this.alertModel
      .find(scopeFilter({}, schoolId))
      .sort({ sentAt: -1 })
      .limit(100)
      .exec();
  }
}
