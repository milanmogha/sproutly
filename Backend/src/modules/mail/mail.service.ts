import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Outbound email over SMTP (nodemailer).
 *
 * Configured via SMTP_* env vars. When SMTP_ENABLED=false or SMTP_HOST is
 * empty, messages are logged instead of sent — safe for local development.
 * Email failures are logged, never thrown: an unreachable SMTP server must
 * not break user/school creation (the invite link is also returned in the
 * API response).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Builds the set-password URL an invited admin follows. */
  buildInviteUrl(token: string): string {
    const base = this.config.get<string>('app.webAppUrl');
    return `${base}/set-password?token=${token}`;
  }

  /** Builds the reset-password URL a forgot-password email points to. */
  buildResetUrl(token: string): string {
    const base = this.config.get<string>('app.webAppUrl');
    return `${base}/reset-password?token=${token}`;
  }

  /**
   * Sends a forgot-password reset link. Returns whether delivery succeeded (or
   * was logged in local dev) so the caller can drop a reset token it could
   * never deliver — a live token behind an email nobody got is only risk.
   */
  async sendPasswordReset(
    email: string,
    name: string,
    resetUrl: string,
    ttlMinutes: number,
  ): Promise<boolean> {
    return this.deliver({
      to: email,
      subject: 'Reset your Sproutly password',
      text:
        `Hi ${name},\n\n` +
        `We received a request to reset your Sproutly password. ` +
        `Choose a new one here:\n${resetUrl}\n\n` +
        `This link expires in ${ttlMinutes} minute${ttlMinutes === 1 ? '' : 's'}. ` +
        `If you did not request this, you can safely ignore this email — ` +
        `your password will stay the same.`,
    });
  }

  /**
   * Sends a parent their one-time login code by email.
   *
   * TEMPORARY: stands in for WhatsApp OTP while that provider is down. Returns
   * whether delivery succeeded (or was logged in local dev) so the caller can
   * drop a code it could never deliver. The code is never logged here.
   */
  async sendOtp(
    email: string,
    code: string,
    ttlMinutes: number,
  ): Promise<boolean> {
    return this.deliver({
      to: email,
      subject: 'Your Sproutly login code',
      text:
        `${code} is your Sproutly login code. It expires in ${ttlMinutes} ` +
        `minute${ttlMinutes === 1 ? '' : 's'}. Do not share it with anyone. ` +
        `If you did not request this, you can ignore this email.`,
    });
  }

  /**
   * Sends (or logs, when SMTP is disabled) the onboarding invite.
   *
   * Returns whether it went out, so the caller can tell the operator "emailed"
   * instead of guessing — and fall back to showing the link when it did not.
   */
  async sendAdminInvite(
    email: string,
    name: string,
    inviteUrl: string,
  ): Promise<boolean> {
    return this.deliver({
      to: email,
      subject: 'You have been invited to Sproutly',
      text:
        `Hi ${name},\n\n` +
        `An account has been created for you on Sproutly. ` +
        `Set your password to activate it:\n${inviteUrl}\n\n` +
        `This link expires soon. If you did not expect this, ignore this email.`,
    });
  }

  private get smtpEnabled(): boolean {
    return (
      (this.config.get<boolean>('mail.enabled') ?? false) &&
      Boolean(this.config.get<string>('mail.host'))
    );
  }

  private getTransporter(): Transporter {
    this.transporter ??= nodemailer.createTransport({
      host: this.config.get<string>('mail.host'),
      port: this.config.get<number>('mail.port'),
      secure: this.config.get<boolean>('mail.secure'),
      auth: {
        user: this.config.get<string>('mail.user'),
        pass: this.config.get<string>('mail.pass'),
      },
      // Without these nodemailer waits forever on a silent server, and because
      // the send is awaited inside the request, the whole HTTP call hangs with
      // it — creating a user could sit there for minutes. Bounded instead: a
      // dead SMTP costs one slow request and is then reported as a failure.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    this.warnIfFromUnaligned();
    return this.transporter;
  }

  /**
   * Warns when the From address cannot pass SPF/DKIM for the account sending it.
   *
   * A provider like Gmail authenticates the SMTP session, so it accepts almost
   * any From and answers 250 — the send looks perfectly healthy in our logs.
   * The recipient's server is the one that judges the From *domain*, and a
   * domain with no DNS (`@sproutly.local`) or one this account isn't
   * authorised for fails DMARC and lands in spam. That is invisible from here,
   * so it is called out once at first send rather than left to guesswork.
   */
  private warnIfFromUnaligned(): void {
    const user = this.config.get<string>('mail.user') ?? '';
    const fromHeader = this.config.get<string>('mail.from') ?? '';
    const domainOf = (value: string) =>
      (value.match(/<([^>]+)>/)?.[1] ?? value).split('@')[1]?.toLowerCase() ?? '';
    const fromDomain = domainOf(fromHeader);
    const userDomain = domainOf(user);
    if (!fromDomain || !userDomain || fromDomain === userDomain) {
      return;
    }
    this.logger.warn(
      `MAIL_FROM is "${fromHeader}" but SMTP authenticates as @${userDomain}. ` +
        `Recipients will fail SPF/DMARC on "${fromDomain}" and are likely to bin ` +
        `these as spam even though the server reports them sent. Set MAIL_FROM to ` +
        `an address at @${userDomain} (or a domain this account may send for).`,
    );
  }

  /** Returns true when the message was sent (or logged in local dev), false on
   *  an SMTP send failure. Never throws — callers that ignore the result keep
   *  their existing fire-and-forget behaviour. */
  async deliver(msg: {
    to: string;
    subject: string;
    text: string;
  }): Promise<boolean> {
    if (!this.smtpEnabled) {
      // Logged, not sent. The full body goes out at `log` (not `debug`) so the
      // OTP / invite link is actually visible in the default console output —
      // a code that only a debug build would print is a code nobody can read.
      this.logger.log(
        `[email — SMTP disabled] to=${msg.to} :: ${msg.subject}\n${msg.text}`,
      );
      return true;
    }
    try {
      await this.getTransporter().sendMail({
        from: this.config.get<string>('mail.from'),
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
      });
      this.logger.log(`Email sent to=${msg.to} :: ${msg.subject}`);
      return true;
    } catch (err) {
      this.logger.error(
        `Email delivery failed to=${msg.to}: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
