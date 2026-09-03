import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum AssessmentType {
  QUIZ = 'quiz',
  TEST = 'test',
  EXAM = 'exam',
  PROJECT = 'project',
  ORAL = 'oral',
  OBSERVATION = 'observation',
  ASSIGNMENT = 'assignment',
}

export type AssessmentDocument = HydratedDocument<Assessment>;

@Schema({ timestamps: true })
export class Assessment {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', required: true, index: true })
  classId: Types.ObjectId;

  @Prop({ type: String, enum: AssessmentType, default: AssessmentType.TEST })
  type: AssessmentType;

  @Prop({ type: Number, default: 100, min: 1 })
  maxScore: number;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: String, default: null })
  description?: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;
}

export const AssessmentSchema = SchemaFactory.createForClass(Assessment);
