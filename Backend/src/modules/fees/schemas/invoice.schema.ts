import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { FeeStatus } from '../../../common/enums/fee-status.enum';

export type InvoiceDocument = HydratedDocument<Invoice>;

@Schema({ _id: false })
export class InvoiceLine {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;
}

export const InvoiceLineSchema = SchemaFactory.createForClass(InvoiceLine);

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Invoice {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  // Unique per school, not globally — see compound index below.
  @Prop({ required: true, trim: true })
  invoiceNumber: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', default: null, index: true })
  classId?: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'FeeStructure', default: null })
  feeStructure?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  academicYear: string;

  /** e.g. "2026-07", "Term 1". */
  @Prop({ required: true, trim: true })
  period: string;

  @Prop({ type: [InvoiceLineSchema], default: [] })
  lineItems: InvoiceLine[];

  @Prop({ type: Number, required: true, min: 0 })
  totalAmount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  amountPaid: number;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  /** 0-based position within its session (Apr = 0 for monthly, etc.). */
  @Prop({ type: Number, default: null })
  installmentIndex?: number | null;

  @Prop({
    type: String,
    enum: FeeStatus,
    default: FeeStatus.PENDING,
    index: true,
  })
  status: FeeStatus;

  /**
   * When this invoice reaches the parent. For a whole session generated at
   * once this is in the future for every month after the first — the row sits
   * SCHEDULED until the daily sweep reaches this date.
   */
  @Prop({ type: Date, default: () => new Date(), index: true })
  issuedAt: Date;

  /** Set once the on-due-date reminder has gone out, so it is never resent. */
  @Prop({ type: Date, default: null })
  dueReminderSentAt?: Date | null;

  /** Set once the overdue reminder has gone out, so it is never resent. */
  @Prop({ type: Date, default: null })
  overdueReminderSentAt?: Date | null;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index({ schoolId: 1, invoiceNumber: 1 }, { unique: true });

InvoiceSchema.virtual('balance').get(function (this: Invoice): number {
  return Math.max(0, this.totalAmount - this.amountPaid);
});
