import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ClassDocument = HydratedDocument<Class>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Class {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  /** e.g. "Grade 1", "Nursery", "Playgroup". */
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: 'A', trim: true })
  section: string;

  /** e.g. "2025-2026". */
  @Prop({ required: true, trim: true, index: true })
  academicYear: string;

  @Prop({ type: Number, default: 30, min: 1 })
  capacity: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  classTeacher?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  room?: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const ClassSchema = SchemaFactory.createForClass(Class);

// One class per school+name+section+year.
ClassSchema.index(
  { schoolId: 1, name: 1, section: 1, academicYear: 1 },
  { unique: true },
);

ClassSchema.virtual('displayName').get(function (this: Class): string {
  return `${this.name} - ${this.section}`;
});
