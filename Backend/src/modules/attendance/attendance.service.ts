import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model, Types } from 'mongoose';
import { AttendanceStatus } from '../../common/enums/attendance-status.enum';
import { StudentStatus } from '../../common/enums/student-status.enum';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { StudentsService } from '../students/students.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  StudentAttendance,
  StudentAttendanceDocument,
} from './schemas/student-attendance.schema';
import {
  StaffAttendance,
  StaffAttendanceDocument,
} from './schemas/staff-attendance.schema';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { MarkStaffAttendanceDto } from './dto/mark-staff-attendance.dto';
import { CheckAction } from './dto/check-in-out.dto';

export interface ClassSheetRow {
  student: { _id: string; fullName: string; admissionNumber: string };
  status: AttendanceStatus | null;
  remarks: string | null;
}

export interface AttendanceSummary {
  date: string;
  total: number;
  marked: number;
  notMarked: number;
  byStatus: Record<string, number>;
}

export interface StaffAttendanceRow {
  staffId: string;
  name: string;
  role: string;
  status: AttendanceStatus;
  checkInAt: Date | null;
  checkOutAt: Date | null;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(StudentAttendance.name)
    private readonly studentAttModel: Model<StudentAttendanceDocument>,
    @InjectModel(StaffAttendance.name)
    private readonly staffAttModel: Model<StaffAttendanceDocument>,
    private readonly studentsService: StudentsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Student attendance ──────────────────────────────────

  async markBulk(
    dto: MarkAttendanceDto,
    markedBy: string,
    schoolId: string | null,
  ): Promise<AttendanceSummary> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const date = this.toDay(dto.date);
    const ops: AnyBulkWriteOperation<StudentAttendanceDocument>[] =
      dto.entries.map((e) => ({
        updateOne: {
          filter: { student: new Types.ObjectId(e.studentId), date },
          update: {
            $set: {
              status: e.status,
              classId: new Types.ObjectId(dto.classId),
              remarks: e.remarks ?? null,
              markedBy: new Types.ObjectId(markedBy),
              schoolId: new Types.ObjectId(schoolId),
            },
          },
          upsert: true,
        },
      }));

