import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { LeaveStatus } from '../../common/enums/leave-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { ClassesService } from '../classes/classes.service';
import {
  LeaveRequest,
  LeaveRequestDocument,
} from './schemas/leave-request.schema';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';

@Injectable()
export class LeaveService {
  constructor(
    @InjectModel(LeaveRequest.name)
    private readonly leaveRequestModel: Model<LeaveRequestDocument>,
    private readonly classesService: ClassesService,
  ) {}

  async create(
    dto: ApplyLeaveDto,
    applicantId: string,
    applicantRole: string,
    schoolId: string | null,
  ): Promise<LeaveRequest> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    if (new Date(dto.toDate) < new Date(dto.fromDate)) {
      throw new BadRequestException('toDate must not be before fromDate');
    }
    return this.leaveRequestModel.create({
      ...dto,
      studentId: dto.studentId ? new Types.ObjectId(dto.studentId) : null,
      applicantId: new Types.ObjectId(applicantId),
      applicantRole,
      schoolId,
    });
  }

  async findAll(
    page = 1,
    limit = 20,
    schoolId: string | null,
    status?: LeaveStatus,
    applicantId?: string,
  ): Promise<PaginatedResult<LeaveRequest>> {
    const skip = (page - 1) * limit;
    const filter: FilterQuery<LeaveRequestDocument> = scopeFilter(
      {},
      schoolId,
    );
    if (status) {
      filter.status = status;
    }
    if (applicantId) {
      filter.applicantId = new Types.ObjectId(applicantId);
    }
    const [data, total] = await Promise.all([
      this.leaveRequestModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        // Applicant identity so review screens can show who applied, and
        // the child so a parent's own list names them rather than the parent.
        .populate('applicantId', 'name email role')
        .populate('studentId', 'firstName lastName admissionNumber')
        .exec(),
      this.leaveRequestModel.countDocuments(filter).exec(),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, schoolId: string | null): Promise<LeaveRequest> {
    const doc = await this.leaveRequestModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .populate('applicantId', 'name email role')
      .populate('studentId', 'firstName lastName admissionNumber')
      .exec();
    if (!doc) {
      throw new NotFoundException('LeaveRequest not found');
    }
    return doc;
  }

  async updateStatus(
    id: string,
    dto: UpdateLeaveStatusDto,
    reviewerId: string,
    reviewerRole: string,
    schoolId: string | null,
  ): Promise<LeaveRequest> {
    const doc = await this.leaveRequestModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!doc) {
      throw new NotFoundException('LeaveRequest not found');
    }

    // A class teacher may only decide student leaves for their own class.
    if (reviewerRole === UserRole.TEACHER) {
      if (!doc.studentId) {
        throw new ForbiddenException(
          'Teachers can only review student leave requests',
        );
      }
      const allowed = await this.classesService.isClassTeacherOfStudent(
        reviewerId,
        String(doc.studentId),
        schoolId,
      );
      if (!allowed) {
        throw new ForbiddenException(
          'You can only review leave for students in your class',
        );
      }
    }

    doc.status = dto.status;
    doc.reviewNote = dto.reviewNote;
    doc.reviewedBy = new Types.ObjectId(reviewerId);
    await doc.save();
    return doc;
  }

  /** Student leave requests for the classes a teacher is in charge of. */
  async findForClassTeacher(
    teacherId: string,
    schoolId: string | null,
    status?: LeaveStatus,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResult<LeaveRequest>> {
    const studentIds = await this.classesService.studentIdsForTeacher(
      teacherId,
      schoolId,
    );
    if (studentIds.length === 0) {
      return { data: [], total: 0, page, limit, totalPages: 1 };
    }
    const filter: FilterQuery<LeaveRequestDocument> = scopeFilter(
      { studentId: { $in: studentIds.map((s) => new Types.ObjectId(s)) } },
      schoolId,
    );
    if (status) {
      filter.status = status;
    }
    const [data, total] = await Promise.all([
      this.leaveRequestModel
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('applicantId', 'name email role')
        .populate('studentId', 'firstName lastName admissionNumber')
        .exec(),
      this.leaveRequestModel.countDocuments(filter).exec(),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /** An applicant may cancel their own pending request. */
  async cancelOwn(
    id: string,
    applicantId: string,
    schoolId: string | null,
  ): Promise<LeaveRequest> {
    const doc = await this.leaveRequestModel
      .findOneAndUpdate(
        scopeFilter(
          {
            _id: id,
            applicantId: new Types.ObjectId(applicantId),
            status: LeaveStatus.PENDING,
          },
          schoolId,
        ),
        { status: LeaveStatus.CANCELLED },
        { new: true },
      )
      .exec();
    if (!doc) {
      throw new NotFoundException('Pending leave request not found');
    }
    return doc;
  }

  async remove(id: string, schoolId: string | null): Promise<void> {
    const res = await this.leaveRequestModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) {
      throw new NotFoundException('LeaveRequest not found');
    }
  }
}
