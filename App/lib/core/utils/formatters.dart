import 'package:intl/intl.dart';

/// Centralized formatters for dates, currency, time, and percentages.
class Formatters {
  Formatters._();

  static String formatDate(DateTime date) {
    return DateFormat('EEE, dd MMM yyyy').format(date);
  }

  static String formatShortDate(DateTime date) {
    return DateFormat('dd MMM').format(date);
  }

  static String formatTime(DateTime time) {
    return DateFormat('h:mm a').format(time);
  }

  static String formatRupees(num amount) {
    final f = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 2,
    );
    return f.format(amount);
  }

  static String formatPercent(num value) {
    return '${value.toStringAsFixed(1)}%';
  }

  static String greetingForHour(int hour) {
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
}
