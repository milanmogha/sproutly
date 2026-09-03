import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  recipient: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: String, default: 'general' })
  type: string;

  @Prop({ type: Object, default: {} })
  data?: Record<string, unknown>;

  @Prop({ type: Boolean, default: false, index: true })
  read: boolean;

  @Prop({ type: Date, default: null })
  sentAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
