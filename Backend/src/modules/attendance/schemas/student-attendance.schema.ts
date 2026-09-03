import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';

export type StudentAttendanceDocument = HydratedDocument<StudentAttendance>;

@Schema({ timestamps: true })
export class StudentAttendance {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', default: null, index: true })
  classId?: Types.ObjectId | null;

  /** Attendance day, normalized to UTC midnight. */
  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: String, enum: AttendanceStatus, required: true })
  status: AttendanceStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  markedBy?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  remarks?: string | null;
}

export const StudentAttendanceSchema =
  SchemaFactory.createForClass(StudentAttendance);

// One attendance record per student per day.
StudentAttendanceSchema.index({ student: 1, date: 1 }, { unique: true });
