import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../../common/enums/payment-method.enum';

/**
 * The super admin bills a school for whatever stretch they've agreed. There
 * are no fixed plans — a 15-day trial and a two-year contract are the same
 * shape, just different numbers.
 */
export class CreateSubscriptionInvoiceDto {
  @IsNumber()
  @Min(0)
  amount: number;

  /** Roughly a day to ten years. */
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays: number;

  /** What the super admin called it, e.g. "6 months". Shown to the school. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  durationLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** The super admin took payment at the office. */
export class RecordSubscriptionPaymentDto {
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  /** Defaults to now; set it when logging a payment received earlier. */
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

/** Exactly what Razorpay checkout hands back on success. */
export class VerifySubscriptionPaymentDto {
  @IsString()
  razorpayOrderId: string;

  @IsString()
  razorpayPaymentId: string;

  @IsString()
  razorpaySignature: string;
}
