import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';
import '../../core/network/auth_api.dart';
import '../../core/network/parent_api.dart';
import '../../core/network/socket_service.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/neu.dart';

/// Confirm-then-logout used by every role's settings screen.
/// Soft-UI dialog that pops in with a gentle spring; pops back to the role
/// hub on confirm.
Future<void> confirmLogout(BuildContext context) async {
  final ok = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Log out?',
    barrierColor: const Color(0x59223A32),
    transitionDuration: const Duration(milliseconds: 280),
    pageBuilder: (_, _, _) => const _LogoutDialog(),
    transitionBuilder: (_, animation, _, child) {
      final t = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutBack,
          reverseCurve: Curves.easeInCubic);
      return FadeTransition(
        opacity: animation,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.88, end: 1).animate(t),
          child: child,
        ),
      );
    },
  );
  if (ok != true) return;
  // Disconnect Socket.IO before clearing auth tokens.
  SocketService.instance.disconnect();
  await AuthApi.instance.logout();
  // Drop per-account state held by the API singletons; the next login may be
  // a different account on the same device (no-op for non-parent roles).
  ParentApi.instance.reset();
  if (context.mounted) Navigator.of(context).popUntil((r) => r.isFirst);
}

class _LogoutDialog extends StatelessWidget {
  const _LogoutDialog();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 36),
        child: Material(
          color: Colors.transparent,
          child: Container(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
            decoration: BoxDecoration(
              color: Neu.bg,
              borderRadius: BorderRadius.circular(28),
              boxShadow: Neu.floatShadow,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Carved icon well, matching the home quick actions.
                const NeuBox(
                  inset: true,
                  shape: BoxShape.circle,
                  child: SizedBox(
                    width: 72,
                    height: 72,
                    child: Icon(Iconsax.logout,
                        color: AppColors.danger, size: 30),
                  ),
                ),
                const SizedBox(height: 18),
                const Text('Log out?',
                    style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textDark)),
                const SizedBox(height: 8),
                const Text(
                  "You'll need to sign in again to use this portal.",
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textMuted,
                      height: 1.4),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: NeuGhostButton(
                        label: 'Cancel',
                        color: AppColors.textDark,
                        onPressed: () => Navigator.pop(context, false),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: NeuButton(
                        label: 'Log out',
                        height: 48,
                        color: AppColors.danger,
                        onPressed: () => Navigator.pop(context, true),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
