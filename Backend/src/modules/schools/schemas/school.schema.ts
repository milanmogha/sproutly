import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SchoolStatus } from '../../../common/enums/school-status.enum';

export type SchoolDocument = HydratedDocument<School>;

/** A school's own payment-gateway account. Only Razorpay for now. */
@Schema({ _id: false })
export class PaymentGateway {
  @Prop({ type: String, default: 'razorpay' })
  provider: string;

  /** Public — the client needs it to open checkout. */
  @Prop({ type: String, default: null })
  keyId?: string | null;

  /** Ciphertext. Never send to a client. */
  @Prop({ type: String, default: null })
  keySecret?: string | null;

  /** Ciphertext. Verifies webhooks from this school's Razorpay account. */
  @Prop({ type: String, default: null })
  webhookSecret?: string | null;

  /** Off by default — a school with keys can still be paused by the platform. */
  @Prop({ type: Boolean, default: false })
  enabled: boolean;

  @Prop({ type: Date, default: null })
  updatedAt?: Date | null;
}

export const PaymentGatewaySchema =
  SchemaFactory.createForClass(PaymentGateway);

@Schema({ timestamps: true })
export class School {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  /**
   * The owner this school is a branch of, when it is one. Null — the norm —
   * means an independent school, which is why nothing had to be migrated when
   * owners arrived.
   *
   * Grouping only: it never widens what anyone inside the school can see. The
   * branches remain separate tenants with separate admin logins, and every
   * school-scoped query still filters on `schoolId` alone.
   */
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Owner',
    default: null,
    index: true,
  })
  ownerId?: Types.ObjectId | null;

  @Prop({ required: true, unique: true, trim: true, uppercase: true, index: true })
  code: string;

  @Prop(
    raw({
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String },
    }),
  )
  address?: Record<string, string>;

  @Prop({ type: String, default: null })
  contactEmail?: string;

  @Prop({ type: String, default: null })
  contactPhone?: string;

  // ── Printed-document header ─────────────────────────────
  //
  // These exist for the fee receipt, which reproduces the school's own
  // letterhead. Optional throughout: a school that hasn't filled them in gets
  // a receipt with those lines simply absent, never a blank label.

  /** The society or trust above the school name, e.g. "…Shikshan Mandal's". */
  @Prop({ type: String, default: null, trim: true })
  trustName?: string | null;

  @Prop({ type: String, default: null, trim: true })
  website?: string | null;

  /** Board affiliation number, printed alongside the website. */
  @Prop({ type: String, default: null, trim: true })
  affiliationNumber?: string | null;

  /** The school's active academic year, e.g. "2025-26". Admin-settable. */
  @Prop({ type: String, default: null })
  currentAcademicYear?: string;

  @Prop({
    type: String,
    enum: SchoolStatus,
    default: SchoolStatus.ACTIVE,
    index: true,
  })
  status: SchoolStatus;

  @Prop({ type: [String], default: [] })
  enabledModules: string[];

  /**
   * The school's own Razorpay account, so fee money moves parent → school
   * directly rather than through the platform. Filled in by the SUPER ADMIN
   * (the school hands over its keys); never editable or readable by the school.
   *
   * `keySecret` and `webhookSecret` are AES-GCM ciphertext (see crypto.util) —
   * they must never be serialised to a client. `keyId` is public by design:
   * the app needs it to open Razorpay checkout.
   */
  @Prop({ type: PaymentGatewaySchema, default: null })
  paymentGateway?: PaymentGateway | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const SchoolSchema = SchemaFactory.createForClass(School);

/**
 * Belt and braces on the gateway secrets: strip them whenever a school is
 * serialised to a response, so no controller can leak them by forgetting to.
 * `keyId` and `enabled` survive — the app needs those to open checkout.
 * Server-side code reads the ciphertext off the document, which is untouched.
 */
function stripGatewaySecrets(_doc: unknown, ret: School) {
  const gateway = ret.paymentGateway;
  if (gateway) {
    delete gateway.keySecret;
    delete gateway.webhookSecret;
  }
  return ret;
}

SchoolSchema.set('toJSON', { transform: stripGatewaySecrets });
SchoolSchema.set('toObject', { transform: stripGatewaySecrets });
