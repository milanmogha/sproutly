import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { LeaveStatus } from '../../../common/enums/leave-status.enum';

export type LeaveRequestDocument = HydratedDocument<LeaveRequest>;

export enum LeaveType {
  SICK = 'sick',
  CASUAL = 'casual',
  VACATION = 'vacation',
  OTHER = 'other',
}

@Schema({ timestamps: true })
export class LeaveRequest {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  applicantId: Types.ObjectId;

  @Prop({ type: String, required: true })
  applicantRole: string;

  // Set when a parent applies leave on behalf of their child.
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', default: null })
  studentId?: Types.ObjectId | null;

  @Prop({ type: String, enum: Object.values(LeaveType), default: LeaveType.OTHER })
  type: LeaveType;

  @Prop({ type: Date, required: true })
  fromDate: Date;

  @Prop({ type: Date, required: true })
  toDate: Date;

  @Prop({ type: String, default: null })
  reason?: string;

  @Prop({
    type: String,
    enum: Object.values(LeaveStatus),
    default: LeaveStatus.PENDING,
    index: true,
  })
  status: LeaveStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  reviewedBy?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  reviewNote?: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const LeaveRequestSchema = SchemaFactory.createForClass(LeaveRequest);
