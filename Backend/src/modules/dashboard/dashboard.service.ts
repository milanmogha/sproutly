import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { StudentStatus } from '../../common/enums/student-status.enum';
import { LeaveStatus } from '../../common/enums/leave-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { SchoolsService } from '../schools/schools.service';
import { StudentsService } from '../students/students.service';
import { UsersService } from '../users/users.service';
import { LeaveService } from '../leave/leave.service';
import { AttendanceService } from '../attendance/attendance.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly schoolsService: SchoolsService,
    private readonly studentsService: StudentsService,
    private readonly usersService: UsersService,
    private readonly leaveService: LeaveService,
    private readonly attendanceService: AttendanceService,
  ) {}

  /**
   * Live counters for the admin/teacher/parent home screens, scoped to the
   * caller's school. The super admin has no single school, so its response is
   * empty — it uses the platform-wide /schools/stats endpoint instead.
   */
  async overview(user: AuthUser) {
    const schoolId = user.schoolId;

    if (!schoolId) {
      return {
        generatedAt: new Date().toISOString(),
        school: null,
        students: { total: 0, active: 0, byStatus: {} },
        staff: { total: 0 },
        leaves: { pending: 0 },
        attendance: {
          total: 0,
          marked: 0,
          notMarked: 0,
          present: 0,
          absent: 0,
        },
      };
    }

    const [school, studentStats, usersByRole, pendingLeaves, attendance] =
      await Promise.all([
        this.schoolsService.findOne(schoolId).catch(() => null),
        this.studentsService.stats(schoolId),
        this.usersService.countByRoleForSchool(schoolId),
        this.leaveService.findAll(1, 1, schoolId, LeaveStatus.PENDING),
        this.attendanceService.schoolDaySummary(schoolId),
      ]);

    // Staff = every account in the school except parents.
    const parentRole: string = UserRole.PARENT;
    const staffTotal = Object.entries(usersByRole)
      .filter(([role]) => role !== parentRole)
      .reduce((sum, [, count]) => sum + count, 0);

    return {
      generatedAt: new Date().toISOString(),
      school: school
        ? {
            id: String((school as unknown as { _id: unknown })._id),
            name: school.name,
          }
        : null,
      students: {
        total: studentStats.total,
        active: studentStats.byStatus[StudentStatus.ACTIVE] ?? 0,
        byStatus: studentStats.byStatus,
      },
      staff: { total: staffTotal },
      leaves: { pending: pendingLeaves.total },
      attendance,
    };
  }
}
