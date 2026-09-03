import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { RazorpayService } from '../fees/razorpay.service';
import { SubscriptionsService } from './subscriptions.service';

interface RazorpayWebhookBody {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
    order?: { entity?: { id?: string } };
  };
}

/**
 * Razorpay's callback for **platform** subscription payments.
 *
 * Unlike the fee webhook there's no school id in the path: this money goes to
 * one account — the platform's — so there's one webhook secret, read from env.
 * No guards, because Razorpay has no JWT; the signature is the authentication.
 */
@Controller('subscriptions/webhook')
export class SubscriptionsWebhookController {
  private readonly logger = new Logger(SubscriptionsWebhookController.name);

  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly razorpay: RazorpayService,
  ) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  async razorpayWebhook(
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    if (!signature) throw new BadRequestException('Missing signature');

    // Must be the bytes as sent — re-serialised JSON won't match the HMAC.
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Missing raw body');

    const secret = this.subscriptions.webhookSecret();
    if (!secret) {
      // 200 rather than 4xx: nothing here is retryable, and a non-2xx would
      // have Razorpay redelivering indefinitely.
      this.logger.warn(
        'Subscription webhook received but no platform webhook secret is set',
      );
      return { received: true };
    }

    const valid = this.razorpay.verifyWebhookSignature({
      webhookSecret: secret,
      rawBody,
      signature,
    });
    if (!valid) {
      this.logger.warn('Rejected a subscription webhook with a bad signature');
      throw new BadRequestException('Invalid signature');
    }

    const body = req.body as RazorpayWebhookBody;
    const event = body.event ?? '';
    const orderId =
      body.payload?.payment?.entity?.order_id ??
      body.payload?.order?.entity?.id;
    const paymentId = body.payload?.payment?.entity?.id;

    if (!orderId) {
      this.logger.warn(`Subscription webhook ${event} carried no order id`);
      return { received: true };
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      const settled = await this.subscriptions.settleByOrder(
        orderId,
        paymentId ?? orderId,
      );
      this.logger.log(
        settled
          ? `Subscription ${settled.invoiceNumber} paid — active until ${settled.periodEnd.toDateString()}`
          : `Ignored duplicate ${event} for ${orderId}`,
      );
    } else if (event === 'payment.failed') {
      await this.subscriptions.failByOrder(orderId);
    }

    // Anything verified gets a 200 — a non-2xx just makes Razorpay retry.
    return { received: true };
  }
}
