import '../models/subscription.dart';
import 'dio_client.dart';

/// The platform's own billing — what a school pays Sproutly.
///
/// Split in two by audience, exactly like the backend controller: the school's
/// admin sees and pays its own invoices, the super admin raises and settles
/// them for any school.
///
/// These endpoints stay writable even when a school is locked out for
/// non-payment, because paying is how the lock is lifted.
class SubscriptionApi {
  SubscriptionApi._();
  static final SubscriptionApi instance = SubscriptionApi._();

  // ── School side (admin) ───────────────────────────────────

  /// Where the signed-in admin's own school stands, plus what it owes.
  Future<SubscriptionState> mine() async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/subscriptions/mine');
    return SubscriptionState.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<List<SubscriptionInvoice>> myInvoices() async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/subscriptions/mine/invoices');
    final data = DioClient.unwrap<dynamic>(res) as List<dynamic>;
    return data
        .map((e) => SubscriptionInvoice.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Starts settling an invoice.
  ///
  /// Usually opens a Razorpay order against the **platform's** account — the
  /// returned `keyId` is Sproutly's, not the school's. A zero-amount invoice
  /// is a free period instead, and comes back already settled with no order;
  /// see [SubscriptionCheckout.settled].
  Future<SubscriptionCheckout> startCheckout(String invoiceId) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/subscriptions/mine/invoices/$invoiceId/checkout',
    );
    return SubscriptionCheckout.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Posts the checkout signature so the payer sees "Paid" without waiting for
  /// Razorpay's webhook. The webhook remains the authoritative settlement.
  Future<void> verifyPayment({
    required String orderId,
    required String paymentId,
    required String signature,
  }) async {
    await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/subscriptions/mine/payments/verify',
      data: {
        'razorpayOrderId': orderId,
        'razorpayPaymentId': paymentId,
        'razorpaySignature': signature,
      },
    );
  }

  // ── Platform side (super admin) ───────────────────────────

  /// Every school's billing position, including those never billed.
  Future<List<PlatformBillingRow>> overview() async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/subscriptions/overview');
    final data = DioClient.unwrap<dynamic>(res) as List<dynamic>;
    return data
        .map((e) => PlatformBillingRow.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<SubscriptionState> forSchool(String schoolId) async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/subscriptions/schools/$schoolId');
    return SubscriptionState.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<List<SubscriptionInvoice>> invoicesForSchool(String schoolId) async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/subscriptions/schools/$schoolId/invoices');
    final data = DioClient.unwrap<dynamic>(res) as List<dynamic>;
    return data
        .map((e) => SubscriptionInvoice.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Bills a school for an arbitrary stretch of days.
  ///
  /// There are no fixed plans on purpose: a 15-day trial and a two-year
  /// contract are the same shape here, just different numbers.
  Future<SubscriptionInvoice> createInvoice(
    String schoolId, {
    required double amount,
    required int durationDays,
    String? durationLabel,
    String? notes,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/subscriptions/schools/$schoolId/invoices',
      data: {
        'amount': amount,
        'durationDays': durationDays,
        if (durationLabel != null && durationLabel.isNotEmpty)
          'durationLabel': durationLabel,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      },
    );
    return SubscriptionInvoice.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Money taken at the SaaS owner's office. [paidAt] matters: the new period
  /// is measured from when the money actually arrived, not from now.
  Future<SubscriptionInvoice> recordPayment(
    String invoiceId, {
    String method = 'cash',
    String? reference,
    DateTime? paidAt,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/subscriptions/invoices/$invoiceId/record-payment',
      data: {
        'method': method,
        if (reference != null && reference.isNotEmpty) 'reference': reference,
        if (paidAt != null) 'paidAt': paidAt.toUtc().toIso8601String(),
      },
    );
    return SubscriptionInvoice.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Voids an unpaid invoice so a mistake can be re-raised correctly.
  Future<void> cancelInvoice(String invoiceId) async {
    await DioClient.instance.dio
        .delete<dynamic>('/subscriptions/invoices/$invoiceId');
  }
}
