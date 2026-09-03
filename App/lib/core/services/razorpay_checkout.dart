import 'dart:async';

import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../network/auth_api.dart';
import '../network/parent_api.dart' show CheckoutOrder;

/// Outcome of a checkout attempt, so callers can refresh (or not) accordingly.
enum PaymentOutcome { paid, cancelled, failed }

/// Drives one Razorpay order through the native checkout sheet.
///
/// Shared by both directions of money in this app, because the mechanics are
/// identical and the fiddly parts — one completer per attempt, a dismissed
/// sheet arriving as an "error", always disposing the plugin — are worth
/// having exactly once:
///
///  * **Fees**: parent → school, into the *school's* Razorpay account.
///  * **Subscription**: school → Sproutly, into the *platform's* account.
///
/// What differs is only the key id (it arrives with the order) and which
/// endpoint verifies the signature, so both are parameters.
class RazorpayCheckout {
  RazorpayCheckout._(this._razorpay);

  final Razorpay _razorpay;

  /// Opens checkout for [order] and completes when the sheet closes.
  ///
  /// [verify] posts the success signature to the right endpoint. It is a
  /// courtesy, not the settlement: the backend's webhook is what really marks
  /// the invoice paid, so a failure here is deliberately not surfaced as a
  /// failed payment — the money has already left the payer's account.
  ///
  /// Always `clear()`s the plugin — leaking it keeps native listeners alive
  /// and later payments fire callbacks into a dead widget.
  static Future<PaymentOutcome> open({
    required CheckoutOrder order,
    required String name,
    required String description,
    required Future<void> Function({
      required String orderId,
      required String paymentId,
      required String signature,
    }) verify,
    ScaffoldMessengerState? messenger,
  }) async {
    final checkout = RazorpayCheckout._(Razorpay());
    try {
      return await checkout._open(
        order: order,
        name: name,
        description: description,
        verify: verify,
        messenger: messenger,
      );
    } finally {
      checkout._razorpay.clear();
    }
  }

  Future<PaymentOutcome> _open({
    required CheckoutOrder order,
    required String name,
    required String description,
    required Future<void> Function({
      required String orderId,
      required String paymentId,
      required String signature,
    }) verify,
    required ScaffoldMessengerState? messenger,
  }) {
    // One completer per attempt; whichever native callback fires resolves it.
    final done = Completer<PaymentOutcome>();

    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS,
        (PaymentSuccessResponse r) async {
      try {
        await verify(
          orderId: r.orderId ?? order.orderId,
          paymentId: r.paymentId ?? '',
          signature: r.signature ?? '',
        );
      } catch (_) {
        // The money left their account — the webhook will still settle it
        // server-side, so don't tell them it failed.
      }
      if (!done.isCompleted) done.complete(PaymentOutcome.paid);
    });

    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse r) {
      // Razorpay reports a user-dismissed sheet as an error too.
      final cancelled = r.code == Razorpay.PAYMENT_CANCELLED;
      if (!cancelled) {
        messenger?.showSnackBar(
          SnackBar(content: Text(r.message ?? 'Payment failed')),
        );
      }
      if (!done.isCompleted) {
        done.complete(
            cancelled ? PaymentOutcome.cancelled : PaymentOutcome.failed);
      }
    });

    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (ExternalWalletResponse _) {
      // Handed off to a wallet app; the webhook decides the outcome.
      if (!done.isCompleted) done.complete(PaymentOutcome.cancelled);
    });

    // Parents sign in by phone OTP, so their email claim is often empty.
    final email = AuthApi.instance.currentSession?.email ?? '';
    _razorpay.open({
      'key': order.keyId,
      'order_id': order.orderId,
      'amount': order.amountPaise,
      'currency': order.currency,
      'name': name,
      'description': description,
      if (email.isNotEmpty) 'prefill': {'email': email},
      'theme': {'color': '#1D4DD5'},
    });

    return done.future;
  }
}
