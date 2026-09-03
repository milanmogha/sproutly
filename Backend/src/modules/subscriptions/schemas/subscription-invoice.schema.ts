import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { PaymentMethod } from '../../../common/enums/payment-method.enum';

export type SubscriptionInvoiceDocument =
  HydratedDocument<SubscriptionInvoice>;

export enum SubscriptionInvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

/**
 * What a school owes the platform for a stretch of service.
 *
 * The super admin raises one of these for whatever duration they've agreed —
 * 15 days as a trial, two years for a long contract — and the school pays it
 * online or at the owner's office. There is no self-service renewal: when a
 * period ends the school talks to the owner, who raises the next invoice.
 *
 * Unlike a fee invoice this is settled in one go, so the payment lives on the
 * invoice rather than in a separate collection.
 */
@Schema({ timestamps: true })
export class SubscriptionInvoice {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  invoiceNumber: string;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  /**
   * How much service this buys. The dates below are provisional until the
   * invoice is paid — paying late or early shifts the window, so the duration
   * is the durable fact and the period is derived from it.
   */
  @Prop({ type: Number, required: true, min: 1 })
  durationDays: number;

  /** Human label for the duration the super admin picked, e.g. "6 months". */
  @Prop({ type: String, default: null })
  durationLabel?: string | null;

  /** Provisional at creation; finalised when the invoice is paid. */
  @Prop({ type: Date, required: true })
  periodStart: Date;

  @Prop({ type: Date, required: true, index: true })
  periodEnd: Date;

  @Prop({
    type: String,
    enum: SubscriptionInvoiceStatus,
    default: SubscriptionInvoiceStatus.PENDING,
    index: true,
  })
  status: SubscriptionInvoiceStatus;

  @Prop({ type: Date, default: () => new Date() })
  issuedAt: Date;

  @Prop({ type: Date, default: null })
  paidAt?: Date | null;

  /** Null until paid; `online` for gateway payments. */
  @Prop({ type: String, enum: PaymentMethod, default: null })
  method?: PaymentMethod | null;

  /** Transaction id, cheque number, or whatever the office recorded. */
  @Prop({ type: String, default: null })
  reference?: string | null;

  /** Set when the super admin took the money at the office. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  recordedBy?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  notes?: string | null;

  // ── Gateway seam (platform's own Razorpay account) ──────
  //
  // Unlike school fees, this collects into the PLATFORM's account, so the
  // credentials come from env rather than the school record.

  @Prop({
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: null,
  })
  gatewayStatus?: 'pending' | 'success' | 'failed' | null;

  @Prop({ type: String, default: null })
  gatewayOrderId?: string | null;

  @Prop({ type: String, default: null })
  gatewayPaymentId?: string | null;
}

export const SubscriptionInvoiceSchema = SchemaFactory.createForClass(
  SubscriptionInvoice,
);

SubscriptionInvoiceSchema.index(
  { schoolId: 1, invoiceNumber: 1 },
  { unique: true },
);

/**
 * One invoice per gateway order — the idempotency guarantee for the webhook.
 *
 * A *partial* index, not a sparse one: the field defaults to `null`, and
 * sparse only skips documents where the key is absent, so every office-paid
 * invoice would collide on `null` with the last. Restricting the index to
 * documents whose value is actually a string sidesteps that entirely.
 */
SubscriptionInvoiceSchema.index(
  { gatewayOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: { gatewayOrderId: { $type: 'string' } },
  },
);
