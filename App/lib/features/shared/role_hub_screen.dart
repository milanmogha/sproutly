import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:iconsax/iconsax.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/motion.dart';
import '../../core/widgets/neu.dart';
import '../../routing/home_shell.dart';
import '../parent/screens/parent_login_screen.dart';
import 'credential_login_screen.dart';

/// Landing screen. Tap a role card to open its real login flow, then the role
/// shell. Parents sign in with phone + OTP; Teacher/Admin/Super Admin sign in
/// with email + password. All four authenticate against the backend.
///
/// A user whose session was restored at startup ([resumedRole]) never sees this
/// screen: their portal opens over it on the first frame. It stays underneath
/// so that logging out — which pops back to the first route — lands here.
class RoleHubScreen extends StatefulWidget {
  const RoleHubScreen({super.key, this.resumedRole});

  final UserRole? resumedRole;

  @override
  State<RoleHubScreen> createState() => _RoleHubScreenState();
}

class _RoleHubScreenState extends State<RoleHubScreen> {
  @override
  void initState() {
    super.initState();
    final role = widget.resumedRole;
    if (role != null) {
      // No transition: the portal should look like where the app started.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _enterShell(context, role, animate: false);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final roles = <_RoleTile>[
      _RoleTile(
        role: UserRole.parent,
        icon: Iconsax.people,
        tagline: "View your child's day",
      ),
      _RoleTile(
        role: UserRole.teacher,
        icon: Iconsax.teacher,
        tagline: 'Mark attendance, plan lessons',
      ),
      _RoleTile(
        role: UserRole.admin,
        icon: Iconsax.building,
        tagline: 'Manage school operations',
      ),
      _RoleTile(
        role: UserRole.superAdmin,
        icon: Iconsax.crown,
        tagline: 'Oversee all schools & users',
      ),
    ];

    return Scaffold(
      backgroundColor: AppColors.softWhite,
      body: Stack(
        children: [
          const Positioned.fill(child: _HubBackdrop()),
          SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final twoColumn = constraints.maxWidth >= 600;
            return CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.xl,
                    AppSpacing.xxl,
                    AppSpacing.xl,
                    AppSpacing.xl,
                  ),
                  sliver: SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const _HubHeader()
                            .animate()
                            .fadeIn(duration: 450.ms, curve: Curves.easeOut)
                            .slideY(begin: 0.06, curve: Curves.easeOutCubic),
                        const SizedBox(height: AppSpacing.xxl),
                      ],
                    ),
                  ),
                ),
                if (twoColumn)
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.xl,
                      0,
                      AppSpacing.xl,
                      AppSpacing.xl,
                    ),
                    sliver: SliverGrid(
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: AppSpacing.xl,
                        crossAxisSpacing: AppSpacing.xl,
                        childAspectRatio: 2.7,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (context, i) => _RoleCard(
                          tile: roles[i],
                          onTap: () => _open(context, roles[i].role),
                        )
                            .animate(delay: (120 + 90 * i).ms)
                            .fadeIn(
                                duration: 420.ms, curve: Curves.easeOut)
                            .slideY(
                                begin: 0.12, curve: Curves.easeOutCubic),
                        childCount: roles.length,
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.xl,
                      0,
                      AppSpacing.xl,
                      AppSpacing.xl,
                    ),
                    sliver: SliverList.separated(
                      itemCount: roles.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(height: AppSpacing.xl),
                      itemBuilder: (context, i) => _RoleCard(
                        tile: roles[i],
                        onTap: () => _open(context, roles[i].role),
                      )
                          .animate(delay: (120 + 90 * i).ms)
                          .fadeIn(duration: 420.ms, curve: Curves.easeOut)
                          .slideY(begin: 0.12, curve: Curves.easeOutCubic),
                    ),
                  ),
              ],
            );
          },
            ),
          ),
        ],
      ),
    );
  }

  void _open(BuildContext context, UserRole role) {
    HapticFeedback.lightImpact();
    // Replace the login screen with the role shell on success, so logout
    // returns to the hub (not back to the login screen).
    void enterShell(_) => _enterShell(context, role, replace: true);

    // Parents authenticate by phone + OTP; every other role by email + password.
    final Widget login = role == UserRole.parent
        ? ParentLoginScreen(onAuthenticated: enterShell)
        : CredentialLoginScreen(role: role, onAuthenticated: enterShell);

    Navigator.of(context).push(neuRoute(login));
  }

  /// Opens a role's portal over the hub. The shell blocks the system back
  /// button — only Logout leaves it, popping back here.
  void _enterShell(
    BuildContext context,
    UserRole role, {
    bool replace = false,
    bool animate = true,
  }) {
    final navigator = Navigator.of(context);
    Widget shell(BuildContext _) =>
        HomeShell(role: role, onLogout: navigator.pop);

    final route = animate
        ? MaterialPageRoute<void>(builder: shell)
        : PageRouteBuilder<void>(
            pageBuilder: (context, _, _) => shell(context),
            transitionDuration: Duration.zero,
            reverseTransitionDuration: Duration.zero,
          );

    if (replace) {
      navigator.pushReplacement(route);
    } else {
      navigator.push(route);
    }
  }
}

