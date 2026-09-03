import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum Mood {
  HAPPY = 'happy',
  CALM = 'calm',
  CRANKY = 'cranky',
  TIRED = 'tired',
  UPSET = 'upset',
  ENERGETIC = 'energetic',
}

export type BehavioralObservationDocument =
  HydratedDocument<BehavioralObservation>;

@Schema({ timestamps: true })
export class BehavioralObservation {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', default: null })
  classId?: Types.ObjectId | null;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: String, enum: Mood, required: true })
  mood: Mood;

  @Prop({ required: true, trim: true })
  observation: string;

  @Prop({ type: String, default: null })
  context?: string | null;

  @Prop({ type: String, default: null })
  notes?: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  recordedBy?: Types.ObjectId | null;
}

export const BehavioralObservationSchema = SchemaFactory.createForClass(
  BehavioralObservation,
);
