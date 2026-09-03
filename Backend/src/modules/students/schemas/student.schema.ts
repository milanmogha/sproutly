import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Gender } from '../../../common/enums/gender.enum';
import { StudentStatus } from '../../../common/enums/student-status.enum';
import { Guardian, GuardianSchema } from './guardian.schema';
import {
  EmergencyContact,
  EmergencyContactSchema,
} from './emergency-contact.schema';
import { MedicalInfo, MedicalInfoSchema } from './medical-info.schema';

export type StudentDocument = HydratedDocument<Student>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Student {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  // Unique per school, not globally — see compound index below.
  @Prop({ required: true, trim: true })
  admissionNumber: string;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ type: Date, required: true })
  dateOfBirth: Date;

  @Prop({ type: String, enum: Gender, required: true })
  gender: Gender;

  @Prop({ type: String, default: null })
  photoUrl?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', default: null, index: true })
  classId?: Types.ObjectId | null;

  // The parent's login account (phone-OTP). Provisioned when a student is
  // created with a parent phone; the parent then signs in to see this child.
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null, index: true })
  parentUserId?: Types.ObjectId | null;

  @Prop({ type: Date, default: () => new Date() })
  enrollmentDate: Date;

  @Prop({
    type: String,
    enum: StudentStatus,
    default: StudentStatus.ACTIVE,
    index: true,
  })
  status: StudentStatus;

  @Prop(
    raw({
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String },
    }),
  )
  address?: Record<string, string>;

  @Prop({ type: [GuardianSchema], default: [] })
  guardians: Guardian[];

  @Prop({ type: [EmergencyContactSchema], default: [] })
  emergencyContacts: EmergencyContact[];

  @Prop({ type: MedicalInfoSchema, default: () => ({}) })
  medicalInfo: MedicalInfo;

  // Parent-completed profile lock. Admin creates the student with the basics;
  // the parent fills the rest (medical, guardians, contacts, address) once.
  // After completion the parent view is read-only — only an admin can edit.
  @Prop({ type: Boolean, default: false, index: true })
  profileCompleted: boolean;

  @Prop({ type: Date, default: null })
  profileCompletedAt?: Date | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const StudentSchema = SchemaFactory.createForClass(Student);

StudentSchema.index({ schoolId: 1, admissionNumber: 1 }, { unique: true });

// Derived full name, exposed via toJSON/toObject virtuals.
StudentSchema.virtual('fullName').get(function (this: Student): string {
  return `${this.firstName} ${this.lastName}`.trim();
});
