import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum HealthUpdateType {
  TEMPERATURE = 'temperature',
  MEDICATION = 'medication',
  INCIDENT = 'incident',
  SYMPTOM = 'symptom',
  GENERAL = 'general',
}

export enum HealthSeverity {
  INFO = 'info',
  ATTENTION = 'attention',
  URGENT = 'urgent',
}

export type HealthUpdateDocument = HydratedDocument<HealthUpdate>;

@Schema({ timestamps: true })
export class HealthUpdate {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', default: null })
  classId?: Types.ObjectId | null;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: String, enum: HealthUpdateType, required: true })
  type: HealthUpdateType;

  @Prop({ required: true, trim: true })
  description: string;

  /** Body temperature in °C, when applicable. */
  @Prop({ type: Number, default: null })
  temperature?: number | null;

  @Prop({ type: String, default: null })
  medication?: string | null;

  @Prop({ type: String, enum: HealthSeverity, default: HealthSeverity.INFO })
  severity: HealthSeverity;

  @Prop({ type: String, default: null })
  notes?: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  recordedBy?: Types.ObjectId | null;
}

export const HealthUpdateSchema = SchemaFactory.createForClass(HealthUpdate);
