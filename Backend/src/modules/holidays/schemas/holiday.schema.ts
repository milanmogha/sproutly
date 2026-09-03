import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type HolidayDocument = HydratedDocument<Holiday>;

/** A real school holiday (distinct from the events collection). Read by every
 *  role for their calendars; created/removed by admins. */
@Schema({ timestamps: true })
export class Holiday {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: String, default: null })
  description?: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;
}

export const HolidaySchema = SchemaFactory.createForClass(Holiday);

// One entry per school per day — marking the same day twice just updates it.
HolidaySchema.index({ schoolId: 1, date: 1 }, { unique: true });
