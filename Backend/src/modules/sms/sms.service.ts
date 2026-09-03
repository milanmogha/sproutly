import { Injectable, Logger } from '@nestjs/common';

/**
 * Outbound SMS.
 *
 * No provider is wired, so this only logs. Nothing sends through it today —
 * parent login codes go over WhatsApp (see WhatsappService.sendOtp). It stays
 * as the seam for a real transport (Twilio / MSG91 / AWS SNS) should SMS be
 * needed as a fallback channel.
 *
 * If that day comes: never log the message body for anything carrying a
 * secret. A login code in a log file outlives its five-minute validity by
 * however long the logs are kept.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async deliver(msg: { to: string; text: string }): Promise<void> {
    // TODO: replace with a real SMS transport.
    this.logger.log(`[sms pending provider] to=${msg.to}`);
    await Promise.resolve();
  }
}
