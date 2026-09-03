import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  sender: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  recipient: Types.ObjectId;

  @Prop({ type: String, default: null })
  subject?: string | null;

  @Prop({ required: true, trim: true })
  body: string;

  /** Optional student this conversation is about. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', default: null })
  relatedStudent?: Types.ObjectId | null;

  @Prop({ type: Boolean, default: false, index: true })
  read: boolean;

  @Prop({ type: Date, default: null })
  readAt?: Date | null;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