class _HubHeader extends StatelessWidget {
  const _HubHeader();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            // The Sproutly rounded-square app-icon badge, floating on a
            // green pop-shadow.
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                boxShadow: AppShadows.pop(AppColors.brandGreen, strength: 0.42),
              ),
              clipBehavior: Clip.antiAlias,
              foregroundDecoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
              ),
              child: Image.asset('assets/icon/app_icon.png', fit: BoxFit.cover),
            ),
            const SizedBox(width: AppSpacing.lg),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Sproutly',
                    style: GoogleFonts.fredoka(
                      fontSize: 36,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textDark,
                      height: 1.0,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Nurturing little futures, together 🌱',
                    style: GoogleFonts.nunito(
                      fontSize: 13.5,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w600,
                      height: 1.25,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xl),
        // A loud little "chip" prompt.
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          decoration: BoxDecoration(
            gradient: AppColors.sunsetGradient,
            borderRadius: BorderRadius.circular(AppRadii.chip),
            boxShadow: AppShadows.pop(AppColors.coral, strength: 0.3),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Iconsax.magic_star, color: Colors.white, size: 16),
              const SizedBox(width: 7),
              Text(
                'Who are you signing in as?',
                style: GoogleFonts.fredoka(
                  fontSize: 13.5,
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Soft, colourful decorative field behind the hub — big blurred blobs in the
/// brand + accent colours, the signature of the joyful-maximalist look.
class _HubBackdrop extends StatelessWidget {
  const _HubBackdrop();

  @override
  Widget build(BuildContext context) {
    return const IgnorePointer(
      child: Stack(
        children: [
          Positioned(
            top: -90,
            right: -70,
            child: _Blob(color: AppColors.brandTeal, size: 300),
          ),
          Positioned(
            top: 180,
            left: -110,
            child: _Blob(color: AppColors.grape, size: 320),
          ),
          Positioned(
            bottom: -80,
            right: -60,
            child: _Blob(color: AppColors.coral, size: 300),
          ),
          Positioned(
            bottom: 120,
            left: -60,
            child: _Blob(color: AppColors.sunny, size: 220),
          ),
        ],
      ),
    );
  }
}

/// A soft radial colour glow (no blur filter — a radial gradient fading to
/// transparent, which is cheap and reads as a blurred blob).
class _Blob extends StatelessWidget {
  const _Blob({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [color.withValues(alpha: 0.30), color.withValues(alpha: 0.0)],
        ),
      ),
    );
  }
}

class _RoleTile {
  const _RoleTile({
    required this.role,
    required this.icon,
    required this.tagline,
  });
  final UserRole role;
  final IconData icon;
  final String tagline;
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({required this.tile, required this.onTap});
  final _RoleTile tile;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = AppColors.primaryForRole(tile.role);
    final gradient = AppColors.gradientForRole(tile.role);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: PressableScale(
        child: Container(
        padding: const EdgeInsets.all(AppSpacing.xl),
        decoration: BoxDecoration(
          gradient: gradient,
          borderRadius: BorderRadius.circular(AppRadii.card),
          boxShadow: AppShadows.pop(accent, strength: 0.42),
        ),
        child: Row(
          children: [
            // A soft white well holding the role icon.
            Container(
              width: 58,
              height: 58,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.22),
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.35),
                  width: 1.5,
                ),
              ),
              child: Icon(tile.icon, color: Colors.white, size: 27),
            ),
            const SizedBox(width: AppSpacing.lg),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    tile.role.label,
                    style: GoogleFonts.fredoka(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                      height: 1.05,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    tile.tagline,
                    style: GoogleFonts.nunito(
                      fontSize: 13,
                      color: Colors.white.withValues(alpha: 0.9),
                      fontWeight: FontWeight.w600,
                      height: 1.2,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.22),
                shape: BoxShape.circle,
              ),
              child: const Icon(Iconsax.arrow_right_3,
                  color: Colors.white, size: 20),
            ),
          ],
        ),
        ),
      ),
    );
  }
}
