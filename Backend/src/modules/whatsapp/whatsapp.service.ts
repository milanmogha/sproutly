import { Injectable, Logger } from '@nestjs/common';
import { SendWhatsappDto } from './dto/send-whatsapp.dto';
import {
  WhatsappProvider,
  WhatsappSendResult,
} from './providers/whatsapp.provider';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly provider: WhatsappProvider) {}

  send(dto: SendWhatsappDto): Promise<WhatsappSendResult> {
    const body =
      dto.body ?? (dto.params ? dto.params.join(' ') : (dto.template ?? ''));
    return this.provider.sendText(dto.to, body);
  }

  /**
   * Sends a parent their one-time login code.
   *
   * The code is never logged here or anywhere below: a login secret in a log
   * file is readable by anyone with server access long after it was used, and
   * the whole point of moving off the terminal was to stop doing that. Only
   * whether delivery succeeded is recorded.
   */
  async sendOtp(phone: string, code: string, ttlMinutes: number): Promise<boolean> {
    const result = await this.provider.sendText(
      phone,
      `${code} is your Sproutly login code. It expires in ${ttlMinutes} minute${
        ttlMinutes === 1 ? '' : 's'
      }. Do not share it with anyone.`,
    );

    if (result.skipped) {
      // Switched off — not a delivery failure, but nothing was sent either, so
      // say so plainly rather than letting a parent wait for a code.
      this.logger.warn(
        'WhatsApp is disabled, so no login code was sent. Set WHATSAPP_ENABLED=true.',
      );
    }
    return result.success && !result.skipped;
  }
}
