import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/**
 * The super admin fills these in from what the school hands over. Secrets are
 * write-only: the API never reads them back, so an empty field on an update
 * means "leave the stored one alone", not "clear it".
 */
export class SetPaymentGatewayDto {
  /** Razorpay key ids look like `rzp_test_xxx` / `rzp_live_xxx`. */
  @IsString()
  @Matches(/^rzp_(test|live)_[A-Za-z0-9]+$/, {
    message: 'keyId must look like rzp_test_xxxx or rzp_live_xxxx',
  })
  keyId: string;

  /** Omit to keep the secret already stored. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  keySecret?: string;

  /** Omit to keep the webhook secret already stored. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  webhookSecret?: string;

  /** Off means parents fall back to paying at school. */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
