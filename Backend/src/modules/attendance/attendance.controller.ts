import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  type AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { MarkStaffAttendanceDto } from './dto/mark-staff-attendance.dto';
import { StaffCheckInOutDto } from './dto/check-in-out.dto';
import {
  DateQueryDto,
  MonthlyQueryDto,
  RangeQueryDto,
} from './dto/query-attendance.dto';

// Who may record attendance.
const MARK_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.TEACHER,
] as const;

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ── Student attendance ──────────────────────────────────

  @Post('mark')
  @Roles(...MARK_ROLES)
  mark(@Body() dto: MarkAttendanceDto, @CurrentUser() user: AuthUser) {
    return this.attendanceService.markBulk(dto, user.userId, user.schoolId);
  }

  @Get('class/:classId')
  classSheet(
    @Param('classId') classId: string,
    @Query() query: DateQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendanceService.classSheet(
      classId,
      query.date,
      user.schoolId,
    );
  }

  @Get('class/:classId/summary')
  classSummary(
    @Param('classId') classId: string,
    @Query() query: DateQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendanceService.classSummary(
      classId,
      query.date,
      user.schoolId,
    );
  }

  @Get('class/:classId/late')
  lateArrivals(
    @Param('classId') classId: string,
    @Query() query: DateQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendanceService.lateArrivals(
      classId,
      query.date,
      user.schoolId,
    );
  }

  @Get('student/:studentId')
  studentHistory(
    @Param('studentId') studentId: string,
    @Query() query: RangeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendanceService.studentHistory(
      studentId,
      query.from,
      query.to,
      user.schoolId,
    );
  }

  @Get('student/:studentId/monthly')
  monthly(
    @Param('studentId') studentId: string,
    @Query() query: MonthlyQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendanceService.monthlyReport(
      studentId,
      query.year,
      query.month,
      user.schoolId,
    );
  }

  // Weekly / monthly attendance report for a student (admins & teachers).
  @Get('student/:studentId/report')
  studentReport(
    @Param('studentId') studentId: string,
    @Query() query: RangeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendanceService.studentReport(
      studentId,
      query.from,
      query.to,
      user.schoolId,
    );
  }

  // ── Staff attendance ────────────────────────────────────

  @Post('staff/check-in-out')
  @Roles(...MARK_ROLES)
  staffCheckInOut(
    @Body() dto: StaffCheckInOutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendanceService.staffCheckInOut(
      dto.staffId,
      dto.action,
      dto.at,
      dto.date,
      user.schoolId,
    );
  }

  // Admin marks the whole staff roster present/absent for a day.
  @Post('staff/mark')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRINCIPAL)
  markStaff(
    @Body() dto: MarkStaffAttendanceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendanceService.markStaffBulk(dto, user.schoolId);
  }

  @Get('staff')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRINCIPAL)
  staffSheet(@Query() query: DateQueryDto, @CurrentUser() user: AuthUser) {
    return this.attendanceService.staffSheet(query.date, user.schoolId);
  }

  @Get('staff/:staffId/report')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRINCIPAL)
  staffReport(
    @Param('staffId') staffId: string,
    @Query() query: RangeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendanceService.staffReport(
      staffId,
      query.from,
      query.to,
      user.schoolId,
    );
  }
}
