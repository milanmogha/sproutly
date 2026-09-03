import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum MilestoneCategory {
  COGNITIVE = 'cognitive',
  MOTOR = 'motor',
  LANGUAGE = 'language',
  SOCIAL = 'social',
  EMOTIONAL = 'emotional',
  SELF_HELP = 'self_help',
}

export enum MilestoneStatus {
  NOT_STARTED = 'not_started',
  EMERGING = 'emerging',
  ACHIEVED = 'achieved',
}

export type MilestoneDocument = HydratedDocument<Milestone>;

@Schema({ timestamps: true })
export class Milestone {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    type: String,
    enum: MilestoneCategory,
    default: MilestoneCategory.COGNITIVE,
  })
  category: MilestoneCategory;

  @Prop({
    type: String,
    enum: MilestoneStatus,
    default: MilestoneStatus.NOT_STARTED,
  })
  status: MilestoneStatus;

  @Prop({ type: Date, default: null })
  achievedDate?: Date | null;

  @Prop({ type: String, default: null })
  notes?: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  recordedBy?: Types.ObjectId | null;
}

export const MilestoneSchema = SchemaFactory.createForClass(Milestone);
