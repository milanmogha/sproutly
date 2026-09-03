import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { FeeFrequency } from '../../../common/enums/fee-frequency.enum';

export type FeeStructureDocument = HydratedDocument<FeeStructure>;

@Schema({ _id: false })
export class FeeComponent {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;
}

export const FeeComponentSchema = SchemaFactory.createForClass(FeeComponent);

@Schema({ timestamps: true })
export class FeeStructure {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  academicYear: string;

  /** When set, this structure applies to a specific class; null = any. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', default: null, index: true })
  classId?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: FeeFrequency,
    default: FeeFrequency.TERM,
  })
  frequency: FeeFrequency;

  @Prop({ type: [FeeComponentSchema], default: [] })
  components: FeeComponent[];

  @Prop({ type: Number, default: 0, min: 0 })
  totalAmount: number;

  /** Optional day-of-month used when generating invoice due dates. */
  @Prop({ type: Number, default: null, min: 1, max: 31 })
  dueDayOfMonth?: number | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const FeeStructureSchema = SchemaFactory.createForClass(FeeStructure);
