import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { School, SchoolSchema } from './schemas/school.schema';
import {
  Student,
  StudentSchema,
} from '../students/schemas/student.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: School.name, schema: SchoolSchema },
      // Read-only: only used to count a school's students in overview().
      { name: Student.name, schema: StudentSchema },
    ]),
    UsersModule,
  ],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
