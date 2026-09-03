import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  toWhatsappNumber,
  WhatsappProvider,
  WhatsappSendResult,
} from './whatsapp.provider';

/**
 * What BuzzFlow sends back. Loosely typed — the vendor publishes no schema, so
 * these fields are what has actually been observed coming back.
 *
 * It proxies Meta's Graph API, so a failure arrives as an HTTP 200 carrying a
 * Graph error: `{"status":"400","statusText":"failed","detail":{...},...}`.
 */
interface BuzzflowResponse {
  /** Either a boolean or an HTTP-style code as a string, e.g. `"400"`. */
  status?: boolean | string | number;
  /** The vendor's own word for the outcome: `"failed"`, `"success"`. */
  statusText?: string;
  success?: boolean;
  message?: string;
  message_id?: string;
  error?: unknown;
  /** Meta's error object, present only on failure. */
  detail?: { message?: string; code?: number; type?: string };
  data?: { id?: string; message_id?: string };
}

/**
 * BuzzFlow's reseller panel.
 *
 * Two things about this transport are unusual and easy to get wrong:
 *
 * **The credential is in the URL.** The configured endpoint ends in the
 * account token, so the whole URL is a secret. It must never be logged, put in
 * an error message, or shipped to a client — hence {@link redact}, and hence
 * this living server-side only. A token in a path also lands in access logs,
 * proxy logs and `Referer` headers, so treat a leak as likely and rotate it.
 *
 * **`sender_phone` is the recipient.** The name reads backwards, but the body
 * carries exactly one phone field while the account sending the message is
 * already identified by the token in the URL — so this is who it goes *to*.
 * If a test message arrives at the wrong number, that assumption is where to
 * look first.
 */
@Injectable()
export class BuzzflowWhatsappProvider extends WhatsappProvider {
  private readonly logger = new Logger(BuzzflowWhatsappProvider.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async sendText(to: string, body: string): Promise<WhatsappSendResult> {
    if (!this.config.get<boolean>('whatsapp.enabled')) {
      this.logger.debug('WhatsApp disabled, skipping message');
      return { success: true, skipped: true };
    }

    const url = this.config.get<string>('whatsapp.buzzflowSendUrl', '');
    if (!url) {
      this.logger.error(
        'BUZZFLOW_SEND_URL is not set — cannot send WhatsApp messages',
      );
      return { success: false };
    }

    // The vendor is a third party that can hang; a parent waiting on a login
    // code should not wait on someone else's outage.
    const timeoutMs = this.config.get<number>(
      'whatsapp.buzzflowTimeoutMs',
      10_000,
    );

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          message: body,
          sender_phone: toWhatsappNumber(to),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const text = await res.text();

      if (!res.ok) {
        this.logger.error(
          `BuzzFlow send failed (${res.status}) at ${this.redact(url)}: ${text}`,
        );
        return { success: false };
      }

      // A 200 does not mean it was accepted — panels routinely return 200 with
      // a failure in the body, so the body decides.
      const parsed = this.parse(text);

      // The vendor documents no response schema, so record what it actually
      // says. Digit runs are masked because the body may echo the message
      // back, and that message can be a login code.
      this.logger.debug(`BuzzFlow replied: ${this.maskDigits(text)}`);

      if (!this.accepted(parsed)) {
        this.logger.error(
          `BuzzFlow rejected the message: ${this.maskDigits(text)}`,
        );
        return { success: false };
      }

      return {
        success: true,
        messageId:
          parsed?.message_id ?? parsed?.data?.message_id ?? parsed?.data?.id,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      // `reason` can carry the request URL on some failures, so redact it too.
      this.logger.error(`BuzzFlow send errored: ${this.redact(reason)}`);
      return { success: false };
    }
  }

  private parse(text: string): BuzzflowResponse | null {
    try {
      return JSON.parse(text) as BuzzflowResponse;
    } catch {
      return null;
    }
  }

  /**
   * Whether the vendor accepted the message.
   *
   * BuzzFlow answers HTTP 200 even when the send failed, putting the real
   * outcome in the body — so this has to read the body carefully. It is
   * checked from most explicit signal to least, and only a body with no
   * recognisable outcome at all is given the benefit of the doubt: failing a
   * parent's login over an unknown response format is worse than trusting a
   * success the vendor stated.
   *
   * Was previously too lenient and read `status: "400"` as success, which
   * reported a failed send as delivered. A parent then waited for a message
   * that was never sent — the exact failure the 503 path exists to prevent.
   */
  private accepted(res: BuzzflowResponse | null): boolean {
    if (!res) return true;

    if (res.success === false) return false;
    if (typeof res.status === 'boolean') return res.status;

    // A Graph error object means Meta refused it, whatever else the body says.
    if (res.detail?.code !== undefined || res.error) return false;

    // The vendor's own verdict, when it gives one.
    if (typeof res.statusText === 'string') {
      return ['success', 'ok', 'sent', 'queued', 'true'].includes(
        res.statusText.toLowerCase(),
      );
    }

    if (res.status !== undefined) {
      // `status` doubles as an HTTP-style code ("400") and as a word.
      const code = Number(res.status);
      if (Number.isFinite(code)) return code >= 200 && code < 300;
      return !['false', 'error', 'failed'].includes(
        String(res.status).toLowerCase(),
      );
    }

    return true;
  }

  /**
   * Masks digit runs that could be a login code, so an echoed message never
   * leaves the secret in a log.
   *
   * Bounded to 4–8 digits on purpose: that is the range `OTP_LENGTH` can
   * sensibly take, while the identifiers worth keeping — Meta's 15–16 digit
   * phone-number and account ids — are longer and survive. Masking those too
   * would strip the one detail that makes a vendor failure diagnosable.
   */
  private maskDigits(text: string): string {
    return text
      .slice(0, 800)
      .replace(/(?<!\d)\d{4,8}(?!\d)/g, (d) => '#'.repeat(d.length));
  }

  /** Strips the token from a BuzzFlow URL so it is safe to log. */
  private redact(text: string): string {
    return text.replace(
      /(send_session|send_template|send_media)\/[^/\s"']+/gi,
      '$1/<token>',
    );
  }
}
