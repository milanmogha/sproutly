import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SchoolsModule } from '../schools/schools.module';
import { StudentsModule } from '../students/students.module';
import { UsersModule } from '../users/users.module';
import { LeaveModule } from '../leave/leave.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [
    SchoolsModule,
    StudentsModule,
    UsersModule,
    LeaveModule,
    AttendanceModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
