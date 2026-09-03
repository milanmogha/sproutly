import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';

import '../theme/app_theme.dart';
import 'neu.dart';

/// Are-you-sure, for actions a tap cannot undo.
///
/// Resolves `true` only on an explicit confirm — a dismissed barrier, a back
/// gesture, and Cancel all resolve `false`, so a stray tap can never delete
/// anything. Styled to match [confirmLogout], which is the same question in a
/// different costume.
Future<bool> confirmDestructive(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Delete',
  String cancelLabel = 'Cancel',
  IconData icon = Iconsax.trash,
}) async {
  final ok = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: title,
    barrierColor: const Color(0x59223A32),
    transitionDuration: const Duration(milliseconds: 240),
    pageBuilder: (_, _, _) => _ConfirmDialog(
      title: title,
      message: message,
      confirmLabel: confirmLabel,
      cancelLabel: cancelLabel,
      icon: icon,
    ),
    transitionBuilder: (_, animation, _, child) {
      final t = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutBack,
        reverseCurve: Curves.easeInCubic,
      );
      return FadeTransition(
        opacity: animation,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.88, end: 1).animate(t),
          child: child,
        ),
      );
    },
  );
  return ok == true;
}

class _ConfirmDialog extends StatelessWidget {
  const _ConfirmDialog({
    required this.title,
    required this.message,
    required this.confirmLabel,
    required this.cancelLabel,
    required this.icon,
  });

  final String title;
  final String message;
  final String confirmLabel;
  final String cancelLabel;
  final IconData icon;

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
                NeuBox(
                  inset: true,
                  shape: BoxShape.circle,
                  child: SizedBox(
                    width: 72,
                    height: 72,
                    child: Icon(icon, color: AppColors.danger, size: 28),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textMuted,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    // Cancel sits first, so the thumb's resting position is
                    // the harmless one.
                    Expanded(
                      child: NeuGhostButton(
                        label: cancelLabel,
                        color: AppColors.textDark,
                        onPressed: () => Navigator.pop(context, false),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: NeuButton(
                        label: confirmLabel,
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
