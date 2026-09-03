import 'package:flutter/material.dart';

import '../../../core/network/parent_api.dart';
import '../../../core/services/razorpay_checkout.dart';

/// Outcome of a checkout attempt, so callers can refresh (or not) accordingly.
typedef FeePaymentOutcome = PaymentOutcome;

/// Drives one **fee** invoice through Razorpay checkout — parent → school.
///
/// The school's own key id arrives with the order: every school collects into
/// its own account, so nothing about the gateway is baked into the app. This
/// is the opposite direction from a subscription payment, which collects into
/// the platform's account (see `admin_subscription.dart`).
///
/// The mechanics live in [RazorpayCheckout]; what belongs here is fetching the
/// order and knowing which endpoint verifies it.
class FeeCheckout {
  const FeeCheckout._();

  /// Opens checkout for [invoiceId] and completes when the sheet closes.
  static Future<FeePaymentOutcome> start({
    required BuildContext context,
    required String invoiceId,
    required String studentName,
    required String schoolName,
  }) async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final CheckoutOrder order;
    try {
      order = await ParentApi.instance.startCheckout(invoiceId);
    } catch (e) {
      messenger?.showSnackBar(SnackBar(content: Text(_readableError(e))));
      return FeePaymentOutcome.failed;
    }

    return RazorpayCheckout.open(
      order: order,
      name: schoolName,
      description: '${order.invoiceNumber} · $studentName',
      messenger: messenger,
      verify: ({
        required String orderId,
        required String paymentId,
        required String signature,
      }) =>
          ParentApi.instance.verifyPayment(
        orderId: orderId,
        paymentId: paymentId,
        signature: signature,
      ),
    );
  }

  static String _readableError(Object e) {
    final text = e.toString();
    if (text.contains('not set up for online payments')) {
      return 'This school hasn’t enabled online payments yet — please pay at the office.';
    }
    return 'Could not start the payment. Please try again or pay at the office.';
  }
}
