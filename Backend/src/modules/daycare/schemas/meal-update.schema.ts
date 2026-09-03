import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum MealType {
  BREAKFAST = 'breakfast',
  MORNING_SNACK = 'morning_snack',
  LUNCH = 'lunch',
  AFTERNOON_SNACK = 'afternoon_snack',
  DINNER = 'dinner',
}

export enum MealAmount {
  ALL = 'all',
  MOST = 'most',
  SOME = 'some',
  NONE = 'none',
  REFUSED = 'refused',
}

export type MealUpdateDocument = HydratedDocument<MealUpdate>;

@Schema({ timestamps: true })
export class MealUpdate {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', default: null })
  classId?: Types.ObjectId | null;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: String, enum: MealType, required: true })
  mealType: MealType;

  @Prop({ required: true, trim: true })
  menu: string;

  @Prop({ type: String, enum: MealAmount, default: MealAmount.SOME })
  amountEaten: MealAmount;

  @Prop({ type: String, default: null })
  notes?: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  recordedBy?: Types.ObjectId | null;
}

export const MealUpdateSchema = SchemaFactory.createForClass(MealUpdate);
