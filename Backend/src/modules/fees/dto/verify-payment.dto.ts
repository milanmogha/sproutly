import { IsString } from 'class-validator';

/** Exactly what Razorpay checkout hands back to the client on success. */
export class VerifyPaymentDto {
  @IsString()
  razorpayOrderId: string;

  @IsString()
  razorpayPaymentId: string;

  /** HMAC of `orderId|paymentId`, keyed with the school's API secret. */
  @IsString()
  razorpaySignature: string;
}
