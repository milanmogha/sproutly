import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/network/auth_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/cards.dart';

/// Parent sign-in: enter email → receive a one-time code by email → verify.
///
/// TEMPORARY: the code is delivered by email while the WhatsApp OTP provider is
/// down. The account is provisioned by the school when a child's record is
/// added with this email.
class ParentLoginScreen extends StatefulWidget {
  const ParentLoginScreen({super.key, required this.onAuthenticated});

  final void Function(AuthSession session) onAuthenticated;

  @override
  State<ParentLoginScreen> createState() => _ParentLoginScreenState();
}

enum _Step { email, code }

/// Drives the OTP cell animations: shake+red on a bad code, green wave on
/// success.
enum OtpState { idle, error, success }

class _ParentLoginScreenState extends State<ParentLoginScreen> {
  static const _otpLength = 6;

  final _emailCtl = TextEditingController();
  final _codeCtl = TextEditingController();
  _Step _step = _Step.email;
  OtpState _otpState = OtpState.idle;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _emailCtl.dispose();
    _codeCtl.dispose();
    super.dispose();
  }

  /// Normalised email sent to the backend.
  String get _email => _emailCtl.text.trim();

  bool get _emailValid =>
      RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(_email);

  Future<void> _requestCode() async {
    if (!_emailValid) {
      setState(() => _error =
          'Enter the email address registered with your school.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await AuthApi.instance.requestOtp(email: _email);
      if (!mounted) return;
      setState(() {
        _loading = false;
        _step = _Step.code;
      });
    } on DioException catch (e) {
      _showError(e);
    } catch (_) {
      _showFallbackError();
    }
  }

  Future<void> _verify() async {
    final code = _codeCtl.text.trim();
    if (code.length < _otpLength) {
      setState(() => _error = 'Enter the $_otpLength-digit code we sent you.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await AuthApi.instance.verifyOtp(
        email: _email,
        code: code,
      );
      if (!mounted) return;
      // Success: play the green wave + check, then enter the portal.
      setState(() => _otpState = OtpState.success);
      await Future.delayed(const Duration(milliseconds: 1050));
      if (!mounted) return;
      widget.onAuthenticated(session);
    } on DioException catch (e) {
      final message = switch (e.response?.statusCode) {
        401 => 'That code is invalid or expired. Request a new one.',
        null => 'Cannot reach the server. Check your connection.',
        _ => 'Verification failed (${e.response?.statusCode}). Try again.',
      };
      if (!mounted) return;
      // Wrong code: shake the cells, then clear them for a retry.
      setState(() {
        _loading = false;
        _error = message;
        _otpState = OtpState.error;
      });
      await Future.delayed(const Duration(milliseconds: 500));
      if (mounted && _otpState == OtpState.error) {
        _codeCtl.clear();
        setState(() => _otpState = OtpState.idle);
      }
    } catch (_) {
      _showFallbackError();
    }
  }

  void _showError(DioException e) {
    final message = switch (e.response?.statusCode) {
      null => 'Cannot reach the server. Check your connection.',
      // The code genuinely wasn't sent — worth saying so, because "try again"
      // is the right move here and staring at an empty inbox is not.
      503 => 'We couldn’t send your code just now. Please try again.',
      429 => 'Too many attempts. Wait a minute and try again.',
      _ => 'Something went wrong (${e.response?.statusCode}). Try again.',
    };
    if (!mounted) return;
    setState(() {
      _loading = false;
      _error = message;
    });
  }

  void _showFallbackError() {
    if (!mounted) return;
    setState(() {
      _loading = false;
      _error = 'Something went wrong. Try again.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final accent = AppColors.primaryForRole(UserRole.parent);
    final gradient = AppColors.gradientForRole(UserRole.parent);
    final success = _otpState == OtpState.success;

    return Scaffold(
      backgroundColor: AppColors.softWhite,
      body: Stack(
        children: [
          Positioned(
            top: -70,
            right: -70,
            child: _GlowBlob(color: accent, size: 280),
          ),
          SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.xl),
              children: [
                // Back — to the email step from the code step, else pop the route.
                Align(
                  alignment: Alignment.centerLeft,
                  child: Material(
                    color: Colors.white,
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: _loading
                          ? null
                          : () {
                              if (_step == _Step.code) {
                                setState(() {
                                  _step = _Step.email;
                                  _error = null;
                                });
                              } else {
                                Navigator.of(context).maybePop();
                              }
                            },
                      child: const SizedBox(
                        width: 44,
                        height: 44,
                        child: Icon(Iconsax.arrow_left_2,
                            color: AppColors.textDark, size: 22),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                // Grape hero banner.
                Container(
                  padding: const EdgeInsets.all(AppSpacing.xxl),
                  decoration: BoxDecoration(
                    gradient: gradient,
                    borderRadius: BorderRadius.circular(AppRadii.card),
                    boxShadow: AppShadows.pop(accent, strength: 0.4),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 350),
                        curve: Curves.easeOutCubic,
                        width: 62,
                        height: 62,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.22),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.35),
                            width: 1.5,
                          ),
                        ),
                        child: success
                            ? TweenAnimationBuilder<double>(
                                tween: Tween(begin: 0, end: 1),
                                duration: const Duration(milliseconds: 600),
                                curve: Curves.elasticOut,
                                builder: (_, v, child) =>
                                    Transform.scale(scale: v, child: child),
                                child: const Icon(Icons.check_rounded,
                                    color: Colors.white, size: 34),
                              )
                            : Icon(
                                _step == _Step.email
                                    ? Iconsax.sms
                                    : Iconsax.security_user,
                                color: Colors.white,
                                size: 30,
                              ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        _step == _Step.email
                            ? 'Hello, parent 👋'
                            : 'Enter your code',
                        style: GoogleFonts.fredoka(
                          fontSize: 28,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                          height: 1.05,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _step == _Step.email
                            ? 'We’ll email a one-time code to your registered email.'
                            : 'We sent a code to $_email.',
                        style: GoogleFonts.nunito(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.92),
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(duration: 380.ms, curve: Curves.easeOut)
                    .slideY(begin: 0.08, curve: Curves.easeOutCubic),
                const SizedBox(height: AppSpacing.xl),
                AppCard(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Column(
                    children: [
                      if (_step == _Step.email) ...[
                        TextField(
                          controller: _emailCtl,
                          keyboardType: TextInputType.emailAddress,
                          autocorrect: false,
                          textCapitalization: TextCapitalization.none,
                          onSubmitted: (_) => _requestCode(),
                          decoration: const InputDecoration(
                            hintText: 'parent@example.com',
                            prefixIcon: Icon(Iconsax.sms, size: 20),
                            counterText: '',
                          ),
                        ),
                      ] else ...[
                        _OtpCells(
                          controller: _codeCtl,
                          length: _otpLength,
                          accent: accent,
                          state: _otpState,
                          enabled: !_loading && !success,
                          onCompleted: _verify,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        TextButton(
                          onPressed: _loading ? null : _requestCode,
                          child: const Text('Resend code'),
                        ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          children: [
                            const Icon(Iconsax.warning_2,
                                color: AppColors.danger, size: 16),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                _error!,
                                style: GoogleFonts.nunito(
                                  color: AppColors.danger,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: AppSpacing.xl),
                      PrimaryButton(
                        label: _loading
                            ? 'Please wait…'
                            : (_step == _Step.email
                                ? 'Send code'
                                : 'Verify & sign in'),
                        color: accent,
                        isLoading: _loading,
                        onPressed: _loading
                            ? null
                            : (_step == _Step.email ? _requestCode : _verify),
                      ),
                    ],
                  ),
                )
                    .animate(delay: 120.ms)
                    .fadeIn(duration: 380.ms)
                    .slideY(begin: 0.1, curve: Curves.easeOutCubic),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A soft radial colour glow used as a decorative backdrop element.
class _GlowBlob extends StatelessWidget {
  const _GlowBlob({required this.color, required this.size});
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color.withValues(alpha: 0.28),
              color.withValues(alpha: 0.0),
            ],
          ),
        ),
      ),
    );
  }
}

/// Animated OTP entry: one cell per digit, driven by a hidden text field.
/// Digits pop in as they're typed, the active cell pulses, a wrong code
/// shakes the row red, and a correct one sweeps the cells green.
class _OtpCells extends StatefulWidget {
  const _OtpCells({
    required this.controller,
    required this.length,
    required this.accent,
    required this.state,
    required this.enabled,
    required this.onCompleted,
  });

  final TextEditingController controller;
  final int length;
  final Color accent;
  final OtpState state;
  final bool enabled;
  final VoidCallback onCompleted;

  @override
  State<_OtpCells> createState() => _OtpCellsState();
}

class _OtpCellsState extends State<_OtpCells> with TickerProviderStateMixin {
  final _focus = FocusNode();
  late int _prevLen = widget.controller.text.length;

  late final _shake = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 450));
  late final _wave = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 750));
  late final _pulse = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 1200))
    ..repeat(reverse: true);

  @override
  void didUpdateWidget(covariant _OtpCells old) {
    super.didUpdateWidget(old);
    if (old.state == widget.state) return;
    if (widget.state == OtpState.error) {
      HapticFeedback.heavyImpact();
      _shake.forward(from: 0);
    } else if (widget.state == OtpState.success) {
      HapticFeedback.mediumImpact();
      _wave.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _focus.dispose();
    _shake.dispose();
    _wave.dispose();
    _pulse.dispose();
    super.dispose();
  }

  void _onChanged(String text) {
    HapticFeedback.selectionClick();
    // Auto-verify only on the final keystroke (not on programmatic prefill).
    if (text.length == widget.length && _prevLen == widget.length - 1) {
      widget.onCompleted();
    }
    _prevLen = text.length;
  }

  /// Per-cell success-wave progress, staggered left to right.
  double _waveAt(int i) {
    const span = 0.55;
    final start = i * (1 - span) / (widget.length - 1);
    return Curves.easeOut.transform(
        ((_wave.value - start) / span).clamp(0.0, 1.0));
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.enabled ? _focus.requestFocus : null,
      child: Stack(
        children: [
          // Hidden field that actually holds the code (keeps paste support).
          Opacity(
            opacity: 0,
            child: SizedBox(
              height: 1,
              child: TextField(
                controller: widget.controller,
                focusNode: _focus,
                autofocus: true,
                enabled: widget.enabled,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(widget.length),
                ],
                onChanged: _onChanged,
                onSubmitted: (_) => widget.onCompleted(),
              ),
            ),
          ),
          AnimatedBuilder(
            animation: Listenable.merge(
                [widget.controller, _shake, _wave, _pulse, _focus]),
            builder: (_, _) {
              final text = widget.controller.text;
              final dx =
                  math.sin(_shake.value * math.pi * 4) * 9 * (1 - _shake.value);
              return Transform.translate(
                offset: Offset(dx, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: List.generate(widget.length, (i) {
                    final digit = i < text.length ? text[i] : '';
                    final active = widget.enabled &&
                        _focus.hasFocus &&
                        i == text.length &&
                        widget.state == OtpState.idle;
                    final w =
                        widget.state == OtpState.success ? _waveAt(i) : 0.0;

                    final border = switch (widget.state) {
                      OtpState.error => AppColors.danger,
                      OtpState.success => widget.accent,
                      _ when active => widget.accent.withValues(
                          alpha: 0.45 + 0.55 * _pulse.value),
                      _ when digit.isNotEmpty =>
                        widget.accent.withValues(alpha: 0.35),
                      _ => AppColors.mutedGray,
                    };

                    return Transform.scale(
                      scale: 1 + 0.08 * math.sin(math.pi * w),
                      child: Container(
                        width: 48,
                        height: 58,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          // Clean wells that flood accent on success.
                          color: w > 0
                              ? Color.lerp(
                                  const Color(0xFFEDE7DA), widget.accent, w)
                              : const Color(0xFFF7F3EC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: border, width: 1.6),
                          boxShadow: w > 0.5
                              ? [
                                  BoxShadow(
                                      offset: const Offset(0, 4),
                                      blurRadius: 10,
                                      color: widget.accent
                                          .withValues(alpha: 0.35)),
                                ]
                              : null,
                        ),
                        child: digit.isEmpty
                            ? null
                            : TweenAnimationBuilder<double>(
                                key: ValueKey('$i-$digit'),
                                tween: Tween(begin: 0.4, end: 1),
                                duration: const Duration(milliseconds: 240),
                                curve: Curves.easeOutBack,
                                builder: (_, v, child) =>
                                    Transform.scale(scale: v, child: child),
                                child: Text(
                                  digit,
                                  style: TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w700,
                                    color: w > 0.5
                                        ? Colors.white
                                        : AppColors.textDark,
                                  ),
                                ),
                              ),
                      ),
                    );
                  }),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
