// Basic smoke test for Sproutly.
import 'package:flutter_test/flutter_test.dart';

import 'package:sproutly/main.dart';

void main() {
  testWidgets('App boots into splash', (WidgetTester tester) async {
    await tester.pumpWidget(const SproutlyApp());
    // First frame.
    expect(find.text('Sproutly'), findsWidgets);
    // Pump the splash animation through to its end + login render.
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 2200));
    await tester.pump(const Duration(milliseconds: 300));
  });
}
