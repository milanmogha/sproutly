import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { SchoolStatus } from '../../common/enums/school-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import {
  Student,
  StudentDocument,
} from '../students/schemas/student.schema';
import { School, SchoolDocument } from './schemas/school.schema';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { UpdateMySchoolDto } from './dto/update-my-school.dto';
import { QuerySchoolsDto } from './dto/query-schools.dto';
import { CreateSchoolAdminDto } from './dto/create-school-admin.dto';
import { SetPaymentGatewayDto } from './dto/payment-gateway.dto';
import {
  decryptSecret,
  encryptSecret,
} from '../../common/utils/crypto.util';

export interface SchoolStats {
  total: number;
  byStatus: Record<string, number>;
}

/** What the console may see about a school's gateway — never the secrets. */
export interface PaymentGatewayStatus {
  provider: string;
  keyId: string | null;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  enabled: boolean;
  updatedAt: Date | null;
}

export interface SchoolOverview {
  school: School;
  students: number;
  usersByRole: Record<string, number>;
}

/** What a delete erased, per collection — non-zero counts only. */
export interface SchoolDeletion {
  deleted: true;
  school: string;
  removed: Record<string, number>;
}

@Injectable()
export class SchoolsService {
  constructor(
    @InjectModel(School.name)
    private readonly schoolModel: Model<SchoolDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    private readonly usersService: UsersService,
    // The cascade sweeps every collection rather than a hand-listed set — see
    // `remove`.
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async create(
    dto: CreateSchoolDto,
  ): Promise<School & { adminInviteUrl?: string; adminInvited?: boolean }> {
    const nameExists = await this.schoolModel.exists({ name: dto.name });
    if (nameExists) {
      throw new ConflictException('A school with this name already exists');
    }

    let code: string;
    if (dto.code) {
      code = dto.code.toUpperCase();
      const codeExists = await this.schoolModel.exists({ code });
      if (codeExists) {
        throw new ConflictException('A school with this code already exists');
      }
    } else {
      code = await this.uniqueCode(this.slugify(dto.name).toUpperCase());
    }

    const { admin, ...schoolFields } = dto;
    const school = await this.schoolModel.create({ ...schoolFields, code });

    // The school IS its admin — bootstrap the login account alongside it.
    // With no password, the admin is emailed a set-password invite link.
    if (admin) {
      const result = await this.usersService.create({
        ...admin,
        role: UserRole.ADMIN,
        schoolId: String(school._id),
      });
      if (result.inviteUrl) {
        const obj = school.toObject() as School & {
          adminInviteUrl?: string;
          adminInvited?: boolean;
        };
        obj.adminInviteUrl = result.inviteUrl;
        obj.adminInvited = result.invited ?? false;
        return obj;
      }
    }
    return school;
  }

  async findAll(query: QuerySchoolsDto): Promise<PaginatedResult<School>> {
    const { page = 1, limit = 20, status, search, ownerId } = query;

    const filter: FilterQuery<SchoolDocument> = {};
    if (status) filter.status = status;
    if (search) {
      const rx = new RegExp(this.escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { code: rx }];
    }
    // `none` is how the console asks for schools not yet linked to an owner.
    if (ownerId === 'none') filter.ownerId = null;
    else if (ownerId) filter.ownerId = new Types.ObjectId(ownerId);

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.schoolModel
        .find(filter)
        // The owner's name travels with the row so the list can show which
        // branches belong together without a request per school.
        .populate('ownerId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.schoolModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async stats(): Promise<SchoolStats> {
    const [total, grouped] = await Promise.all([
      this.schoolModel.countDocuments().exec(),
      this.schoolModel
        .aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const byStatus: Record<string, number> = {};
    for (const status of Object.values(SchoolStatus)) {
      byStatus[status] = 0;
    }
    for (const row of grouped) {
      byStatus[row._id] = row.count;
    }

    return { total, byStatus };
  }

  async findOne(id: string): Promise<School> {
    const school = await this.schoolModel
      .findById(id)
      .populate('ownerId', 'name')
      .exec();
    if (!school) {
      throw new NotFoundException('School not found');
    }
    return school;
  }

  /** Trimmed contact card any signed-in user may read for their own school. */
  async contactInfo(schoolId: string | null): Promise<{
    id: string;
    name: string;
    code: string;
    contactEmail: string | null;
    contactPhone: string | null;
    address: Record<string, string> | null;
    currentAcademicYear: string | null;
    trustName: string | null;
    website: string | null;
    affiliationNumber: string | null;
    onlinePaymentsEnabled: boolean;
  }> {
    if (!schoolId) {
      throw new NotFoundException('No school associated with this account');
    }
    const s = await this.findOne(schoolId);
    return {
      id: schoolId,
      name: s.name,
      code: s.code,
      contactEmail: s.contactEmail ?? null,
      contactPhone: s.contactPhone ?? null,
      address: s.address ?? null,
      currentAcademicYear: s.currentAcademicYear ?? null,
      // The letterhead printed on this school's fee receipts.
      trustName: s.trustName ?? null,
      website: s.website ?? null,
      affiliationNumber: s.affiliationNumber ?? null,
      // Lets the parent app decide whether to offer "Pay now" at all, rather
      // than finding out from a failed checkout. Just the flag — the keys
      // themselves stay super-admin-only.
      onlinePaymentsEnabled: s.paymentGateway?.enabled ?? false,
    };
  }

  /** An admin edits their OWN school's profile (name/contact/address/year).
   *  schoolId comes from the caller's token, so they can't touch others. */
  async updateMine(
    schoolId: string | null,
    dto: UpdateMySchoolDto,
  ): Promise<School> {
    if (!schoolId) {
      throw new NotFoundException('No school associated with this account');
    }
    const school = await this.schoolModel
      .findByIdAndUpdate(schoolId, dto, { new: true, runValidators: true })
      .exec();
    if (!school) {
      throw new NotFoundException('School not found');
    }
    return school;
  }

  /** Everything the super admin needs on one school's detail page. */
  async overview(id: string): Promise<SchoolOverview> {
    const school = await this.findOne(id);
    const [students, usersByRole] = await Promise.all([
      this.studentModel.countDocuments({ schoolId: id }).exec(),
      this.usersService.countByRoleForSchool(id),
    ]);
    return { school, students, usersByRole };
  }

  async update(id: string, dto: UpdateSchoolDto): Promise<School> {
    const school = await this.schoolModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!school) {
      throw new NotFoundException('School not found');
    }
    return school;
  }

  /**
   * Suspends a school: blocks every account under it from signing in or
   * refreshing (enforced in AuthService), and clears their live sessions so the
   * lock-out takes hold immediately rather than only when access tokens expire.
   * Reversible via {@link reactivate}. A removed (soft-deleted) school can't be
   * suspended — it's already out of service.
   */
  async suspend(id: string): Promise<School> {
    const school = await this.findOne(id);
    if (!school.isActive || school.status === SchoolStatus.INACTIVE) {
      throw new BadRequestException('This school has been removed.');
    }
    if (school.status === SchoolStatus.SUSPENDED) {
      return school; // Already suspended — nothing to do.
    }
    const updated = await this.schoolModel
      .findByIdAndUpdate(id, { status: SchoolStatus.SUSPENDED }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('School not found');
    }
    // Log everyone out; combined with the login/refresh block, access ends now.
    await this.usersService.clearSessionsForSchool(id);
    return updated;
  }

  /** Lifts a suspension, returning the school to active. Only a suspended
   *  school can be reactivated — a removed one stays removed. */
  async reactivate(id: string): Promise<School> {
    const school = await this.findOne(id);
    if (school.status !== SchoolStatus.SUSPENDED) {
      throw new BadRequestException(
        'Only a suspended school can be reactivated.',
      );
    }
    const updated = await this.schoolModel
      .findByIdAndUpdate(id, { status: SchoolStatus.ACTIVE }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('School not found');
    }
    return updated;
  }

  /** True if the school is currently suspended. Cheap lookup used by the auth
   *  layer on login and token refresh. */
  async isSuspended(schoolId: string): Promise<boolean> {
    const s = await this.schoolModel
      .findById(schoolId)
      .select('status')
      .lean()
      .exec();
    return s?.status === SchoolStatus.SUSPENDED;
  }

  /** Soft-delete only — users/students/etc reference schoolId, never hard-delete. */
  /**
   * Permanently deletes a school and everything scoped to it.
   *
   * Every collection carrying a `schoolId` is swept, discovered at runtime
   * rather than from a hand-maintained list — a list would silently rot the
   * first time a module is added, leaving that data orphaned and invisible.
   *
   * Order matters: the children go first and the school document last. This
   * database is a standalone (no multi-document transactions), so a failure
   * part-way through has to fail *safe* — with the school still listed, the
   * operator sees it and can retry. Deleting the school first would strand its
   * data with nothing left pointing at it.
   */
  async remove(id: string): Promise<SchoolDeletion> {
    const school = await this.schoolModel.findById(id).exec();
    if (!school) {
      throw new NotFoundException('School not found');
    }

    const oid = new Types.ObjectId(id);
    // Match both shapes: the schemas declare an ObjectId, but a stray string
    // would be invisible to an ObjectId-only filter and survive the delete.
    const scoped = { schoolId: { $in: [oid, id] } };

    const removed: Record<string, number> = {};
    const db = this.connection.db;
    if (!db) {
      throw new BadRequestException('Database connection is not ready');
    }
    const collections = await db.collections();
    for (const collection of collections) {
      if (collection.collectionName === 'schools') {
        continue;
      }
      const { deletedCount } = await collection.deleteMany(scoped);
      if (deletedCount) {
        removed[collection.collectionName] = deletedCount;
      }
    }

    await this.schoolModel.findByIdAndDelete(id).exec();
    return { deleted: true, school: school.name, removed };
  }

  // ── Payment gateway (super admin only) ──────────────────

  /**
   * Stores a school's own Razorpay credentials. Secrets are write-only: an
   * omitted `keySecret` / `webhookSecret` keeps whatever is already stored, so
   * the super admin can flip `enabled` or fix a typo'd `keyId` without having
   * to ask the school for its secrets again.
   */
  async setPaymentGateway(
    id: string,
    dto: SetPaymentGatewayDto,
  ): Promise<PaymentGatewayStatus> {
    const school = await this.findOne(id);
    const existing = (school as SchoolDocument).paymentGateway;

    const keySecret = dto.keySecret
      ? encryptSecret(dto.keySecret)
      : (existing?.keySecret ?? null);
    const webhookSecret = dto.webhookSecret
      ? encryptSecret(dto.webhookSecret)
      : (existing?.webhookSecret ?? null);

    if (!keySecret) {
      throw new BadRequestException(
        'keySecret is required the first time a gateway is configured',
      );
    }

    // Turning it on without a webhook secret would mean payments can start but
    // never be confirmed — the webhook is what marks an invoice paid.
    const enabled = dto.enabled ?? existing?.enabled ?? false;
    if (enabled && !webhookSecret) {
      throw new BadRequestException(
        'webhookSecret is required before the gateway can be enabled',
      );
    }

    const updated = await this.schoolModel
      .findByIdAndUpdate(
        id,
        {
          paymentGateway: {
            provider: 'razorpay',
            keyId: dto.keyId,
            keySecret,
            webhookSecret,
            enabled,
            updatedAt: new Date(),
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('School not found');
    return this.paymentGatewayStatus(id, updated);
  }

  /** Forgets a school's credentials entirely. */
  async clearPaymentGateway(id: string): Promise<PaymentGatewayStatus> {
    const updated = await this.schoolModel
      .findByIdAndUpdate(id, { paymentGateway: null }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('School not found');
    return this.paymentGatewayStatus(id, updated);
  }

  /**
   * What the console shows: whether it's set up, the public key id, and
   * whether the secrets exist — never the secrets themselves.
   */
  async paymentGatewayStatus(
    id: string,
    preloaded?: SchoolDocument,
  ): Promise<PaymentGatewayStatus> {
    const school = preloaded ?? (await this.schoolModel.findById(id).exec());
    if (!school) throw new NotFoundException('School not found');
    const gateway = school.paymentGateway;
    return {
      provider: gateway?.provider ?? 'razorpay',
      keyId: gateway?.keyId ?? null,
      hasKeySecret: Boolean(gateway?.keySecret),
      hasWebhookSecret: Boolean(gateway?.webhookSecret),
      enabled: gateway?.enabled ?? false,
      updatedAt: gateway?.updatedAt ?? null,
    };
  }

  /**
   * Decrypted credentials for *taking* a payment. Throws when the school
   * can't accept one, so callers don't have to re-check.
   */
  async paymentCredentials(schoolId: string): Promise<{
    keyId: string;
    keySecret: string;
    webhookSecret: string;
  }> {
    const creds = await this.storedCredentials(schoolId);
    if (!creds?.enabled || !creds.keyId || !creds.keySecret) {
      throw new BadRequestException(
        'This school is not set up for online payments',
      );
    }
    return {
      keyId: creds.keyId,
      keySecret: creds.keySecret,
      webhookSecret: creds.webhookSecret,
    };
  }

  /**
   * Credentials as stored, **ignoring whether the gateway is switched on**.
   *
   * Webhooks must use this rather than {@link paymentCredentials}: a school
   * that pauses online payments while a payment is mid-flight would otherwise
   * make the callback fail, and Razorpay would retry a payment that can never
   * settle even though the money moved. Verification has to keep working for
   * as long as the secret exists.
   */
  async storedCredentials(schoolId: string): Promise<{
    keyId: string | null;
    keySecret: string;
    webhookSecret: string;
    enabled: boolean;
  } | null> {
    const school = await this.schoolModel.findById(schoolId).exec();
    if (!school) return null;
    const gateway = school.paymentGateway;
    if (!gateway) return null;
    return {
      keyId: gateway.keyId ?? null,
      keySecret: gateway.keySecret ? decryptSecret(gateway.keySecret) : '',
      webhookSecret: gateway.webhookSecret
        ? decryptSecret(gateway.webhookSecret)
        : '',
      enabled: gateway.enabled,
    };
  }

  /** Bootstraps an admin account for a school — the super-admin-only path to onboard a school. */
  async createAdmin(schoolId: string, dto: CreateSchoolAdminDto) {
    await this.findOne(schoolId);
    return this.usersService.create({
      ...dto,
      role: UserRole.ADMIN,
      schoolId,
    });
  }

  /**
   * Auto-generated codes can collide after slug truncation ("Little Stars
   * School B" and "Little Stars School B2" both slug to LITSTASCHB) — append
   * a numeric suffix, keeping the total within 10 chars, until free.
   */
  private async uniqueCode(base: string): Promise<string> {
    let code = base;
    for (let n = 2; await this.schoolModel.exists({ code }); n++) {
      const suffix = String(n);
      code = `${base.slice(0, 10 - suffix.length)}${suffix}`;
    }
    return code;
  }

  private slugify(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .map((w) => w.slice(0, 3))
      .join('')
      .slice(0, 10);
  }

  private escapeRegex(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
