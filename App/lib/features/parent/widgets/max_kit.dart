import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Maximalism kit for the Parent portal.
///
/// A loud, flat, chunky-rounded language modelled on the reference: a soft-pink
/// canvas, bold flat colour blocks (bright green hero, grape stat cards, an
/// ink-black status card), pill-shaped segmented controls, circular icon
/// buttons and big rounded display type. Every parent surface is built from
/// these primitives so the whole portal reads as one system.
class Max {
  Max._();

  // ── Canvas & surfaces ─────────────────────────────────────
  /// Soft-pink page canvas (the device-screen background in the reference).
  static const Color canvas = Color(0xFFF6DBE8);

  /// Flat white content card.
  static const Color card = Color(0xFFFFFFFF);

  /// A softer pink card for quieter, secondary blocks.
  static const Color cardPink = Color(0xFFFBEAF2);

  /// Near-black "ink" for the bold dark card and the floating nav.
  static const Color ink = Color(0xFF15121A);

  // ── Loud accent blocks ────────────────────────────────────
  static const Color green = Color(0xFF57C15A); // bright hero block
  static const Color grape = Color(0xFF7C3AED); // stat blocks
  static const Color grapeDeep = Color(0xFF5B21B6);

  // ── Type colours ──────────────────────────────────────────
  static const Color textInk = Color(0xFF1A1420);
  static const Color textMuted = Color(0xFF7A7180);
  static const Color onInk = Color(0xFFF4EEFA);

  // ── Radii ─────────────────────────────────────────────────
  static const double rCard = 28;
  static const double rBlock = 24;

  static const List<BoxShadow> softShadow = [
    BoxShadow(offset: Offset(0, 10), blurRadius: 26, color: Color(0x14201018)),
  ];

  static TextStyle display(double size,
          {FontWeight w = FontWeight.w600, Color? color, double h = 1.1}) =>
      GoogleFonts.fredoka(
          fontSize: size, fontWeight: w, color: color ?? textInk, height: h);

  static TextStyle body(double size,
          {FontWeight w = FontWeight.w600, Color? color, double h = 1.35}) =>
      GoogleFonts.nunito(
          fontSize: size, fontWeight: w, color: color ?? textInk, height: h);
}

/// A plain flat rounded surface — the base for list cards (diary, events…).
class MaxCard extends StatelessWidget {
  const MaxCard({
    super.key,
    required this.child,
    this.onTap,
    this.color = Max.card,
    this.padding = const EdgeInsets.all(18),
    this.radius = Max.rCard,
    this.shadow = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final Color color;
  final EdgeInsets padding;
  final double radius;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    final body = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: shadow ? Max.softShadow : null,
      ),
      child: child,
    );
    if (onTap == null) return body;
    return _Pressable(onTap: onTap!, radius: radius, child: body);
  }
}

/// Circular icon button — white face, ink glyph (bell, back, chevrons).
class MaxCircleButton extends StatelessWidget {
  const MaxCircleButton({
    super.key,
    required this.icon,
    this.onTap,
    this.size = 46,
    this.iconSize = 22,
    this.background = Max.card,
    this.foreground = Max.textInk,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final double size;
  final double iconSize;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    final body = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: background,
        shape: BoxShape.circle,
        boxShadow: Max.softShadow,
      ),
      child: Icon(icon, size: iconSize, color: foreground),
    );
    if (onTap == null) return body;
    return _Pressable(onTap: onTap, circle: true, child: body);
  }
}

/// White pill search field (decorative launcher).
class MaxSearchPill extends StatelessWidget {
  const MaxSearchPill({super.key, required this.hint, this.onTap});
  final String hint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _Pressable(
      onTap: onTap,
      radius: 999,
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          color: Max.card,
          borderRadius: BorderRadius.circular(999),
          boxShadow: Max.softShadow,
        ),
        child: Row(
          children: [
            const Icon(Icons.search_rounded, color: Max.textMuted, size: 22),
            const SizedBox(width: 12),
            Text(hint, style: Max.body(14.5, color: Max.textMuted)),
          ],
        ),
      ),
    );
  }
}

