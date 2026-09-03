import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:iconsax/iconsax.dart';
import '../../core/network/auth_api.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/cards.dart';

/// Real email + password login against the backend, used by the roles that
/// sign in with credentials: Admin, Teacher, and Super Admin. Parents use the
/// phone + OTP flow instead ([ParentLoginScreen]).
///
/// The account's real role comes from the issued token; if it does not match
/// the [role] the user picked on the hub, the session is rejected.
class CredentialLoginScreen extends StatefulWidget {
  const CredentialLoginScreen({
    super.key,
    required this.role,
    required this.onAuthenticated,
  });

  final UserRole role;
  final void Function(AuthSession session) onAuthenticated;

  @override
  State<CredentialLoginScreen> createState() => _CredentialLoginScreenState();
}

class _CredentialLoginScreenState extends State<CredentialLoginScreen> {
  final _emailCtl = TextEditingController();
  final _passwordCtl = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _emailCtl.dispose();
    _passwordCtl.dispose();
    super.dispose();
  }

  /// Backend role string for the role picked on the hub.
  String get _expectedRole => switch (widget.role) {
        UserRole.superAdmin => 'super_admin',
        UserRole.admin => 'admin',
        UserRole.teacher => 'teacher',
        UserRole.parent => 'parent',
      };

  IconData get _icon => switch (widget.role) {
        UserRole.superAdmin => Iconsax.crown,
        UserRole.admin => Iconsax.building,
        UserRole.teacher => Iconsax.teacher,
        UserRole.parent => Iconsax.people,
      };

  Future<void> _login() async {
    final email = _emailCtl.text.trim();
    final password = _passwordCtl.text;
    if (email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Enter your email and password.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await AuthApi.instance.login(
        email: email,
        password: password,
      );
      if (!mounted) return;
      if (session.role != _expectedRole) {
        await AuthApi.instance.logout();
        setState(() {
          _loading = false;
          _error = 'This login is for ${widget.role.label} accounts only.';
        });
        return;
      }
      widget.onAuthenticated(session);
    } on DioException catch (e) {
      final message = switch (e.response?.statusCode) {
        401 => 'Invalid email or password.',
        null => 'Cannot reach the server. Check your connection.',
        _ => 'Login failed (${e.response?.statusCode}). Try again.',
      };
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Something went wrong. Try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = AppColors.primaryForRole(widget.role);
    final gradient = AppColors.gradientForRole(widget.role);

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
                // Back
                Align(
                  alignment: Alignment.centerLeft,
                  child: Material(
                    color: Colors.white,
                    shape: const CircleBorder(),
                    elevation: 0,
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () => Navigator.of(context).maybePop(),
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
                // Colourful hero banner.
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
                      Container(
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
                        child: Icon(_icon, color: Colors.white, size: 30),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        'Welcome back 👋',
                        style: GoogleFonts.fredoka(
                          fontSize: 28,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                          height: 1.05,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Sign in to your ${widget.role.label} account',
                        style: GoogleFonts.nunito(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.92),
                        ),
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(duration: 380.ms, curve: Curves.easeOut)
                    .slideY(begin: 0.08, curve: Curves.easeOutCubic),
                const SizedBox(height: AppSpacing.xl),
                // Form card.
                AppCard(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Column(
                    children: [
                      TextField(
                        controller: _emailCtl,
                        keyboardType: TextInputType.emailAddress,
                        autocorrect: false,
                        decoration: const InputDecoration(
                          hintText: 'Email',
                          prefixIcon: Icon(Iconsax.sms, size: 20),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextField(
                        controller: _passwordCtl,
                        obscureText: _obscure,
                        onSubmitted: (_) => _login(),
                        decoration: InputDecoration(
                          hintText: 'Password',
                          prefixIcon: const Icon(Iconsax.lock, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(
                                _obscure ? Iconsax.eye_slash : Iconsax.eye,
                                size: 20,
                                color: AppColors.textMuted),
                            onPressed: () =>
                                setState(() => _obscure = !_obscure),
                          ),
                        ),
                      ),
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
                        label: _loading ? 'Signing in…' : 'Sign in',
                        color: accent,
                        isLoading: _loading,
                        onPressed: _loading ? null : _login,
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
