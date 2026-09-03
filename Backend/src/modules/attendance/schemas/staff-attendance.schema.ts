import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';

export type StaffAttendanceDocument = HydratedDocument<StaffAttendance>;

@Schema({ timestamps: true })
export class StaffAttendance {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  /** The staff member's user account. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  staff: Types.ObjectId;

  /** Attendance day, normalized to UTC midnight. */
  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({
    type: String,
    enum: AttendanceStatus,
    default: AttendanceStatus.PRESENT,
  })
  status: AttendanceStatus;

  @Prop({ type: Date, default: null })
  checkInAt?: Date | null;

  @Prop({ type: Date, default: null })
  checkOutAt?: Date | null;

  @Prop({ type: String, default: null })
  remarks?: string | null;
}

export const StaffAttendanceSchema =
  SchemaFactory.createForClass(StaffAttendance);

StaffAttendanceSchema.index({ staff: 1, date: 1 }, { unique: true });
