import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type HomeworkDocument = HydratedDocument<Homework>;

@Schema({ timestamps: true })
export class Homework {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', required: true, index: true })
  classId: Types.ObjectId;

  @Prop({ type: String, default: null })
  description?: string | null;

  @Prop({ type: Date, default: () => new Date(), index: true })
  assignedDate: Date;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;
}

export const HomeworkSchema = SchemaFactory.createForClass(Homework);
