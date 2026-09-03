import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type EventDocument = HydratedDocument<Event>;

export enum EventAudience {
  ALL = 'all',
  PARENTS = 'parents',
  TEACHERS = 'teachers',
}

@Schema({ timestamps: true })
export class Event {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, default: null })
  description?: string;

  @Prop({ type: Date, required: true, index: true })
  startDate: Date;

  @Prop({ type: Date, default: null })
  endDate?: Date | null;

  @Prop({ type: String, default: null })
  venue?: string;

  @Prop({
    type: String,
    enum: Object.values(EventAudience),
    default: EventAudience.ALL,
  })
  audience: EventAudience;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const EventSchema = SchemaFactory.createForClass(Event);
