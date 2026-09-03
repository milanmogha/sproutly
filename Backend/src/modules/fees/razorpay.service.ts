import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import Razorpay from 'razorpay';
import { safeEqualHex } from '../../common/utils/crypto.util';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

/**
 * Thin wrapper over the Razorpay SDK.
 *
 * Every call is per-school: the credentials come from the school's own account
 * (see SchoolsService.paymentCredentials), so a client is built per request
 * rather than injected once. That's cheap — the SDK object is just a config
 * holder around HTTP calls.
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);

  /**
   * Razorpay works in the currency's smallest unit, so rupees become paise.
   * Fee amounts can carry decimals, and 0.1 + 0.2 style drift would produce a
   * non-integer paise value that the API rejects — so round explicitly.
   */
  toPaise(rupees: number): number {
    const paise = Math.round(rupees * 100);
    if (!Number.isSafeInteger(paise) || paise <= 0) {
      throw new BadRequestException(`Cannot charge an amount of ${rupees}`);
    }
    return paise;
  }

  toRupees(paise: number): number {
    return Math.round(paise) / 100;
  }

  async createOrder(params: {
    keyId: string;
    keySecret: string;
    amountPaise: number;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayOrder> {
    const client = new Razorpay({
      key_id: params.keyId,
      key_secret: params.keySecret,
    });
    try {
      const order = await client.orders.create({
        amount: params.amountPaise,
        currency: 'INR',
        // Razorpay caps receipt at 40 chars.
        receipt: params.receipt.slice(0, 40),
        notes: params.notes,
      });
      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
      };
    } catch (err) {
      // The SDK surfaces auth failures here — most often wrong/expired keys.
      this.logger.error(
        `Razorpay order creation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException(
        'Could not start the payment. The school’s payment settings may be wrong — please pay at school or try later.',
      );
    }
  }

  /**
   * Verifies the handshake the client gets back from checkout:
   * HMAC-SHA256(order_id + "|" + payment_id) keyed with the API secret.
   */
  verifyCheckoutSignature(params: {
    keySecret: string;
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    const expected = createHmac('sha256', params.keySecret)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest('hex');
    return safeEqualHex(expected, params.signature);
  }

  /**
   * Verifies a webhook: HMAC-SHA256 of the RAW request body keyed with the
   * webhook secret (which is separate from the API secret). Must run against
   * the exact bytes received — re-serialising the parsed JSON changes them.
   */
  verifyWebhookSignature(params: {
    webhookSecret: string;
    rawBody: Buffer | string;
    signature: string;
  }): boolean {
    const expected = createHmac('sha256', params.webhookSecret)
      .update(params.rawBody)
      .digest('hex');
    return safeEqualHex(expected, params.signature);
  }
}
