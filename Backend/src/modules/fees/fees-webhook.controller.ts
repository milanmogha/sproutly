import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { FeesService } from './fees.service';
import { RazorpayService } from './razorpay.service';
import { SchoolsService } from '../schools/schools.service';

/** The slice of Razorpay's webhook payload we act on. */
interface RazorpayWebhookBody {
  event?: string;
  payload?: {
    payment?: {
      entity?: { id?: string; order_id?: string };
    };
    order?: {
      entity?: { id?: string };
    };
  };
}

/**
 * Razorpay's server-to-server callback — the authoritative confirmation that
 * money moved. Deliberately its own controller with **no guards**: it is called
 * by Razorpay, not by a signed-in user, so there's no JWT to present.
 *
 * The signature is the authentication. Every school has its own Razorpay
 * account and therefore its own webhook secret, so the URL carries the school
 * id — without it the server couldn't know which secret to verify against.
 * Each school pastes its own `/api/fees/webhook/razorpay/<schoolId>` into its
 * Razorpay dashboard.
 */
@Controller('fees/webhook')
export class FeesWebhookController {
  private readonly logger = new Logger(FeesWebhookController.name);

  constructor(
    private readonly feesService: FeesService,
    private readonly razorpay: RazorpayService,
    private readonly schoolsService: SchoolsService,
  ) {}

  @Post('razorpay/:schoolId')
  @HttpCode(HttpStatus.OK)
  async razorpayWebhook(
    @Param('schoolId') schoolId: string,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    if (!signature) {
      throw new BadRequestException('Missing signature');
    }
    // Must be the exact bytes received — re-serialising the parsed JSON would
    // change key order/whitespace and break the HMAC.
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    // Deliberately not `paymentCredentials`: verification must keep working
    // even if the school has since paused online payments, or a payment
    // caught mid-flight could never settle.
    const creds = await this.schoolsService.storedCredentials(schoolId);
    if (!creds?.webhookSecret) {
      // 200, not 4xx — there is nothing to retry, and a non-2xx would have
      // Razorpay redelivering this forever.
      this.logger.warn(`Webhook for ${schoolId} but no webhook secret stored`);
      return { received: true };
    }

    const valid = this.razorpay.verifyWebhookSignature({
      webhookSecret: creds.webhookSecret,
      rawBody,
      signature,
    });
    if (!valid) {
      // Don't leak which part failed — this endpoint is public.
      this.logger.warn(`Rejected webhook with a bad signature (${schoolId})`);
      throw new BadRequestException('Invalid signature');
    }

    const body = req.body as RazorpayWebhookBody;
    const event = body.event ?? '';
    const orderId =
      body.payload?.payment?.entity?.order_id ??
      body.payload?.order?.entity?.id;
    const paymentId = body.payload?.payment?.entity?.id;

    if (!orderId) {
      // Nothing we can match — acknowledge so Razorpay stops retrying.
      this.logger.warn(`Webhook ${event} carried no order id (${schoolId})`);
      return { received: true };
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      const settled = await this.feesService.settleGatewayPayment({
        schoolId,
        orderId,
        gatewayPaymentId: paymentId ?? orderId,
      });
      this.logger.log(
        settled
          ? `Settled ${orderId} → invoice ${String(settled.invoice.invoiceNumber)}`
          : `Ignored duplicate ${event} for ${orderId}`,
      );
    } else if (event === 'payment.failed') {
      await this.feesService.failGatewayPayment(schoolId, orderId);
      this.logger.log(`Marked ${orderId} failed`);
    }

    // Always 200 for anything we've verified — a non-2xx makes Razorpay retry,
    // and there's nothing to retry for events we simply don't act on.
    return { received: true };
  }
}
