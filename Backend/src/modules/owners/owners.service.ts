import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { School, SchoolDocument } from '../schools/schemas/school.schema';
import {
  SubscriptionInvoice,
  SubscriptionInvoiceDocument,
  SubscriptionInvoiceStatus,
} from '../subscriptions/schemas/subscription-invoice.schema';
import {
  SubscriptionPhase,
  subscriptionState,
} from '../subscriptions/subscription-policy';
import { Owner, OwnerDocument } from './schemas/owner.schema';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { QueryOwnersDto } from './dto/query-owners.dto';

/** An owner in a list, with just enough to see the size of the customer. */
export interface OwnerSummary {
  owner: Owner;
  branches: number;
  /** How the branches' subscriptions stand, e.g. `{ active: 2, expiring: 1 }`. */
  phases: Partial<Record<SubscriptionPhase, number>>;
}

/** One branch on the owner's detail page. */
export interface OwnerBranch {
  school: School;
  phase: SubscriptionPhase;
  periodEnd: Date | null;
  daysRemaining: number | null;
}

export interface OwnerDetail {
  owner: Owner;
  branches: OwnerBranch[];
}

/**
 * Owners group a customer's branches for the super admin.
 *
 * Everything here is a read across schools, which is why it is super-admin
 * only (enforced on the controller): no school-scoped role may ever learn
 * about a sibling branch, and nothing in this module widens `scopeFilter`.
 */
@Injectable()
export class OwnersService {
  constructor(
    @InjectModel(Owner.name)
    private readonly ownerModel: Model<OwnerDocument>,
    @InjectModel(School.name)
    private readonly schoolModel: Model<SchoolDocument>,
    @InjectModel(SubscriptionInvoice.name)
    private readonly invoiceModel: Model<SubscriptionInvoiceDocument>,
  ) {}

  create(dto: CreateOwnerDto): Promise<Owner> {
    return this.ownerModel.create(dto);
  }

  /**
   * The owners list, each with its branch count and how those branches'
   * subscriptions stand.
   *
   * Built from a fixed number of queries rather than one per owner, for the
   * same reason `platformOverview` is: this page must not get slower as
   * customers are added.
   */
  async findAll(query: QueryOwnersDto): Promise<PaginatedResult<OwnerSummary>> {
    const { page = 1, limit = 20, search } = query;

    const filter: FilterQuery<OwnerDocument> = {};
    if (search) {
      const rx = new RegExp(this.escapeRegex(search), 'i');
      filter.$or = [
        { name: rx },
        { contactPerson: rx },
        { email: rx },
        { phone: rx },
      ];
    }

    const skip = (page - 1) * limit;
    const [owners, total] = await Promise.all([
      this.ownerModel
        .find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.ownerModel.countDocuments(filter).exec(),
    ]);

    const ownerIds = owners.map((o) => o._id as Types.ObjectId);
    const schools = await this.schoolModel
      .find({ ownerId: { $in: ownerIds } })
      .select('_id ownerId')
      .exec();
    const endBySchool = await this.periodEndBySchool(
      schools.map((s) => s._id as Types.ObjectId),
    );

    const counts = new Map<string, number>();
    const byOwner = new Map<
      string,
      Partial<Record<SubscriptionPhase, number>>
    >();
    for (const school of schools) {
      const key = String(school.ownerId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const { phase } = subscriptionState(
        endBySchool.get(String(school._id)) ?? null,
      );
      const phases = byOwner.get(key) ?? {};
      phases[phase] = (phases[phase] ?? 0) + 1;
      byOwner.set(key, phases);
    }

    return {
      data: owners.map((owner) => ({
        owner,
        branches: counts.get(String(owner._id)) ?? 0,
        phases: byOwner.get(String(owner._id)) ?? {},
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string): Promise<Owner> {
    const owner = await this.ownerModel.findById(this.objectId(id)).exec();
    if (!owner) throw new NotFoundException('Owner not found');
    return owner;
  }

  /** The owner plus every branch, each with where its subscription stands. */
  async detail(id: string): Promise<OwnerDetail> {
    const owner = await this.findOne(id);
    const schools = await this.schoolModel
      .find({ ownerId: this.objectId(id) })
      .sort({ name: 1 })
      .exec();
    const endBySchool = await this.periodEndBySchool(
      schools.map((s) => s._id as Types.ObjectId),
    );

    return {
      owner,
      branches: schools.map((school) => {
        const state = subscriptionState(
          endBySchool.get(String(school._id)) ?? null,
        );
        return {
          school,
          phase: state.phase,
          periodEnd: state.periodEnd,
          daysRemaining: state.daysRemaining,
        };
      }),
    };
  }

  async update(id: string, dto: UpdateOwnerDto): Promise<Owner> {
    const owner = await this.ownerModel
      .findByIdAndUpdate(this.objectId(id), dto, { new: true })
      .exec();
    if (!owner) throw new NotFoundException('Owner not found');
    return owner;
  }

  /**
   * Deleting an owner never deletes its schools — they are separate tenants
   * with their own admins, students and money. The branches are detached and
   * go back to being independent schools.
   */
  async remove(id: string): Promise<{ deleted: true; detached: number }> {
    const owner = await this.ownerModel
      .findByIdAndDelete(this.objectId(id))
      .exec();
    if (!owner) throw new NotFoundException('Owner not found');
    const res = await this.schoolModel
      .updateMany({ ownerId: this.objectId(id) }, { $set: { ownerId: null } })
      .exec();
    return { deleted: true, detached: res.modifiedCount };
  }

  /** Attaches existing schools to this owner. */
  async assignSchools(
    id: string,
    schoolIds: string[],
  ): Promise<{ assigned: number }> {
    await this.findOne(id);
    const ids = schoolIds.map((s) => this.objectId(s));
    const res = await this.schoolModel
      .updateMany(
        { _id: { $in: ids } },
        { $set: { ownerId: this.objectId(id) } },
      )
      .exec();
    return { assigned: res.modifiedCount };
  }

  /** Detaches one branch, leaving it an independent school again. */
  async detachSchool(
    id: string,
    schoolId: string,
  ): Promise<{ detached: true }> {
    const res = await this.schoolModel
      .updateOne(
        { _id: this.objectId(schoolId), ownerId: this.objectId(id) },
        { $set: { ownerId: null } },
      )
      .exec();
    if (res.matchedCount === 0) {
      throw new NotFoundException('That school is not one of this owner’s branches');
    }
    return { detached: true };
  }

  /**
   * End of each school's latest *paid* period, keyed by school id. One
   * aggregation for all the schools asked about — mirrors `platformOverview`,
   * which exists for the same "must not scale with rows" reason.
   */
  private async periodEndBySchool(
    schoolIds: Types.ObjectId[],
  ): Promise<Map<string, Date>> {
    if (schoolIds.length === 0) return new Map();

    const rows = await this.invoiceModel
      .aggregate<{ _id: Types.ObjectId; periodEnd: Date }>([
        {
          $match: {
            status: SubscriptionInvoiceStatus.PAID,
            schoolId: { $in: schoolIds },
          },
        },
        { $sort: { periodEnd: -1 } },
        { $group: { _id: '$schoolId', periodEnd: { $first: '$periodEnd' } } },
      ])
      .exec();

    return new Map(rows.map((r) => [String(r._id), r.periodEnd]));
  }

  private objectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(id);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
