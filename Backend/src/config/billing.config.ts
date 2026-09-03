import { registerAs } from '@nestjs/config';

/**
 * The platform's own Razorpay account — what schools pay Sproutly for the
 * service. Distinct from school fees, where each school brings its own keys
 * (stored encrypted on the School record); there is exactly one of these.
 *
 * Leaving these unset simply turns online subscription payments off; the super
 * admin can still record payments taken at the office.
 */
export default registerAs('billing', () => ({
  razorpayKeyId: process.env.PLATFORM_RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.PLATFORM_RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.PLATFORM_RAZORPAY_WEBHOOK_SECRET || '',
}));
