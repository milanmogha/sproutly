export interface WhatsappSendResult {
  success: boolean;
  messageId?: string;
  /** True when the transport is switched off — not a delivery failure. */
  skipped?: boolean;
}

/**
 * One way of putting a WhatsApp message on the wire.
 *
 * Kept abstract so the transport is a deployment decision: the Cloud API
 * direct from Meta, or a reseller panel. Callers only ever see `sendText`.
 */
export abstract class WhatsappProvider {
  abstract sendText(to: string, body: string): Promise<WhatsappSendResult>;
}

/**
 * Normalises a phone number to bare digits with a country code.
 *
 * Parent numbers reach us in every shape a human can type — `+91 97600 51792`,
 * `097600-51792`, `9760051792` — and every WhatsApp transport wants digits
 * only. A ten-digit number is assumed Indian, matching the rest of the app.
 */
export function toWhatsappNumber(phone: string, defaultCc = '91'): string {
  const digits = phone.replace(/\D/g, '');
  // A leading trunk zero is a domestic-dialling artefact, never part of the
  // international number.
  const trimmed = digits.replace(/^0+/, '');
  return trimmed.length === 10 ? `${defaultCc}${trimmed}` : trimmed;
}
