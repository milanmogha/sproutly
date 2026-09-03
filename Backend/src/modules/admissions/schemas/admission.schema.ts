import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Gender } from '../../../common/enums/gender.enum';

export enum AdmissionStatus {
  APPLIED = 'applied',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WAITLISTED = 'waitlisted',
  ENROLLED = 'enrolled',
  WITHDRAWN = 'withdrawn',
}

export type AdmissionDocument = HydratedDocument<Admission>;

@Schema({ timestamps: true })
export class Admission {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  // Unique per school, not globally — see compound index below.
  @Prop({ required: true, trim: true })
  applicationNumber: string;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ type: Date, required: true })
  dateOfBirth: Date;

  @Prop({ type: String, enum: Gender, required: true })
  gender: Gender;

  @Prop({ required: true, trim: true })
  parentName: string;

  @Prop({ required: true, trim: true })
  parentPhone: string;

  @Prop({ type: String, default: null })
  parentEmail?: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', default: null })
  classApplyingFor?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  academicYear: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Inquiry', default: null })
  inquiry?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: AdmissionStatus,
    default: AdmissionStatus.APPLIED,
    index: true,
  })
  status: AdmissionStatus;

  @Prop({ type: Number, default: null })
  waitlistPosition?: number | null;

  @Prop({ type: String, default: null })
  reviewNotes?: string | null;

  @Prop({ type: Date, default: null })
  decisionDate?: Date | null;

  /** Set once the application is enrolled and a Student record is created. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', default: null })
  student?: Types.ObjectId | null;
}

export const AdmissionSchema = SchemaFactory.createForClass(Admission);

AdmissionSchema.index({ schoolId: 1, applicationNumber: 1 }, { unique: true });