    await this.studentAttModel.bulkWrite(ops);
    await this.alertParentsOfAbsence(dto, schoolId);
    return this.classSummary(dto.classId, dto.date, schoolId);
  }

  /**
   * Tells a parent, on the day it happens, that their child was not in class.
   * Only absent/late is worth an alert — nobody wants a notification saying
   * their child turned up.
   */
  private async alertParentsOfAbsence(
    dto: MarkAttendanceDto,
    schoolId: string,
  ): Promise<void> {
    const flagged = dto.entries.filter(
      (e) =>
        e.status === AttendanceStatus.ABSENT ||
        e.status === AttendanceStatus.LATE,
    );
    if (flagged.length === 0) {
      return;
    }

    const roster = await this.studentsService.findByClass(dto.classId, schoolId);
    const byId = new Map(
      roster.map((s) => [
        String((s as unknown as { _id: Types.ObjectId })._id),
        s,
      ]),
    );
    const day = this.toDay(dto.date).toDateString();

    await Promise.all(
      flagged.map((entry) => {
        const student = byId.get(entry.studentId);
        const parent = student?.parentUserId;
        if (!student || !parent) {
          return Promise.resolve(0);
        }
        const absent = entry.status === AttendanceStatus.ABSENT;
        return this.notifications.sendMany(
          [String(parent)],
          {
            title: absent
              ? `${student.firstName} was marked absent`
              : `${student.firstName} was marked late`,
            body: absent
              ? `${student.firstName} ${student.lastName} was not in class on ${day}.`
              : `${student.firstName} ${student.lastName} arrived late on ${day}.`,
            type: 'attendance',
            data: {
              studentId: entry.studentId,
              status: entry.status,
              date: day,
            },
          },
          schoolId,
          'attendanceAlerts',
        );
      }),
    );
  }

  async classSheet(
    classId: string,
    dateStr: string | undefined,
    schoolId: string | null,
  ): Promise<ClassSheetRow[]> {
    const date = this.toDay(dateStr);
    const [roster, records] = await Promise.all([
      this.studentsService.findByClass(classId, schoolId),
      this.studentAttModel
        .find(
          scopeFilter({ classId: new Types.ObjectId(classId), date }, schoolId),
        )
        .exec(),
    ]);

    const byStudent = new Map(records.map((r) => [String(r.student), r]));

    return roster.map((s) => {
      const id = String((s as unknown as { _id: Types.ObjectId })._id);
      const rec = byStudent.get(id);
      return {
        student: {
          _id: id,
          fullName: `${s.firstName} ${s.lastName}`,
          admissionNumber: s.admissionNumber,
        },
        status: rec?.status ?? null,
        remarks: rec?.remarks ?? null,
      };
    });
  }

  async classSummary(
    classId: string,
    dateStr: string | undefined,
    schoolId: string | null,
  ): Promise<AttendanceSummary> {
    const date = this.toDay(dateStr);
    const [total, records] = await Promise.all([
      this.studentsService.countByClass(classId, schoolId),
      this.studentAttModel
        .find(
          scopeFilter({ classId: new Types.ObjectId(classId), date }, schoolId),
        )
        .select('status')
        .exec(),
    ]);

    const byStatus = this.emptyStatusMap();
    for (const r of records) byStatus[r.status]++;

    return {
      date: date.toISOString().slice(0, 10),
      total,
      marked: records.length,
      notMarked: Math.max(0, total - records.length),
      byStatus,
    };
  }

  /**
   * School-wide student attendance for a single day — powers the admin home
   * "Today" card. Counts every attendance record marked today (scoped to the
   * school) against the active roster.
   */
  async schoolDaySummary(
    schoolId: string | null,
    dateStr?: string,
  ): Promise<{
    date: string;
    total: number;
    marked: number;
    notMarked: number;
    present: number;
    absent: number;
  }> {
    const date = this.toDay(dateStr);
    const [studentStats, records] = await Promise.all([
      this.studentsService.stats(schoolId),
      this.studentAttModel
        .find(scopeFilter({ date }, schoolId))
        .select('status')
        .exec(),
    ]);

    const byStatus = this.emptyStatusMap();
    for (const r of records) byStatus[r.status]++;

    // Active students are the ones expected to attend today.
    const activeTotal =
      studentStats.byStatus[StudentStatus.ACTIVE] ?? studentStats.total;
    const present =
      byStatus[AttendanceStatus.PRESENT] +
      byStatus[AttendanceStatus.LATE] +
      byStatus[AttendanceStatus.HALF_DAY];
    const absent =
      byStatus[AttendanceStatus.ABSENT] + byStatus[AttendanceStatus.ON_LEAVE];

    return {
      date: date.toISOString().slice(0, 10),
      total: activeTotal,
      marked: records.length,
      notMarked: Math.max(0, activeTotal - records.length),
      present,
      absent,
    };
  }

  lateArrivals(
    classId: string,
    dateStr: string | undefined,
    schoolId: string | null,
  ): Promise<StudentAttendance[]> {
    const date = this.toDay(dateStr);
    return this.studentAttModel
      .find(
        scopeFilter(
          {
            classId: new Types.ObjectId(classId),
            date,
            status: AttendanceStatus.LATE,
          },
          schoolId,
        ),
      )
      .exec();
  }

  studentHistory(
    studentId: string,
    from: string | undefined,
    to: string | undefined,
    schoolId: string | null,
  ): Promise<StudentAttendance[]> {
    const filter: Record<string, unknown> = {
      student: new Types.ObjectId(studentId),
    };
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = this.toDay(from);
      if (to) range.$lte = this.toDay(to);
      filter.date = range;
    }
    return this.studentAttModel
      .find(scopeFilter(filter, schoolId))
      .sort({ date: -1 })
      .exec();
  }

  async monthlyReport(
    studentId: string,
    year: number,
    month: number,
    schoolId: string | null,
  ) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const records = await this.studentAttModel
      .find(
        scopeFilter(
          {
            student: new Types.ObjectId(studentId),
            date: { $gte: start, $lt: end },
          },
          schoolId,
        ),
      )
      .sort({ date: 1 })
      .exec();

    const byStatus = this.emptyStatusMap();
    for (const r of records) byStatus[r.status]++;

    return {
      year,
      month,
      summary: byStatus,
      presentRate:
        records.length > 0
          ? Math.round(
              ((byStatus[AttendanceStatus.PRESENT] +
                byStatus[AttendanceStatus.LATE]) /
                records.length) *
                100,
            )
          : 0,
      days: records.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
      })),
    };
  }

  /**
   * A single student's attendance over a date range — powers the weekly and
   * monthly reports shown to teachers and admins. Working days exclude Sundays.
   */
  async studentReport(
    studentId: string,
    fromStr: string | undefined,
    toStr: string | undefined,
    schoolId: string | null,
  ): Promise<{
    from: string;
    to: string;
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    halfDay: number;
    marked: number;
    workingDays: number;
    presentRate: number;
    days: { date: string; status: AttendanceStatus }[];
  }> {
    const from = this.toDay(fromStr);
    const to = this.toDay(toStr);
    const records = await this.studentAttModel
      .find(
        scopeFilter(
          {
            student: new Types.ObjectId(studentId),
            date: { $gte: from, $lte: to },
          },
          schoolId,
        ),
      )
      .sort({ date: 1 })
      .exec();

    const byStatus = this.emptyStatusMap();
    for (const r of records) byStatus[r.status]++;

    const present = byStatus[AttendanceStatus.PRESENT];
    const late = byStatus[AttendanceStatus.LATE];
    const halfDay = byStatus[AttendanceStatus.HALF_DAY];
    const marked = records.length;
    const attended = present + late + halfDay;

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      present,
      absent: byStatus[AttendanceStatus.ABSENT],
      late,
      onLeave: byStatus[AttendanceStatus.ON_LEAVE],
      halfDay,
      marked,
      workingDays: this.countWorkingDays(from, to),
      presentRate: marked > 0 ? Math.round((attended / marked) * 100) : 0,
      days: records.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
      })),
    };
  }

  // ── Staff attendance ────────────────────────────────────

  async staffCheckInOut(
    staffId: string,
    action: CheckAction,
    atStr: string | undefined,
    dateStr: string | undefined,
    schoolId: string | null,
  ): Promise<StaffAttendance> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const date = this.toDay(dateStr);
    const at = atStr ? new Date(atStr) : new Date();
    const field = action === CheckAction.CHECK_IN ? 'checkInAt' : 'checkOutAt';

    return this.staffAttModel
      .findOneAndUpdate(
        scopeFilter({ staff: new Types.ObjectId(staffId), date }, schoolId),
        {
          $set: { [field]: at },
          $setOnInsert: {
            status: AttendanceStatus.PRESENT,
            schoolId: new Types.ObjectId(schoolId),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  /**
   * Admin-driven bulk marking of the staff roster for a single day — the
   * counterpart to student {@link markBulk}. Upserts one record per staff so
   * repeated saves overwrite the day's status.
   */
  async markStaffBulk(
    dto: MarkStaffAttendanceDto,
    schoolId: string | null,
  ): Promise<StaffAttendanceRow[]> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const date = this.toDay(dto.date);
    const ops: AnyBulkWriteOperation<StaffAttendanceDocument>[] =
      dto.entries.map((e) => ({
        updateOne: {
          filter: { staff: new Types.ObjectId(e.staffId), date },
          update: {
            $set: {
              status: e.status,
              remarks: e.remarks ?? null,
              schoolId: new Types.ObjectId(schoolId),
            },
          },
          upsert: true,
        },
      }));

    await this.staffAttModel.bulkWrite(ops);
    return this.staffSheet(dto.date, schoolId);
  }

  /**
   * A single teacher's attendance over a date range — powers the weekly and
   * monthly reports in Staff Management. Working days exclude Sundays, since
   * attendance is only taken Monday–Saturday.
   */
  async staffReport(
    staffId: string,
    fromStr: string | undefined,
    toStr: string | undefined,
    schoolId: string | null,
  ): Promise<{
    from: string;
    to: string;
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    halfDay: number;
    marked: number;
    workingDays: number;
    presentRate: number;
    days: { date: string; status: AttendanceStatus }[];
  }> {
    const from = this.toDay(fromStr);
    const to = this.toDay(toStr);
    const records = await this.staffAttModel
      .find(
        scopeFilter(
          {
            staff: new Types.ObjectId(staffId),
            date: { $gte: from, $lte: to },
          },
          schoolId,
        ),
      )
      .sort({ date: 1 })
      .exec();

    const byStatus = this.emptyStatusMap();
    for (const r of records) byStatus[r.status]++;

    const present = byStatus[AttendanceStatus.PRESENT];
    const late = byStatus[AttendanceStatus.LATE];
    const halfDay = byStatus[AttendanceStatus.HALF_DAY];
    const marked = records.length;
    // Present, late and half-day all count as "attended" for the rate.
    const attended = present + late + halfDay;

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      present,
      absent: byStatus[AttendanceStatus.ABSENT],
      late,
      onLeave: byStatus[AttendanceStatus.ON_LEAVE],
      halfDay,
      marked,
      workingDays: this.countWorkingDays(from, to),
      presentRate: marked > 0 ? Math.round((attended / marked) * 100) : 0,
      days: records.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
      })),
    };
  }

  /** Days in [from, to] inclusive that are not Sundays (getUTCDay 0). */
  private countWorkingDays(from: Date, to: Date): number {
    let count = 0;
    const cursor = new Date(from);
    while (cursor <= to) {
      if (cursor.getUTCDay() !== 0) count++;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
  }

  async staffSheet(
    dateStr: string | undefined,
    schoolId: string | null,
  ): Promise<StaffAttendanceRow[]> {
    const date = this.toDay(dateStr);
    const records = await this.staffAttModel
      .find(scopeFilter({ date }, schoolId))
      .populate('staff', 'name email role')
      .exec();

    return records.map((r) => {
      const staff = r.staff as unknown as {
        _id: Types.ObjectId;
        name?: string;
        role?: string;
      } | null;
      return {
        staffId: staff?._id ? String(staff._id) : String(r.staff),
        name: staff?.name ?? '',
        role: staff?.role ?? '',
        status: r.status,
        checkInAt: r.checkInAt ?? null,
        checkOutAt: r.checkOutAt ?? null,
      };
    });
  }

  // ── helpers ─────────────────────────────────────────────

  /** Normalizes a date string (or now) to UTC midnight for day-level keys. */
  private toDay(dateStr?: string): Date {
    const d = dateStr ? new Date(dateStr) : new Date();
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private emptyStatusMap(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const s of Object.values(AttendanceStatus)) map[s] = 0;
    return map;
  }
}
