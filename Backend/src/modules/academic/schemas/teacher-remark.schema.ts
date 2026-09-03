import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum RemarkCategory {
  ACADEMIC = 'academic',
  BEHAVIOR = 'behavior',
  GENERAL = 'general',
  APPRECIATION = 'appreciation',
  CONCERN = 'concern',
}

export type TeacherRemarkDocument = HydratedDocument<TeacherRemark>;

@Schema({ timestamps: true })
export class TeacherRemark {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  @Prop({ required: true, trim: true })
  remark: string;

  @Prop({
    type: String,
    enum: RemarkCategory,
    default: RemarkCategory.GENERAL,
  })
  category: RemarkCategory;

  @Prop({ type: Date, default: () => new Date(), index: true })
  date: Date;

  @Prop({ type: String, default: null })
  term?: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  recordedBy?: Types.ObjectId | null;
}

export const TeacherRemarkSchema = SchemaFactory.createForClass(TeacherRemark);
