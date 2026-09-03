import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lottie/lottie.dart';

/// A one-shot launch splash that plays *over* the running app.
///
/// It renders the Sproutly Lottie animation full-screen on top of [child],
/// so the first screen loads behind it and is ready the instant the splash
/// fades. Once the animation finishes it fades itself out and then stops
/// building entirely, so it never intercepts touches after launch and the
/// route stack underneath stays untouched.
///
/// Drop it in via [MaterialApp.builder] so a single instance covers every
/// route without becoming a route of its own.
class SplashOverlay extends StatefulWidget {
  const SplashOverlay({super.key, required this.child});

  /// The live app (the [MaterialApp]'s navigator) that renders beneath.
  final Widget child;

  @override
  State<SplashOverlay> createState() => _SplashOverlayState();
}

class _SplashOverlayState extends State<SplashOverlay>
    with TickerProviderStateMixin {
  /// Drives the Lottie animation; duration is taken from the composition.
  late final AnimationController _lottie = AnimationController(vsync: this);

  /// Drives the fade-out once the animation completes.
  late final AnimationController _fade = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 450),
    value: 1,
  );

  /// Once true the overlay is gone and only [child] builds.
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _lottie.addStatusListener((status) async {
      if (status == AnimationStatus.completed) {
        await _fade.reverse();
        if (mounted) setState(() => _done = true);
      }
    });
  }

  @override
  void dispose() {
    _lottie.dispose();
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_done) return widget.child;

    // Size the sprout off the *shorter* side and cap it, so it stays a sensible
    // badge on a wide desktop/web window instead of filling the viewport (and
    // overflowing the column) the way `width * fraction` would.
    final artSize =
        (MediaQuery.sizeOf(context).shortestSide * 0.5).clamp(120.0, 240.0);

    return Stack(
      children: [
        widget.child,
        Positioned.fill(
          child: FadeTransition(
            opacity: _fade,
            child: IgnorePointer(
              child: DecoratedBox(
                // Sproutly's brand-green radial backdrop so the sprout's
                // transparent edges blend into a seamless field.
                decoration: const BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment(0, -0.16),
                    radius: 1.2,
                    colors: [
                      Color(0xFF388E3C),
                      Color(0xFF2E7D32),
                      Color(0xFF1B5E20),
                    ],
                    stops: [0.0, 0.45, 1.0],
                  ),
                ),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: artSize,
                        height: artSize,
                        child: Lottie.asset(
                          'assets/lottie/sproutly_splash.json',
                          controller: _lottie,
                          fit: BoxFit.contain,
                          onLoaded: (composition) {
                            _lottie
                              ..duration = composition.duration
                              ..forward();
                          },
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Sproutly',
                        style: GoogleFonts.fredoka(
                          color: Colors.white,
                          fontSize: 36,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                          decoration: TextDecoration.none,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'PRESCHOOL MANAGEMENT',
                        style: GoogleFonts.nunito(
                          color: const Color(0xFFC8E6C9),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 2.5,
                          decoration: TextDecoration.none,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
