import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { FilterQuery, Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { UserRole } from '../../common/enums/user-role.enum';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { normalizeIndianPhone } from '../../common/utils/phone.util';
import { MailService } from '../mail/mail.service';
import { RefreshSession, User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';

const SALT_ROUNDS = 10;

/** Result of creating a user: the user, plus an invite link when one was issued. */
export interface CreateUserResult {
  user: User;
  inviteUrl?: string;
  /**
   * Whether the invite email actually went out. Only meaningful alongside
   * `inviteUrl`; false means the account exists but nobody was told, so the
   * caller must surface the link by hand.
   */
  invited?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateUserDto): Promise<CreateUserResult> {
    if (dto.role !== UserRole.SUPER_ADMIN && !dto.schoolId) {
      throw new BadRequestException(
        'schoolId is required for every role except super_admin',
      );
    }

    // Parents are created active, no password, no invite. Their email is the
    // login identity while phone/WhatsApp OTP is disabled (passed through when
    // supplied); phone still keys the account.
    if (dto.role === UserRole.PARENT) {
      if (!dto.phone) {
        throw new BadRequestException(
          'phone is required for parent accounts',
        );
      }
      const parent = await this.findOrCreateParent({
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        schoolId: dto.schoolId as string,
      });
      return { user: this.sanitize(parent) };
    }

    if (!dto.email) {
      throw new BadRequestException('email is required for this role');
    }
    if (dto.email) {
      const exists = await this.userModel.exists({
        email: dto.email.toLowerCase(),
      });
      if (exists) {
        throw new ConflictException('Email already in use');
      }
    }

    // Password given → active immediately. Password omitted → invite flow:
    // create the account inactive and email a set-password link.
    if (dto.password) {
      const password = await bcrypt.hash(dto.password, SALT_ROUNDS);
      const created = await this.userModel.create({ ...dto, password });
      return { user: this.sanitize(created) };
    }

    const { rawToken, hash, expiresAt } = this.generateInvite();
    const created = await this.userModel.create({
      ...dto,
      password: null,
      isActive: false,
      invitationTokenHash: hash,
      invitationExpiresAt: expiresAt,
    });
    const inviteUrl = this.mail.buildInviteUrl(rawToken);
    const invited = created.email
      ? await this.mail.sendAdminInvite(created.email, created.name, inviteUrl)
      : false;
    return { user: this.sanitize(created), inviteUrl, invited };
  }

  // ── Invitation onboarding ───────────────────────────────

  private generateInvite(): {
    rawToken: string;
    hash: string;
    expiresAt: Date;
  } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const hours = this.config.get<number>('app.inviteTtlHours') ?? 72;
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000);
    return { rawToken, hash, expiresAt };
  }

  /** Finds the pending account for a valid, unexpired invite token. */
  findByInvitationToken(rawToken: string): Promise<UserDocument | null> {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return this.userModel
      .findOne({
        invitationTokenHash: hash,
        invitationExpiresAt: { $gt: new Date() },
      })
      .exec();
  }

  /** Sets the password on an invited account and activates it. */
  async activateWithPassword(
    userId: string,
    password: string,
  ): Promise<void> {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await this.userModel
      .findByIdAndUpdate(userId, {
        password: hashed,
        isActive: true,
        invitationTokenHash: null,
        invitationExpiresAt: null,
      })
      .exec();
  }

  // ── Forgot / reset password (credential accounts) ───────

  /**
   * Finds the active credential account eligible for a self-service password
   * reset. Excluded roles:
   *   - PARENT — logs in with an OTP, has no password to reset.
   *   - SUPER_ADMIN — the platform owner account. Its password is managed by
   *     developers (the SUPER_ADMIN_PASSWORD seed / a direct DB change), never
   *     over an emailed link, so it must not be resettable through this flow
   *     even by someone who controls its inbox.
   *
   * Pending invites (isActive=false, no password yet) are excluded too: those
   * onboard through their invite link, not a reset. Includes the name so the
   * reset email can greet the user.
   */
  findActiveCredentialByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        email: email.toLowerCase(),
        role: { $nin: [UserRole.PARENT, UserRole.SUPER_ADMIN] },
        isActive: true,
      })
      .exec();
  }

  /** Stores the hashed single-use reset token + expiry. */
  async setPasswordReset(
    userId: string,
    hash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        passwordResetTokenHash: hash,
        passwordResetExpiresAt: expiresAt,
      })
      .exec();
  }

  /** Clears a reset token (used, expired, or abandoned). */
  async clearPasswordReset(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      })
      .exec();
  }

  /** Finds the account for a valid, unexpired reset token. */
  findByPasswordResetToken(rawToken: string): Promise<UserDocument | null> {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return this.userModel
      .findOne({
        passwordResetTokenHash: hash,
        passwordResetExpiresAt: { $gt: new Date() },
      })
      .exec();
  }

  /**
   * Sets a new password from a reset, clears the reset token, and ends every
   * signed-in session. A forgotten password may mean the account was
   * compromised, so recovery signs the other devices out rather than leaving
   * whoever holds them logged in.
   */
  async resetPasswordWithToken(
    userId: string,
    password: string,
  ): Promise<void> {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await this.userModel
      .findByIdAndUpdate(userId, {
        password: hashed,
        isActive: true,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        refreshSessions: [],
      })
      .exec();
  }

  // ── Phone-OTP login (parents) ───────────────────────────

  /** Finds an active account by phone for a given role (used by OTP login). */
  findActiveByPhoneForRole(
    phone: string,
    role: UserRole,
  ): Promise<UserDocument | null> {
    // Accounts store the canonical +91XXXXXXXXXX form. Sorted newest-first as
    // a tiebreaker for legacy duplicates predating the one-phone-one-school rule.
    const canonical = normalizeIndianPhone(phone) ?? phone;
    return this.userModel
      .findOne({ phone: canonical, role, isActive: true })
      .sort({ createdAt: -1 })
      .select('+otpHash')
      .exec();
  }

  /**
   * Finds an active account by email for a given role (used by email-OTP login).
   *
   * TEMPORARY: parents log in by email while the WhatsApp OTP provider is down;
   * see the phone-OTP variant above, kept for when it is restored.
   */
  findActiveByEmailForRole(
    email: string,
    role: UserRole,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase(), role, isActive: true })
      .sort({ createdAt: -1 })
      .select('+otpHash')
      .exec();
  }

  /** Stores the hashed one-time code + expiry and resets the attempt counter. */
  async setOtp(userId: string, hash: string, expiresAt: Date): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        otpHash: hash,
        otpExpiresAt: expiresAt,
        otpAttempts: 0,
      })
      .exec();
  }

  /** Clears the one-time code after a successful (or exhausted) verification. */
  async clearOtp(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      })
      .exec();
  }

  /** Bumps the failed-attempt counter, returning the new value. */
  async incrementOtpAttempts(userId: string): Promise<number> {
    const doc = await this.userModel
      .findByIdAndUpdate(userId, { $inc: { otpAttempts: 1 } }, { new: true })
      .select('otpAttempts')
      .exec();
    return doc?.otpAttempts ?? 0;
  }

  /**
   * Returns the parent account for this phone within a school, creating one
   * (no password, active) if it does not exist yet. Used when an admin adds a
   * student and enters the parent's details.
   *
   * The parent's `email` is their login identity while phone/WhatsApp OTP is
   * disabled: it is stored on create and backfilled on an existing account (so
   * a sibling added later can update a stale one). Kept optional here so other
   * internal callers still work; the admin student-creation flow requires it.
   */
  async findOrCreateParent(params: {
    name: string;
    phone: string;
    email?: string;
    schoolId: string;
  }): Promise<UserDocument> {
    const phone = normalizeIndianPhone(params.phone);
    if (!phone) {
      throw new BadRequestException(
        'parentPhone must be a valid Indian mobile number',
      );
    }
    const email = params.email?.trim().toLowerCase() || undefined;

    // A phone still keys the parent account, so it resolves to exactly one
    // record. Reuse it for siblings in the same school; refuse it when it
    // already belongs to a parent of a different school.
    const existing = await this.userModel
      .findOne({ phone, role: UserRole.PARENT })
      .exec();
    if (existing) {
      if (String(existing.schoolId) !== String(params.schoolId)) {
        throw new ConflictException(
          'This phone number is already registered as a parent at another school',
        );
      }
      // Keep the login email current — a later sibling can supply/correct it.
      if (email && existing.email !== email) {
        await this.assertEmailFree(email, String(existing._id));
        existing.email = email;
        await existing.save();
      }
      return existing;
    }

    if (email) {
      await this.assertEmailFree(email);
    }
    return this.userModel.create({
      name: params.name,
      phone,
      email,
      role: UserRole.PARENT,
      schoolId: params.schoolId,
      password: null,
      isActive: true,
    });
  }

  /** Rejects an email already in use by a different account (unique index). */
  private async assertEmailFree(email: string, exceptId?: string): Promise<void> {
    const clash = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('_id')
      .exec();
    if (clash && String(clash._id) !== exceptId) {
      throw new ConflictException('This email is already registered');
    }
  }

  /** Neutralises regex metacharacters so a search for "a.b" stays literal. */
  private escapeRegex(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async findAll(
    page = 1,
    limit = 20,
    schoolId: string | null = null,
    excludeRoles: UserRole[] = [],
    roles: UserRole[] = [],
    search?: string,
  ): Promise<PaginatedResult<User>> {
    const filter: FilterQuery<UserDocument> = scopeFilter({}, schoolId);
    // `role` and `excludeRole` are both honoured, and `role` is the narrower
    // of the two, so it wins where they overlap. Filtering here rather than in
    // the client is what keeps `total` and the page counts honest.
    if (roles.length > 0) {
      filter.role = { $in: roles };
    } else if (excludeRoles.length > 0) {
      filter.role = { $nin: excludeRoles };
    }
    if (search) {
      const rx = new RegExp(this.escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.userModel.find(filter).skip(skip).limit(limit).exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /** Active admin/principal user ids for a school — recipients for admin-facing alerts. */
  async findProfileAdminsForSchool(schoolId: string): Promise<string[]> {
    const docs = await this.userModel
      .find({
        schoolId: new Types.ObjectId(schoolId),
        role: { $in: [UserRole.ADMIN, UserRole.PRINCIPAL] },
        isActive: true,
      })
      .select('_id')
      .exec();
    return docs.map((d) => String(d._id));
  }

  /** Active user ids for a school in the given roles — school-wide announcements. */
  async findUserIdsForSchoolByRoles(
    schoolId: string,
    roles: UserRole[],
  ): Promise<string[]> {
    const docs = await this.userModel
      .find({
        schoolId: new Types.ObjectId(schoolId),
        role: { $in: roles },
        isActive: true,
      })
      .select('_id')
      .exec();
    return docs.map((d) => String(d._id));
  }

  /** Active users for a school in the given roles, with the fields a chat
   *  contact list needs. Sorted by name so the picker is stable. */
  async findForSchoolByRoles(
    schoolId: string,
    roles: UserRole[],
  ): Promise<User[]> {
    return this.userModel
      .find({
        schoolId: new Types.ObjectId(schoolId),
        role: { $in: roles },
        isActive: true,
      })
      .select('_id name role email')
      .sort({ name: 1 })
      .exec();
  }

  /**
   * Narrows `userIds` to the accounts that still want `pref` (one of
   * {@link UsersService.DEFAULT_PREFS}) and are active. Accounts predating the
   * field have no `notificationPrefs`, so absence counts as opted in — the same
   * rule {@link getNotificationPrefs} applies.
   */
  async filterByNotificationPref(
    userIds: string[],
    pref: string,
  ): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }
    const docs = await this.userModel
      .find({
        _id: { $in: userIds.map((id) => new Types.ObjectId(id)) },
        isActive: true,
        [`notificationPrefs.${pref}`]: { $ne: false },
      })
      .select('_id')
      .exec();
    return docs.map((d) => String(d._id));
  }

  async countByRoleForSchool(
    schoolId: string,
  ): Promise<Record<string, number>> {
    const rows = await this.userModel
      .aggregate<{ _id: string; count: number }>([
        { $match: { schoolId: new Types.ObjectId(schoolId) } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ])
      .exec();
    const byRole: Record<string, number> = {};
    for (const row of rows) byRole[row._id] = row.count;
    return byRole;
  }

  async findOne(id: string, schoolId: string | null = null): Promise<User> {
    const doc = await this.userModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!doc) {
      throw new NotFoundException('User not found');
    }
    return doc;
  }

  /** Includes the password hash — used by the auth layer only. */
  findByEmailWithSecret(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+password')
      .exec();
  }

  /** Includes the signed-in devices — used by the refresh/logout flow only. */
  findByIdWithSessions(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+refreshSessions').exec();
  }

  /**
   * A user editing their own account.
   *
   * Separate from {@link update} on purpose: this can only ever touch name and
   * phone, so no future change to `UpdateUserDto` can widen what a user may do
   * to themselves. Self-service must never reach role, schoolId or password.
   */
  async updateOwnProfile(
    id: string,
    dto: { name?: string; phone?: string },
  ): Promise<User> {
    const patch: Record<string, string> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.phone !== undefined) patch.phone = dto.phone;

    const doc = await this.userModel
      .findByIdAndUpdate(id, patch, { new: true })
      .exec();
    if (!doc) {
      throw new NotFoundException('User not found');
    }
    return doc;
  }

  /**
   * Administrative edit of another account.
   *
   * The patch is built field by field rather than spread from the DTO: a
   * spread writes whatever the caller sent, so any property that later joins
   * the DTO — or simply slips past validation — would land in the document.
   * `role` and `schoolId` are handled by the caller's own guarded routes and
   * are deliberately not settable here.
   */
  async update(
    id: string,
    dto: UpdateUserDto,
    schoolId: string | null = null,
  ): Promise<User> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.email !== undefined) patch.email = dto.email.toLowerCase();
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    if (dto.password) {
      patch.password = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }
    const doc = await this.userModel
      .findOneAndUpdate(scopeFilter({ _id: id }, schoolId), patch, {
        new: true,
      })
      .exec();
    if (!doc) {
      throw new NotFoundException('User not found');
    }
    return doc;
  }

  // ── Refresh sessions (one per signed-in device) ─────────

  /** Registers a new device, evicting the oldest once the cap is reached. */
  async addRefreshSession(
    id: string,
    session: RefreshSession,
    maxSessions: number,
  ): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        $push: {
          refreshSessions: {
            $each: [session],
            // Negative slice keeps the newest `maxSessions` entries.
            $slice: -Math.max(1, maxSessions),
          },
        },
      })
      .exec();
  }

  /** Swaps in the token just issued to a device, keeping the previous one
   *  usable until `prevValidUntil` so an in-flight refresh can't strand it. */
  async rotateRefreshSession(
    id: string,
    sid: string,
    next: { hash: string; prevHash: string; prevValidUntil: Date },
  ): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: id, 'refreshSessions.sid': sid },
        {
          $set: {
            'refreshSessions.$.hash': next.hash,
            'refreshSessions.$.prevHash': next.prevHash,
            'refreshSessions.$.prevValidUntil': next.prevValidUntil,
            'refreshSessions.$.lastUsedAt': new Date(),
          },
        },
      )
      .exec();
  }

  /** Ends one device's session (logout). */
  async removeRefreshSession(id: string, sid: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { $pull: { refreshSessions: { sid } } })
      .exec();
  }

  /** Ends every device's session (logout without a refresh token, deactivation). */
  async clearRefreshSessions(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { $set: { refreshSessions: [] } })
      .exec();
  }

  /** Ends every session for every account at a school — used when a school is
   *  suspended, so its users are logged out on their next request/refresh
   *  rather than only once their access token expires. */
  async clearSessionsForSchool(schoolId: string): Promise<void> {
    await this.userModel
      .updateMany(
        { schoolId: new Types.ObjectId(schoolId) },
        { $set: { refreshSessions: [] } },
      )
      .exec();
  }

  async markLogin(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { lastLoginAt: new Date() })
      .exec();
  }

  // ── Device tokens (push notifications) ──────────────────

  /**
   * Registers a device against this user.
   *
   * The token identifies an app install, not a person, so it is first pulled
   * off *every* account. Without that, a phone handed from one parent to another
   * (or a teacher signing in on a shared school tablet) would keep delivering
   * the previous user's notifications to the new one.
   */
  async addDeviceToken(
    userId: string,
    token: string,
    platform: 'android' | 'ios',
  ): Promise<void> {
    await this.userModel
      .updateMany({ 'deviceTokens.token': token }, {
        $pull: { deviceTokens: { token } },
      })
      .exec();
    await this.userModel
      .findByIdAndUpdate(userId, {
        $push: { deviceTokens: { token, platform, updatedAt: new Date() } },
      })
      .exec();
  }

  /** Unregisters one device (logout on that device). */
  async removeDeviceToken(userId: string, token: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { $pull: { deviceTokens: { token } } })
      .exec();
  }

  /** Every device token for the given users — the addresses a push is sent to. */
  async findDeviceTokens(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }
    const docs = await this.userModel
      .find({
        _id: { $in: userIds.map((id) => new Types.ObjectId(id)) },
        isActive: true,
      })
      .select('+deviceTokens')
      .exec();
    return docs.flatMap((d) => (d.deviceTokens ?? []).map((t) => t.token));
  }

  /**
   * Drops tokens FCM has told us are dead (app uninstalled, token replaced).
   * Left alone, they accumulate and every send wastes a request on each one.
   */
  async pruneDeviceTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) {
      return;
    }
    await this.userModel
      .updateMany(
        { 'deviceTokens.token': { $in: tokens } },
        { $pull: { deviceTokens: { token: { $in: tokens } } } },
      )
      .exec();
  }

  // ── Notification preferences (P7) ────────────────────────

  private static readonly DEFAULT_PREFS: Record<string, boolean> = {
    feeReminders: true,
    attendanceAlerts: true,
    homeworkNotifications: true,
    eventReminders: true,
    messageNotifications: true,
  };

  /** Reminder opt-ins, defaulted to on for accounts predating the field. */
  async getNotificationPrefs(
    userId: string,
  ): Promise<Record<string, boolean>> {
    const doc = await this.userModel
      .findById(userId)
      .select('notificationPrefs')
      .exec();
    if (!doc) {
      throw new NotFoundException('User not found');
    }
    // `notificationPrefs` is a nested subdocument, so Mongoose hands back every
    // declared key — including the ones never set, as `undefined`. A plain
    // spread copies those over the defaults and JSON then drops them, which is
    // how this endpoint came to answer `{}` for everybody. Only real booleans
    // may override a default.
    const stored = doc.notificationPrefs ?? {};
    const prefs = { ...UsersService.DEFAULT_PREFS };
    for (const key of Object.keys(UsersService.DEFAULT_PREFS)) {
      const value = (stored as Record<string, boolean | undefined>)[key];
      if (typeof value === 'boolean') prefs[key] = value;
    }
    return prefs;
  }

  async updateNotificationPrefs(
    userId: string,
    dto: UpdateNotificationPrefsDto,
  ): Promise<Record<string, boolean>> {
    const next = await this.getNotificationPrefs(userId);
    for (const key of Object.keys(UsersService.DEFAULT_PREFS)) {
      const v = (dto as Record<string, boolean | undefined>)[key];
      if (v !== undefined) next[key] = v;
    }
    await this.userModel
      .findByIdAndUpdate(userId, { notificationPrefs: next })
      .exec();
    return next;
  }

  async remove(id: string, schoolId: string | null = null): Promise<void> {
    const res = await this.userModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) {
      throw new NotFoundException('User not found');
    }
  }

  private sanitize(doc: UserDocument): User {
    const obj = doc.toObject() as unknown as Record<string, unknown>;
    delete obj.password;
    delete obj.refreshSessions;
    delete obj.deviceTokens;
    return obj as unknown as User;
  }
}
