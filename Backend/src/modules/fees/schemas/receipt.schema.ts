import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ReceiptDocument = HydratedDocument<Receipt>;

@Schema({ timestamps: true })
export class Receipt {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  // Unique per school, not globally — see compound index below.
  @Prop({ required: true, trim: true })
  receiptNumber: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Payment', required: true })
  payment: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Invoice', required: true })
  invoice: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  /** Invoice balance remaining immediately after this payment. */
  @Prop({ type: Number, required: true, min: 0 })
  balanceAfter: number;

  @Prop({ type: Date, default: () => new Date() })
  issuedAt: Date;
}

export const ReceiptSchema = SchemaFactory.createForClass(Receipt);

ReceiptSchema.index({ schoolId: 1, receiptNumber: 1 }, { unique: true });
