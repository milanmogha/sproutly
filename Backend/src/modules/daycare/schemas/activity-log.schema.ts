import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum ActivityCategory {
  ART = 'art',
  MUSIC = 'music',
  PLAY = 'play',
  LEARNING = 'learning',
  OUTDOOR = 'outdoor',
  STORY = 'story',
  OTHER = 'other',
}

export type ActivityLogDocument = HydratedDocument<ActivityLog>;

@Schema({ timestamps: true })
export class ActivityLog {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', default: null })
  classId?: Types.ObjectId | null;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    type: String,
    enum: ActivityCategory,
    default: ActivityCategory.OTHER,
  })
  category: ActivityCategory;

  @Prop({ type: String, default: null })
  description?: string | null;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ type: String, default: null })
  notes?: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  recordedBy?: Types.ObjectId | null;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
