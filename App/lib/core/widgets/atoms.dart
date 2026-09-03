import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import 'buttons.dart';
import 'motion.dart';

/// Pill-style status chip with colored tint + colored text.
class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    this.type = ChipType.neutral,
  });

  final String label;
  final ChipType type;

  Color get _color {
    switch (type) {
      case ChipType.success:
        return AppColors.success;
      case ChipType.warning:
        return AppColors.warning;
      case ChipType.danger:
        return AppColors.danger;
      case ChipType.info:
        return AppColors.info;
      case ChipType.neutral:
        return AppColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadii.chip),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: _color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

enum ChipType { success, warning, danger, info, neutral }

/// Outline / filled filter chip.
class FilterChipX extends StatelessWidget {
  const FilterChipX({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    required this.accent,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? accent.withValues(alpha: 0.18) : Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.chip),
        side: BorderSide(
          color: selected ? accent : AppColors.mutedGray,
          width: 1.2,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.chip),
        onTap: () {
          onTap();
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? accent : AppColors.textDark,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}

/// Drag-handled bottom sheet helper.
///
/// Keyboard handling is centralised here: the sheet is padded by the current
/// keyboard inset so its contents always sit *above* the on-screen keyboard,
/// and it is capped to (nearly) the screen height. Pass [scrollable] `true`
/// for form sheets so a tall body scrolls instead of overflowing once the
/// keyboard eats into the available height. Leave it `false` when the [child]
/// manages its own scrolling (e.g. an inner `ListView`/`Flexible`).
Future<T?> showAppBottomSheet<T>({
  required BuildContext context,
  required Widget child,
  bool isDismissible = true,
  bool scrollable = false,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    isDismissible: isDismissible,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      final media = MediaQuery.of(ctx);
      return Padding(
        // Lift the whole sheet clear of the keyboard; rebuilds as it opens.
        padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: media.size.height - media.padding.top - 24,
          ),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(AppRadii.sheet),
              ),
              boxShadow: AppShadows.sheet,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 8),
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0E0E0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 12),
                Flexible(
                  child: scrollable
                      ? SingleChildScrollView(child: child)
                      : child,
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      );
    },
  );
}

/// Floating toast notification.
class AppToast {
  static void show(
    BuildContext context,
    String message, {
    ToastType type = ToastType.info,
  }) {
    final color = switch (type) {
      ToastType.success => AppColors.success,
      ToastType.error => AppColors.danger,
      ToastType.warning => AppColors.warning,
      ToastType.info => AppColors.info,
    };
    final icon = switch (type) {
      ToastType.success => Icons.check_circle_rounded,
      ToastType.error => Icons.error_rounded,
      ToastType.warning => Icons.warning_rounded,
      ToastType.info => Icons.info_rounded,
    };

    final overlay = Overlay.of(context);
    final entry = OverlayEntry(
      builder: (ctx) => Positioned(
        top: MediaQuery.of(ctx).padding.top + 12,
        left: 20,
        right: 20,
        child: Material(
          color: Colors.transparent,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.textDark,
              borderRadius: BorderRadius.circular(16),
              boxShadow: AppShadows.card,
            ),
            child: Row(
              children: [
                Icon(icon, color: color, size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    message,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    overlay.insert(entry);
    Future.delayed(const Duration(seconds: 3), entry.remove);
  }
}

enum ToastType { success, error, warning, info }

/// Floating bottom-nav bar - pill-shaped with rounded top corners.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onTap,
    required this.accent,
  });

  final List<BottomNavItem> items;
  final int currentIndex;
  final ValueChanged<int> onTap;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        child: Container(
          height: 76,
          decoration: BoxDecoration(
            color: AppNeu.on ? AppNeu.surface : Colors.white,
            borderRadius: BorderRadius.circular(AppRadii.bottomNav),
            boxShadow: AppNeu.on ? AppNeu.shadow : AppShadows.bottomNav,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Row(
            children: List.generate(items.length, (i) {
              final item = items[i];
              final selected = i == currentIndex;
              // Neumorphic: solid accent pill with light icon; classic: tint.
              final pill = AppNeu.on ? accent : accent.withValues(alpha: 0.14);
              final active = AppNeu.on ? Colors.white : accent;
              return Expanded(
                child: PressableScale(
                  pressedScale: 0.9,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppRadii.bottomNav),
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onTap(i);
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      curve: Curves.easeOutCubic,
                      margin: const EdgeInsets.symmetric(
                        horizontal: 2,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: selected ? pill : Colors.transparent,
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AnimatedScale(
                            scale: selected ? 1.12 : 1,
                            duration: const Duration(milliseconds: 320),
                            curve: Curves.easeOutBack,
                            child: Icon(
                              selected ? item.activeIcon : item.icon,
                              color: selected ? active : AppColors.textMuted,
                              size: 22,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            item.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 10,
                              height: 1.1,
                              color: selected ? active : AppColors.textMuted,
                              fontWeight: selected
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}

class BottomNavItem {
  const BottomNavItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
  });
  final String label;
  final IconData icon;
  final IconData activeIcon;
}

/// Friendly empty-state widget.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.emoji,
    required this.title,
    this.subtitle,
    this.ctaLabel,
    this.onCta,
  });

  final String emoji;
  final String title;
  final String? subtitle;
  final String? ctaLabel;
  final VoidCallback? onCta;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 72)),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textMuted,
                ),
              ),
            ],
            if (ctaLabel != null && onCta != null) ...[
              const SizedBox(height: 18),
              PrimaryButton(
                label: ctaLabel!,
                onPressed: onCta,
                fullWidth: false,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Full-screen zoomable network image: pinch to zoom (up to 5x) and
/// double-tap to toggle a 2.5x zoom centred on the tapped point.
class ZoomableImage extends StatefulWidget {
  const ZoomableImage({super.key, required this.url});
  final String url;

  @override
  State<ZoomableImage> createState() => _ZoomableImageState();
}

class _ZoomableImageState extends State<ZoomableImage> {
  final _controller = TransformationController();
  Offset _tapPosition = Offset.zero;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDoubleTap() {
    if (_controller.value != Matrix4.identity()) {
      _controller.value = Matrix4.identity();
    } else {
      // Zoom 2.5x about the tapped point.
      _controller.value = Matrix4.identity()
        ..translate(-_tapPosition.dx * 1.5, -_tapPosition.dy * 1.5)
        ..scale(2.5);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onDoubleTapDown: (d) => _tapPosition = d.localPosition,
      onDoubleTap: _onDoubleTap,
      child: InteractiveViewer(
        transformationController: _controller,
        maxScale: 5,
        child: Image.network(
          widget.url,
          width: double.infinity,
          height: double.infinity,
          fit: BoxFit.contain,
          loadingBuilder: (_, child, p) => p == null
              ? child
              : const Center(
                  child: CircularProgressIndicator(color: Colors.white54),
                ),
          errorBuilder: (_, e, s) => const Icon(
            Icons.broken_image_rounded,
            color: Colors.white54,
            size: 64,
          ),
        ),
      ),
    );
  }
}
