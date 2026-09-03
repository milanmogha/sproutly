import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentsModule } from '../students/students.module';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';
import { Inquiry, InquirySchema } from './schemas/inquiry.schema';
import { Admission, AdmissionSchema } from './schemas/admission.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Inquiry.name, schema: InquirySchema },
      { name: Admission.name, schema: AdmissionSchema },
    ]),
    // Enrollment creates a Student record from an approved application.
    StudentsModule,
  ],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
  exports: [AdmissionsService],
})
export class AdmissionsModule {}
