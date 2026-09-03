import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type EventRegistrationDocument = HydratedDocument<EventRegistration>;

@Schema({ timestamps: true })
export class EventRegistration {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Event', required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // Set when a parent registers a specific child for the event.
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', default: null })
  studentId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  notes?: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const EventRegistrationSchema =
  SchemaFactory.createForClass(EventRegistration);

// One registration per user+student per event.
EventRegistrationSchema.index(
  { eventId: 1, userId: 1, studentId: 1 },
  { unique: true },
);
