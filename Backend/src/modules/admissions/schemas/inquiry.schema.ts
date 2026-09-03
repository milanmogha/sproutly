import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Gender } from '../../../common/enums/gender.enum';

export enum InquiryStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  VISITED = 'visited',
  CONVERTED = 'converted',
  CLOSED = 'closed',
}

export enum InquirySource {
  WALK_IN = 'walk_in',
  WEBSITE = 'website',
  REFERRAL = 'referral',
  PHONE = 'phone',
  SOCIAL = 'social',
  OTHER = 'other',
}

export type InquiryDocument = HydratedDocument<Inquiry>;

@Schema({ timestamps: true })
export class Inquiry {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  childName: string;

  @Prop({ type: Date, default: null })
  childDateOfBirth?: Date | null;

  @Prop({ type: String, enum: Gender, default: null })
  gender?: Gender | null;

  @Prop({ required: true, trim: true })
  parentName: string;

  @Prop({ required: true, trim: true })
  parentPhone: string;

  @Prop({ type: String, default: null })
  parentEmail?: string | null;

  /** Free-text grade/programme of interest, e.g. "Nursery". */
  @Prop({ type: String, default: null })
  gradeInterested?: string | null;

  @Prop({ type: String, enum: InquirySource, default: InquirySource.WALK_IN })
  source: InquirySource;

  @Prop({
    type: String,
    enum: InquiryStatus,
    default: InquiryStatus.NEW,
    index: true,
  })
  status: InquiryStatus;

  @Prop({ type: String, default: null })
  notes?: string | null;

  @Prop({ type: Date, default: null })
  followUpDate?: Date | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  assignedTo?: Types.ObjectId | null;
}

export const InquirySchema = SchemaFactory.createForClass(Inquiry);
