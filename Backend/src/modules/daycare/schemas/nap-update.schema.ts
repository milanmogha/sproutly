import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum NapQuality {
  SOUND = 'sound',
  RESTLESS = 'restless',
  NO_NAP = 'no_nap',
}

export type NapUpdateDocument = HydratedDocument<NapUpdate>;

@Schema({ timestamps: true })
export class NapUpdate {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', default: null })
  classId?: Types.ObjectId | null;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: Date, default: null })
  startTime?: Date | null;

  @Prop({ type: Date, default: null })
  endTime?: Date | null;

  @Prop({ type: Number, default: 0, min: 0 })
  durationMinutes: number;

  @Prop({ type: String, enum: NapQuality, default: NapQuality.SOUND })
  quality: NapQuality;

  @Prop({ type: String, default: null })
  notes?: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  recordedBy?: Types.ObjectId | null;
}

export const NapUpdateSchema = SchemaFactory.createForClass(NapUpdate);
