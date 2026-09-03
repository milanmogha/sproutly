import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum PtmStatus {
  REQUESTED = 'requested',
  SCHEDULED = 'scheduled',
  DECLINED = 'declined',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export type PtmRequestDocument = HydratedDocument<PtmRequest>;

@Schema({ timestamps: true })
export class PtmRequest {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  /** The user who requested the meeting — a parent OR a teacher. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  requestedBy: Types.ObjectId;

  /** The parent side of the meeting: the requester (parent-initiated) or the
   *  student's linked parent (teacher-initiated) — so the request shows in
   *  that parent's list and they can accept/decline. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null, index: true })
  parent?: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null, index: true })
  teacher?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  reason: string;

  /** Requester's preferred slots, free-text (e.g. "Mon AM", "Fri 4pm"). */
  @Prop({ type: [String], default: [] })
  preferredSlots: string[];

  @Prop({
    type: String,
    enum: PtmStatus,
    default: PtmStatus.REQUESTED,
    index: true,
  })
  status: PtmStatus;

  @Prop({ type: Date, default: null })
  scheduledAt?: Date | null;

  @Prop({ type: String, default: null })
  responseNote?: string | null;
}

export const PtmRequestSchema = SchemaFactory.createForClass(PtmRequest);
