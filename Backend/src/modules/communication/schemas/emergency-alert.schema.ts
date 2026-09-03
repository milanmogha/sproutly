import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { CircularAudience } from './circular.schema';

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export type EmergencyAlertDocument = HydratedDocument<EmergencyAlert>;

@Schema({ timestamps: true })
export class EmergencyAlert {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({
    type: String,
    enum: AlertSeverity,
    default: AlertSeverity.WARNING,
  })
  severity: AlertSeverity;

  @Prop({
    type: String,
    enum: CircularAudience,
    default: CircularAudience.ALL,
  })
  audience: CircularAudience;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', default: null })
  classId?: Types.ObjectId | null;

  @Prop({ type: Date, default: () => new Date(), index: true })
  sentAt: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  sentBy?: Types.ObjectId | null;
}

export const EmergencyAlertSchema =
  SchemaFactory.createForClass(EmergencyAlert);
