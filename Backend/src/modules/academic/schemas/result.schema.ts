import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ResultDocument = HydratedDocument<Result>;

@Schema({ timestamps: true })
export class Result {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Assessment',
    required: true,
    index: true,
  })
  assessment: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  score: number;

  /** Optional qualitative grade (e.g. "A", "Excellent", "Needs practice"). */
  @Prop({ type: String, default: null })
  grade?: string | null;

  @Prop({ type: String, default: null })
  remarks?: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  recordedBy?: Types.ObjectId | null;
}

export const ResultSchema = SchemaFactory.createForClass(Result);

// One result per student per assessment.
ResultSchema.index({ assessment: 1, student: 1 }, { unique: true });
