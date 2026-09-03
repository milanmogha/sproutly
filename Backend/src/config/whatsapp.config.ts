import { registerAs } from '@nestjs/config';

/**
 * Outbound WhatsApp.
 *
 * Two transports, picked by `WHATSAPP_PROVIDER`:
 *
 *  - `meta`     — WhatsApp Cloud API direct. Free-form text only reaches a
 *                 parent inside the 24-hour service window; anything else has
 *                 to be a pre-approved template.
 *  - `buzzflow` — a reseller panel. Its send URL carries the account token as
 *                 the last path segment, so the token *is* the credential and
 *                 must be treated like a password (see `buzzflowSendUrl`).
 */
export default registerAs('whatsapp', () => ({
  enabled: process.env.WHATSAPP_ENABLED === 'true',
  provider: process.env.WHATSAPP_PROVIDER || 'meta',

  // ── Meta Cloud API ──────────────────────────────────────
  apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',

  // ── BuzzFlow ────────────────────────────────────────────
  //
  // The full endpoint including the token, e.g.
  //   https://api.buzzflow.co.in/API_V2/Whatsapp/send_session/<token>
  //
  // Kept whole rather than assembled from parts because the vendor gives it
  // out that way, and splitting it invites someone to log the "base URL"
  // without realising the secret is in the path.
  buzzflowSendUrl: process.env.BUZZFLOW_SEND_URL || '',

  // Milliseconds to wait on the vendor before giving up. A parent staring at
  // a login screen should not wait on someone else's outage.
  buzzflowTimeoutMs: parseInt(process.env.BUZZFLOW_TIMEOUT_MS || '10000', 10),
}));
