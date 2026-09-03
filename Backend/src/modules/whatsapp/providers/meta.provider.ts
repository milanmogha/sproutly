import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  toWhatsappNumber,
  WhatsappProvider,
  WhatsappSendResult,
} from './whatsapp.provider';

/**
 * WhatsApp Cloud API, straight from Meta.
 *
 * Note the platform rule this cannot escape: free-form text only reaches a
 * recipient within 24 hours of *their* last message. Outside that window Meta
 * rejects it and only a pre-approved template will go through — so this
 * transport is not suitable for unprompted messages like a login code unless
 * the template path is added.
 */
@Injectable()
export class MetaWhatsappProvider extends WhatsappProvider {
  private readonly logger = new Logger(MetaWhatsappProvider.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async sendText(to: string, body: string): Promise<WhatsappSendResult> {
    if (!this.config.get<boolean>('whatsapp.enabled')) {
      this.logger.debug('WhatsApp disabled, skipping message');
      return { success: true, skipped: true };
    }

    const apiUrl = this.config.get<string>('whatsapp.apiUrl');
    const phoneNumberId = this.config.get<string>('whatsapp.phoneNumberId');
    const accessToken = this.config.get<string>('whatsapp.accessToken');

    const res = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toWhatsappNumber(to),
        type: 'text',
        text: { body },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      // Never log `body` — for a login code that would put the secret in the
      // log file, which is most of the point of not printing it.
      this.logger.error(`WhatsApp send failed (${res.status}): ${err}`);
      return { success: false };
    }

    const json = (await res.json()) as { messages?: { id: string }[] };
    return { success: true, messageId: json.messages?.[0]?.id };
  }
}
