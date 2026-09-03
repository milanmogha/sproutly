import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type LessonPlanDocument = HydratedDocument<LessonPlan>;

@Schema({ timestamps: true })
export class LessonPlan {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', required: true, index: true })
  classId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: [String], default: [] })
  objectives: string[];

  @Prop({ type: [String], default: [] })
  activities: string[];

  @Prop({ type: String, default: null })
  resources?: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;
}

export const LessonPlanSchema = SchemaFactory.createForClass(LessonPlan);
