import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentsModule } from '../students/students.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import {
  StudentAttendance,
  StudentAttendanceSchema,
} from './schemas/student-attendance.schema';
import {
  StaffAttendance,
  StaffAttendanceSchema,
} from './schemas/staff-attendance.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StudentAttendance.name, schema: StudentAttendanceSchema },
      { name: StaffAttendance.name, schema: StaffAttendanceSchema },
    ]),
    // Roster lookups for class sheets and check-in classId resolution.
    StudentsModule,
    // Absence alerts to parents.
    NotificationsModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