/// Pill segmented control — selected segment becomes an ink pill with a leading
/// glyph; the track is a flat white pill.
class MaxSegmented extends StatelessWidget {
  const MaxSegmented({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.onChanged,
  });

  final List<({String label, IconData icon})> items;
  final int selectedIndex;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        color: Max.card,
        borderRadius: BorderRadius.circular(999),
        boxShadow: Max.softShadow,
      ),
      child: Row(
        children: List.generate(items.length, (i) {
          final item = items[i];
          final selected = i == selectedIndex;
          return Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                HapticFeedback.selectionClick();
                onChanged(i);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected ? Max.ink : Colors.transparent,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(item.icon,
                        size: 16,
                        color: selected ? Colors.white : Max.textMuted),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        item.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Max.body(13,
                            w: FontWeight.w700,
                            color: selected ? Colors.white : Max.textMuted),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

/// Big-number stat block — a flat coloured card with the icon in an ink circle,
/// a large display value and a small label (the "102 Days" tiles).
class MaxStatCard extends StatelessWidget {
  const MaxStatCard({
    super.key,
    required this.value,
    required this.label,
    required this.icon,
    this.color = Max.grape,
    this.valueColor = Colors.white,
    this.iconBg = Max.ink,
    this.onTap,
  });

  final String value;
  final String label;
  final IconData icon;
  final Color color;
  final Color valueColor;
  final Color iconBg;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final body = Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(Max.rBlock),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: iconBg, shape: BoxShape.circle),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(height: 14),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Max.display(26, w: FontWeight.w700, color: valueColor)),
          const SizedBox(height: 1),
          Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Max.body(12,
                  w: FontWeight.w700,
                  color: valueColor.withValues(alpha: 0.82))),
        ],
      ),
    );
    if (onTap == null) return body;
    return _Pressable(onTap: onTap, radius: Max.rBlock, child: body);
  }
}

/// Small pill used inside blocks for meta ("16 lessons", "19h 40m") — an icon
/// plus a bit of text, tinted for its host block.
class MaxMetaChip extends StatelessWidget {
  const MaxMetaChip({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
  });
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: color),
        const SizedBox(width: 5),
        Text(label, style: Max.body(12.5, w: FontWeight.w700, color: color)),
      ],
    );
  }
}

/// A generic section header: bold title + optional "See all" affordance.
class MaxSectionHeader extends StatelessWidget {
  const MaxSectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: Text(title, style: Max.display(20, w: FontWeight.w600))),
        if (actionLabel != null && onAction != null)
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onAction,
            child: Row(
              children: [
                Text(actionLabel!,
                    style: Max.body(13, w: FontWeight.w700, color: Max.textMuted)),
                const SizedBox(width: 3),
                const Icon(Icons.arrow_forward_rounded,
                    size: 15, color: Max.textMuted),
              ],
            ),
          ),
      ],
    );
  }
}

/// Shared press feedback — a subtle scale-down used across the kit.
class _Pressable extends StatefulWidget {
  const _Pressable({
    required this.child,
    required this.onTap,
    this.radius = Max.rCard,
    this.circle = false,
  });
  final Widget child;
  final VoidCallback? onTap;
  final double radius;
  final bool circle;

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapCancel: () => setState(() => _down = false),
      onTapUp: (_) => setState(() => _down = false),
      onTap: widget.onTap == null
          ? null
          : () {
              HapticFeedback.lightImpact();
              widget.onTap!();
            },
      child: AnimatedScale(
        scale: _down ? 0.972 : 1,
        duration: const Duration(milliseconds: 130),
        curve: Curves.easeOutCubic,
        child: widget.child,
      ),
    );
  }
}
