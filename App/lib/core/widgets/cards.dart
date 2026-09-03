import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import 'motion.dart';
import 'neu.dart';

/// Soft white card with 20dp radius and gentle shadow. In the soft-UI portals
/// ([AppNeu.on]) it becomes a raised neumorphic surface instead, so the shared
/// cards match the hand-built Neu widgets around them.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.onTap,
    this.background,
    this.borderLeftColor,
    this.borderLeftWidth = 4,
  });

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  final Color? background;
  final Color? borderLeftColor;
  final double borderLeftWidth;

  @override
  Widget build(BuildContext context) {
    // A caller-supplied background wins — it usually carries meaning (a status
    // tint), so it stays flat rather than being swallowed by the neu gradient.
    final neu = AppNeu.on && background == null;
    final bg = background ?? AppColors.warmSurface;
    final radius = BorderRadius.circular(AppRadii.card);
    Widget content = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: neu ? null : bg,
        gradient: neu ? Neu.convex : null,
        borderRadius: radius,
        boxShadow: neu ? Neu.raisedShadow : AppShadows.card,
        border: borderLeftColor != null
            ? Border(
                left: BorderSide(
                  color: borderLeftColor!,
                  width: borderLeftWidth,
                ),
              )
            : null,
      ),
      child: child,
    );

    if (onTap != null) {
      return PressableScale(
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: radius,
            onTap: onTap,
            child: content,
          ),
        ),
      );
    }
    return content;
  }
}

/// Tinted stat card with large numeric value, label, and accent icon.
class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: accent,
        borderRadius: BorderRadius.circular(AppRadii.card),
        boxShadow: AppShadows.pop(accent),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Dark circular icon well, like the reference's stat cards.
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppColors.ink,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(height: 14),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.fredoka(
              fontSize: 26,
              height: 1.0,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.nunito(
              fontSize: 11.5,
              height: 1.15,
              fontWeight: FontWeight.w700,
              color: Colors.white.withValues(alpha: 0.85),
            ),
          ),
        ],
      ),
    );
    if (onTap == null) return content;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: PressableScale(child: content),
    );
  }
}

/// Action card with chevron trailing.
class ActionCard extends StatelessWidget {
  const ActionCard({
    super.key,
    required this.title,
    this.subtitle,
    required this.icon,
    required this.accent,
    this.onTap,
  });

  final String title;
  final String? subtitle;
  final IconData icon;
  final Color accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: accent),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDark,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
        ],
      ),
    );
  }
}
