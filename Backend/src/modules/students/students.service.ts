import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { StudentStatus } from '../../common/enums/student-status.enum';
import { GuardianRelationship } from '../../common/enums/guardian-relationship.enum';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Student, StudentDocument } from './schemas/student.schema';
import { CreateStudentDto, GuardianDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { QueryStudentsDto } from './dto/query-students.dto';

export interface StudentStats {
  total: number;
  byStatus: Record<string, number>;
}

@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    private readonly usersService: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    dto: CreateStudentDto,
    schoolId: string | null,
  ): Promise<Student> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const admissionNumber =
      dto.admissionNumber ?? (await this.nextAdmissionNumber(schoolId));

    const exists = await this.studentModel.exists({
      schoolId,
      admissionNumber,
    });
    if (exists) {
      throw new ConflictException(
        `Admission number "${admissionNumber}" already exists`,
      );
    }

    // Provision (or link) the parent's phone-OTP login for this child.
    const parentUserId = await this.resolveParentAccount(dto, schoolId);

    const { parentPhone: _p, parentName: _n, ...studentData } = dto;
    // Reflect the admin-entered parent name/phone on the student itself as a
    // primary guardian, so it shows immediately (before the parent completes
    // the profile). The parent can refine this — including father/mother
    // split — during profile completion.
    const guardians =
      studentData.guardians && studentData.guardians.length > 0
        ? studentData.guardians
        : this.seedGuardianFromParent(dto);
    return this.studentModel.create({
      ...studentData,
      guardians,
      admissionNumber,
      schoolId,
      parentUserId,
    });
  }

  /**
   * Builds a single primary guardian from the admin's parentName/parentPhone
   * so the name entered at creation is reflected on the student record.
   * Returns an empty list when no parent details were provided.
   */
  private seedGuardianFromParent(dto: CreateStudentDto): GuardianDto[] {
    const primaryGuardian =
      dto.guardians?.find((g) => g.isPrimary) ?? dto.guardians?.[0];
    const name = dto.parentName ?? primaryGuardian?.name;
    const phone = dto.parentPhone ?? primaryGuardian?.phone;
    if (!name || !phone) {
      return [];
    }
    return [
      {
        name,
        phone,
        relationship: GuardianRelationship.GUARDIAN,
        isPrimary: true,
      },
    ];
  }

  /**
   * Finds-or-creates the parent login account for a new student. Uses the
   * explicit parentPhone, else falls back to the primary guardian's phone.
   * Returns null when no phone is available.
   */
  private async resolveParentAccount(
    dto: CreateStudentDto,
    schoolId: string,
  ): Promise<Types.ObjectId | null> {
    const primaryGuardian =
      dto.guardians?.find((g) => g.isPrimary) ?? dto.guardians?.[0];
    const phone = dto.parentPhone ?? primaryGuardian?.phone;
    if (!phone) {
      return null;
    }
    const name =
      dto.parentName ?? primaryGuardian?.name ?? `${dto.firstName}'s parent`;
    // TEMPORARY: the parent's email is their login identity while WhatsApp OTP
    // is disabled, so it is required when provisioning a parent login here.
    const email = dto.parentEmail ?? primaryGuardian?.email;
    if (!email) {
      throw new BadRequestException(
        'Parent email is required — it is used to send the login code.',
      );
    }
    const parent = await this.usersService.findOrCreateParent({
      name,
      phone,
      email,
      schoolId,
    });
    return parent._id as Types.ObjectId;
  }

  // ── Parent self-service profile completion ────────────────

  /**
   * A parent fills in the rest of their child's profile (medical, guardians,
   * emergency contacts, address). Allowed once: the record locks on completion
   * and only an admin can change it afterwards. Callable only by the parent
   * who owns the student.
   */
  async completeProfile(
    studentId: string,
    parentUserId: string,
    dto: CompleteProfileDto,
  ): Promise<Student> {
    const student = await this.studentModel.findById(studentId).exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (String(student.parentUserId) !== String(parentUserId)) {
      throw new ForbiddenException('This is not your child’s profile');
    }
    if (student.profileCompleted) {
      throw new ForbiddenException(
        'Profile already completed. Contact the school admin to make changes.',
      );
    }

    if (dto.address !== undefined) student.set('address', dto.address);
    if (dto.guardians !== undefined) student.set('guardians', dto.guardians);
    if (dto.emergencyContacts !== undefined) {
      student.set('emergencyContacts', dto.emergencyContacts);
    }
    if (dto.medicalInfo !== undefined) {
      student.set('medicalInfo', dto.medicalInfo);
    }
    student.profileCompleted = true;
    student.profileCompletedAt = new Date();
    await student.save();
    return student;
  }

  /**
   * A parent asks the admin to change a locked profile. Records nothing on the
   * student — it just notifies the school's admins/principals with the reason.
   */
  async requestProfileChange(
    studentId: string,
    parentUserId: string,
    message: string,
  ): Promise<{ notified: number }> {
    const student = await this.studentModel.findById(studentId).exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (String(student.parentUserId) !== String(parentUserId)) {
      throw new ForbiddenException('This is not your child’s profile');
    }
    const schoolId = String(student.schoolId);
    const admins = await this.usersService.findProfileAdminsForSchool(schoolId);
    await Promise.all(
      admins.map((adminId) =>
        this.notifications.send(
          {
            recipient: adminId,
            title: 'Profile change requested',
            body: `${student.firstName} ${student.lastName}'s parent requested a change: ${message}`,
            type: 'profile_change_request',
            data: { studentId: String(student._id) },
          },
          schoolId,
        ),
      ),
    );
    return { notified: admins.length };
  }

  async findAll(
    query: QueryStudentsDto,
    schoolId: string | null,
  ): Promise<PaginatedResult<Student>> {
    const {
      page = 1,
      limit = 20,
      status,
      classId,
      unassigned,
      search,
      parentUserId,
    } = query;

    let filter: FilterQuery<StudentDocument> = {};
    if (status) filter.status = status;
    if (classId) filter.classId = classId;
    // `$in: [null]` matches both an explicit null and a missing field, which
    // is how a student who has never been allocated is stored.
    else if (unassigned) filter.classId = { $in: [null] };
    if (parentUserId) filter.parentUserId = new Types.ObjectId(parentUserId);
    if (search) {
      const rx = new RegExp(this.escapeRegex(search), 'i');
      filter.$or = [
        { firstName: rx },
        { lastName: rx },
        { admissionNumber: rx },
      ];
    }
    filter = scopeFilter(filter, schoolId);

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.studentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.studentModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async stats(schoolId: string | null): Promise<StudentStats> {
    const match = schoolId ? { schoolId: new Types.ObjectId(schoolId) } : {};
    const [total, grouped] = await Promise.all([
      this.studentModel.countDocuments(match).exec(),
      this.studentModel
        .aggregate<{ _id: string; count: number }>([
          { $match: match },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const byStatus: Record<string, number> = {};
    for (const status of Object.values(StudentStatus)) {
      byStatus[status] = 0;
    }
    for (const row of grouped) {
      byStatus[row._id] = row.count;
    }

    return { total, byStatus };
  }

  async findOne(id: string, schoolId: string | null): Promise<Student> {
    const student = await this.studentModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  async update(
    id: string,
    dto: UpdateStudentDto,
    schoolId: string | null,
  ): Promise<Student> {
    const student = await this.studentModel
      .findOneAndUpdate(scopeFilter({ _id: id }, schoolId), dto, {
        new: true,
        runValidators: true,
      })
      .exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (student.parentUserId && schoolId) {
      this.notifications
        .send(
          {
            recipient: String(student.parentUserId),
            title: 'Profile updated',
            body: `Your child ${student.firstName}'s profile has been updated.`,
            type: 'profile_update',
            data: { studentId: String(student._id) },
          },
          schoolId,
        )
        .catch(() => {});
    }

    return student;
  }

  async addGuardian(
    id: string,
    dto: GuardianDto,
    schoolId: string | null,
  ): Promise<Student> {
    const student = await this.studentModel
      .findOneAndUpdate(
        scopeFilter({ _id: id }, schoolId),
        { $push: { guardians: dto } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  async remove(id: string, schoolId: string | null): Promise<void> {
    const res = await this.studentModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) {
      throw new NotFoundException('Student not found');
    }
  }

  /** Assigns (or clears, when classId is null) a student's class. */
  async setClass(
    studentId: string,
    classId: string | null,
    schoolId: string | null,
  ): Promise<Student> {
    const student = await this.studentModel
      .findOneAndUpdate(scopeFilter({ _id: studentId }, schoolId), { classId }, {
        new: true,
      })
      .exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  findByClass(classId: string, schoolId: string | null): Promise<Student[]> {
    return this.studentModel
      .find(scopeFilter({ classId }, schoolId))
      .sort({ firstName: 1, lastName: 1 })
      .exec();
  }

  countByClass(classId: string, schoolId: string | null): Promise<number> {
    return this.studentModel
      .countDocuments(scopeFilter({ classId }, schoolId))
      .exec();
  }

  /** Student ids across several classes — used to gather a teacher's students. */
  async idsByClasses(
    classIds: string[],
    schoolId: string | null,
  ): Promise<string[]> {
    if (classIds.length === 0) return [];
    const docs = await this.studentModel
      .find(scopeFilter({ classId: { $in: classIds } }, schoolId))
      .select('_id')
      .exec();
    return docs.map((d) => String(d._id));
  }

  /** Returns a map of classId -> enrolled student count. */
  async countsByClass(
    schoolId: string | null,
  ): Promise<Record<string, number>> {
    const match: Record<string, unknown> = { classId: { $ne: null } };
    if (schoolId) match.schoolId = new Types.ObjectId(schoolId);

    const rows = await this.studentModel
      .aggregate<{ _id: Types.ObjectId | null; count: number }>([
        { $match: match },
        { $group: { _id: '$classId', count: { $sum: 1 } } },
      ])
      .exec();

    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (row._id) {
        counts[row._id.toString()] = row.count;
      }
    }
    return counts;
  }

  /** Generates the next admission number (scoped per school): ADM-<year>-<zero-padded seq>. */
  private async nextAdmissionNumber(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ADM-${year}-`;
    const last = await this.studentModel
      .findOne({ schoolId, admissionNumber: new RegExp(`^${prefix}`) })
      .sort({ admissionNumber: -1 })
      .select('admissionNumber')
      .lean()
      .exec();

    const lastSeq = last
      ? parseInt(last.admissionNumber.slice(prefix.length), 10) || 0
      : 0;
    return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`;
  }

  private escapeRegex(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
