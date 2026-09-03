import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type SyllabusDocument = HydratedDocument<Syllabus>;

@Schema({ _id: false })
export class SyllabusUnit {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: [String], default: [] })
  topics: string[];

  @Prop({ type: Boolean, default: false })
  completed: boolean;
}

export const SyllabusUnitSchema = SchemaFactory.createForClass(SyllabusUnit);

@Schema({ timestamps: true })
export class Syllabus {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', required: true, index: true })
  classId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ required: true, trim: true })
  academicYear: string;

  @Prop({ type: [SyllabusUnitSchema], default: [] })
  units: SyllabusUnit[];

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;
}

export const SyllabusSchema = SchemaFactory.createForClass(Syllabus);

SyllabusSchema.index(
  { classId: 1, subject: 1, academicYear: 1 },
  { unique: true },
);
