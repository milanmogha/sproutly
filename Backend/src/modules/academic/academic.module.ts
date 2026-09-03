import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentsModule } from '../students/students.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { Assessment, AssessmentSchema } from './schemas/assessment.schema';
import { Result, ResultSchema } from './schemas/result.schema';
import { Homework, HomeworkSchema } from './schemas/homework.schema';
import { Syllabus, SyllabusSchema } from './schemas/syllabus.schema';
import { LessonPlan, LessonPlanSchema } from './schemas/lesson-plan.schema';
import { Milestone, MilestoneSchema } from './schemas/milestone.schema';
import {
  TeacherRemark,
  TeacherRemarkSchema,
} from './schemas/teacher-remark.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Assessment.name, schema: AssessmentSchema },
      { name: Result.name, schema: ResultSchema },
      { name: Homework.name, schema: HomeworkSchema },
      { name: Syllabus.name, schema: SyllabusSchema },
      { name: LessonPlan.name, schema: LessonPlanSchema },
      { name: Milestone.name, schema: MilestoneSchema },
      { name: TeacherRemark.name, schema: TeacherRemarkSchema },
    ]),
    // Homework alerts: the class roster gives the parents to notify.
    StudentsModule,
    NotificationsModule,
  ],
  controllers: [AcademicController],
  providers: [AcademicService],
  exports: [AcademicService],
})
export class AcademicModule {}
