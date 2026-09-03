import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { PaymentMethod } from '../../../common/enums/payment-method.enum';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  // Unique per school, not globally — see compound index below.
  @Prop({ required: true, trim: true })
  paymentNumber: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Invoice', required: true, index: true })
  invoice: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  @Prop({ type: String, enum: PaymentMethod, required: true })
  method: PaymentMethod;

  /** Transaction id, cheque number, etc. */
  @Prop({ type: String, default: null })
  reference?: string | null;

  /**
   * Lifecycle of the payment. Manual entries are 'success' immediately; a
   * future online gateway can create a 'pending' row and flip it on webhook.
   */
  @Prop({
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'success',
    index: true,
  })
  status: 'pending' | 'success' | 'failed';

  /** Gateway seam — populated only for online payments (Razorpay/Stripe/…). */
  @Prop({ type: String, default: null })
  gateway?: string | null;

  @Prop({ type: String, default: null })
  gatewayOrderId?: string | null;

  @Prop({ type: String, default: null })
  gatewayPaymentId?: string | null;

  @Prop({ type: Date, default: () => new Date(), index: true })
  paidAt: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  receivedBy?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  note?: string | null;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ schoolId: 1, paymentNumber: 1 }, { unique: true });

/**
 * One payment row per gateway order — the database-level guarantee behind the
 * idempotent webhook.
 *
 * A *partial* index, not a sparse one. `gatewayOrderId` defaults to `null`, and
 * sparse only skips documents where the key is **absent** — so with sparse, the
 * second cash payment ever recorded would collide with the first on `null`.
 * Indexing only documents whose value is really a string avoids that.
 */
PaymentSchema.index(
  { gatewayOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: { gatewayOrderId: { $type: 'string' } },
  },
);
