import type { CheckoutOrder } from '@/lib/api/types';

/** Outcome of a checkout attempt, so callers can refresh (or not) accordingly. */
export type PaymentOutcome = 'paid' | 'cancelled' | 'failed';

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: RazorpayFailure) => void) => void;
}

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error?: { description?: string; reason?: string };
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptPromise: Promise<void> | null = null;

/** Loads Razorpay's checkout script once, and reuses it for later payments. */
function loadRazorpay(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      scriptPromise = null; // Allow a retry on the next attempt.
      reject(new Error('Could not load the payment gateway.'));
    });
    if (!existing) document.body.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Drives one Razorpay order through the checkout modal.
 *
 * Shared by both directions of money in this app, because the mechanics are
 * identical:
 *
 *  * **Fees**: parent → school, into the *school's* Razorpay account.
 *  * **Subscription**: school → Sproutly, into the *platform's* account.
 *
 * What differs is only the key id (it arrives with the order) and which
 * endpoint verifies the signature, so both are parameters.
 *
 * `verify` is a courtesy, not the settlement: the backend's webhook is what
 * really marks the invoice paid, so a failure there is deliberately not
 * surfaced as a failed payment — the money has already left the payer's
 * account.
 */
export async function openCheckout({
  order,
  name,
  description,
  prefillEmail,
  verify,
}: {
  order: CheckoutOrder;
  name: string;
  description: string;
  prefillEmail?: string;
  verify: (payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => Promise<unknown>;
}): Promise<PaymentOutcome> {
  await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Could not load the payment gateway.');

  return new Promise<PaymentOutcome>((resolve) => {
    // Whichever callback fires first settles the attempt; the rest are no-ops.
    let settled = false;
    const finish = (outcome: PaymentOutcome) => {
      if (!settled) {
        settled = true;
        resolve(outcome);
      }
    };

    const checkout = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: order.currency || 'INR',
      name,
      description,
      // Parents sign in by one-time code, so their email claim is often empty.
      ...(prefillEmail ? { prefill: { email: prefillEmail } } : {}),
      theme: { color: '#2e7d32' },
      handler: async (response: RazorpaySuccess) => {
        try {
          await verify({
            razorpayOrderId: response.razorpay_order_id || order.orderId,
            razorpayPaymentId: response.razorpay_payment_id ?? '',
            razorpaySignature: response.razorpay_signature ?? '',
          });
        } catch {
          // The money left their account — the webhook will still settle it
          // server-side, so don't tell them it failed.
        }
        finish('paid');
      },
      modal: {
        // Dismissing the sheet is a cancellation, not a failure.
        ondismiss: () => finish('cancelled'),
      },
    });

    checkout.on('payment.failed', () => finish('failed'));
    checkout.open();
  });
}
