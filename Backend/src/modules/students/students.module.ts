import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { Student, StudentSchema } from './schemas/student.schema';

@Module({
  imports: [
    // Guardian, EmergencyContact, MedicalInfo and Vaccination are embedded
    // subdocuments of Student — they are not standalone collections.
    MongooseModule.forFeature([{ name: Student.name, schema: StudentSchema }]),
    // For provisioning a parent login account from the student's parent phone.
    UsersModule,
    // For alerting admins when a parent requests a locked-profile change.
    NotificationsModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
