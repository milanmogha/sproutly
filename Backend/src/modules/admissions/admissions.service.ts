import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { GuardianRelationship } from '../../common/enums/guardian-relationship.enum';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { StudentsService } from '../students/students.service';
import { Student } from '../students/schemas/student.schema';
import {
  Admission,
  AdmissionDocument,
  AdmissionStatus,
} from './schemas/admission.schema';
import {
  Inquiry,
  InquiryDocument,
  InquiryStatus,
} from './schemas/inquiry.schema';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { ConvertInquiryDto } from './dto/convert-inquiry.dto';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { UpdateAdmissionDto } from './dto/update-admission.dto';
import {
  QueryAdmissionsDto,
  QueryInquiriesDto,
} from './dto/query-admissions.dto';

export interface AdmissionStats {
  /** Applications, by their own status. */
  total: number;
  byStatus: Record<string, number>;
  /**
   * Inquiries, by theirs. The admissions screen is the inquiry list, so
   * without these its tiles had nothing to count — application statuses and
   * inquiry statuses are different vocabularies.
   */
  inquiries: {
    total: number;
    byStatus: Record<string, number>;
  };
}

@Injectable()
export class AdmissionsService {
  constructor(
    @InjectModel(Inquiry.name)
    private readonly inquiryModel: Model<InquiryDocument>,
    @InjectModel(Admission.name)
    private readonly admissionModel: Model<AdmissionDocument>,
    private readonly studentsService: StudentsService,
  ) {}

  // ── Inquiries ───────────────────────────────────────────

  createInquiry(
    dto: CreateInquiryDto,
    schoolId: string | null,
  ): Promise<Inquiry> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    return this.inquiryModel.create({ ...dto, schoolId });
  }

  async findInquiries(
    query: QueryInquiriesDto,
    schoolId: string | null,
  ): Promise<PaginatedResult<Inquiry>> {
    const { page = 1, limit = 20, status } = query;
    const filter: FilterQuery<InquiryDocument> = {};
    if (status) filter.status = status;
    scopeFilter(filter, schoolId);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.inquiryModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.inquiryModel.countDocuments(filter).exec(),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getInquiry(id: string, schoolId: string | null): Promise<Inquiry> {
    const doc = await this.inquiryModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!doc) throw new NotFoundException('Inquiry not found');
    return doc;
  }

  async updateInquiry(
    id: string,
    dto: UpdateInquiryDto,
    schoolId: string | null,
  ): Promise<Inquiry> {
    const patch: Record<string, unknown> = { ...dto };
    if (dto.followUpDate) patch.followUpDate = new Date(dto.followUpDate);
    if (dto.assignedTo) patch.assignedTo = new Types.ObjectId(dto.assignedTo);
    const doc = await this.inquiryModel
      .findOneAndUpdate(scopeFilter({ _id: id }, schoolId), patch, {
        new: true,
      })
      .exec();
    if (!doc) throw new NotFoundException('Inquiry not found');
    return doc;
  }

  async removeInquiry(id: string, schoolId: string | null): Promise<void> {
    const res = await this.inquiryModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) throw new NotFoundException('Inquiry not found');
  }

  /** Promotes an inquiry into a formal admission application. */
  async convertInquiry(
    id: string,
    dto: ConvertInquiryDto,
    schoolId: string | null,
  ): Promise<Admission> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const inquiry = await this.inquiryModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    if (!inquiry.childDateOfBirth || !inquiry.gender) {
      throw new BadRequestException(
        'Inquiry needs the child date of birth and gender before converting',
      );
    }

    const { firstName, lastName } = this.splitName(inquiry.childName);
    const admission = await this.admissionModel.create({
      schoolId,
      applicationNumber: await this.nextApplicationNumber(schoolId),
      firstName,
      lastName,
      dateOfBirth: inquiry.childDateOfBirth,
      gender: inquiry.gender,
      parentName: inquiry.parentName,
      parentPhone: inquiry.parentPhone,
      parentEmail: inquiry.parentEmail ?? null,
      classApplyingFor: dto.classApplyingFor
        ? new Types.ObjectId(dto.classApplyingFor)
        : null,
      academicYear: dto.academicYear,
      inquiry: inquiry._id,
      status: AdmissionStatus.APPLIED,
    });

    inquiry.status = InquiryStatus.CONVERTED;
    await inquiry.save();
    return admission;
  }

  // ── Admissions ──────────────────────────────────────────

  async createAdmission(
    dto: CreateAdmissionDto,
    schoolId: string | null,
  ): Promise<Admission> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    return this.admissionModel.create({
      schoolId,
      applicationNumber: await this.nextApplicationNumber(schoolId),
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: new Date(dto.dateOfBirth),
      gender: dto.gender,
      parentName: dto.parentName,
      parentPhone: dto.parentPhone,
      parentEmail: dto.parentEmail ?? null,
      classApplyingFor: dto.classApplyingFor
        ? new Types.ObjectId(dto.classApplyingFor)
        : null,
      academicYear: dto.academicYear,
      inquiry: dto.inquiry ? new Types.ObjectId(dto.inquiry) : null,
      status: AdmissionStatus.APPLIED,
    });
  }

  async findAdmissions(
    query: QueryAdmissionsDto,
    schoolId: string | null,
  ): Promise<PaginatedResult<Admission>> {
    const { page = 1, limit = 20, status } = query;
    const filter: FilterQuery<AdmissionDocument> = {};
    if (status) filter.status = status;
    scopeFilter(filter, schoolId);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.admissionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.admissionModel.countDocuments(filter).exec(),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getAdmission(
    id: string,
    schoolId: string | null,
  ): Promise<Admission> {
    const doc = await this.admissionModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!doc) throw new NotFoundException('Admission not found');
    return doc;
  }

  /** Records an approval-workflow decision. */
  async decide(
    id: string,
    dto: UpdateAdmissionDto,
    schoolId: string | null,
  ): Promise<Admission> {
    const admission = await this.admissionModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!admission) throw new NotFoundException('Admission not found');
    if (admission.status === AdmissionStatus.ENROLLED) {
      throw new BadRequestException('Enrolled applications cannot be changed');
    }

    admission.status = dto.status;
    admission.reviewNotes = dto.reviewNotes ?? admission.reviewNotes ?? null;
    admission.decisionDate = new Date();
    admission.waitlistPosition =
      dto.status === AdmissionStatus.WAITLISTED
        ? (dto.waitlistPosition ?? null)
        : null;
    await admission.save();
    return admission;
  }

  waitlist(schoolId: string | null): Promise<Admission[]> {
    return this.admissionModel
      .find(scopeFilter({ status: AdmissionStatus.WAITLISTED }, schoolId))
      .sort({ waitlistPosition: 1, createdAt: 1 })
      .exec();
  }

  /** Enrolls an approved application, creating the Student record. */
  async enroll(
    id: string,
    schoolId: string | null,
  ): Promise<{ admission: Admission; student: Student }> {
    const admission = await this.admissionModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!admission) throw new NotFoundException('Admission not found');
    if (admission.status !== AdmissionStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved applications can be enrolled',
      );
    }

    const student = await this.studentsService.create(
      {
        firstName: admission.firstName,
        lastName: admission.lastName,
        dateOfBirth: admission.dateOfBirth.toISOString(),
        gender: admission.gender,
        classId: admission.classApplyingFor
          ? admission.classApplyingFor.toString()
          : undefined,
        guardians: [
          {
            name: admission.parentName,
            relationship: GuardianRelationship.GUARDIAN,
            phone: admission.parentPhone,
            email: admission.parentEmail ?? undefined,
            isPrimary: true,
          },
        ],
      },
      schoolId,
    );

    admission.student = new Types.ObjectId(
      String((student as unknown as { _id: Types.ObjectId })._id),
    );
    admission.status = AdmissionStatus.ENROLLED;
    await admission.save();

    return { admission, student };
  }

  async stats(schoolId: string | null): Promise<AdmissionStats> {
    const matchStage = schoolId
      ? [{ $match: { schoolId: new Types.ObjectId(schoolId) } }]
      : [];
    const [total, grouped, inquiryTotal, inquiryGrouped] = await Promise.all([
      this.admissionModel.countDocuments(scopeFilter({}, schoolId)).exec(),
      this.admissionModel
        .aggregate<{ _id: string; count: number }>([
          ...matchStage,
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
      this.inquiryModel.countDocuments(scopeFilter({}, schoolId)).exec(),
      this.inquiryModel
        .aggregate<{ _id: string; count: number }>([
          ...matchStage,
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);
    const byStatus: Record<string, number> = {};
    for (const s of Object.values(AdmissionStatus)) byStatus[s] = 0;
    for (const row of grouped) byStatus[row._id] = row.count;

    // Every status is seeded to zero so a screen can render a full set of
    // tiles without checking which ones happen to exist today.
    const inquiryByStatus: Record<string, number> = {};
    for (const s of Object.values(InquiryStatus)) inquiryByStatus[s] = 0;
    for (const row of inquiryGrouped) inquiryByStatus[row._id] = row.count;

    return {
      total,
      byStatus,
      inquiries: { total: inquiryTotal, byStatus: inquiryByStatus },
    };
  }

  // ── helpers ─────────────────────────────────────────────

  private splitName(full: string): { firstName: string; lastName: string } {
    const parts = full.trim().split(/\s+/);
    const firstName = parts[0] ?? full;
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
    return { firstName, lastName };
  }

  private async nextApplicationNumber(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `APP-${year}-`;
    const last = await this.admissionModel
      .findOne({ schoolId, applicationNumber: new RegExp(`^${prefix}`) })
      .sort({ applicationNumber: -1 })
      .select('applicationNumber')
      .lean<{ applicationNumber: string }>()
      .exec();
    const seq = last
      ? parseInt(last.applicationNumber.slice(prefix.length), 10) || 0
      : 0;
    return `${prefix}${String(seq + 1).padStart(5, '0')}`;
  }
}
