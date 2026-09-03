import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

/// Neumorphic (soft-UI) kit for the Teacher portal.
///
/// Every surface shares the same soft sage background; depth comes from a
/// paired light glow (top-left) and teal-gray shade (bottom-right). Raised
/// surfaces carry a subtle convex gradient; pressed / selected states flip to
/// a concave "carved-in" look. Interactive widgets animate between the two,
/// which gives the whole portal its tactile, 3D feel.
class Neu {
  Neu._();

  /// Page background — the soft green pastel canvas.
  static const Color bg = Color(0xFFE9F2E1);

  /// Card surface — flat white.
  static const Color surface = Color(0xFFFFFFFF);

  /// Light inset tone (search fields, tracks).
  static const Color well = Color(0xFFEFF3EA);

  static const Color accent = AppColors.brandGreen;

  /// Standard raised depth — a single soft neutral drop (flat, not embossed).
  static const List<BoxShadow> raisedShadow = [
    BoxShadow(offset: Offset(0, 8), blurRadius: 22, color: Color(0x14000000)),
  ];

  /// Deeper drop for hero elements (nav bar, floating buttons).
  static const List<BoxShadow> floatShadow = [
    BoxShadow(offset: Offset(0, 12), blurRadius: 28, color: Color(0x1F000000)),
  ];

  /// Raised face: flat white.
  static const LinearGradient convex = LinearGradient(
    colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF)],
  );

  /// Inset face: flat light pastel.
  static const LinearGradient concave = LinearGradient(
    colors: [Color(0xFFEFF3EA), Color(0xFFEFF3EA)],
  );

  /// Filled-accent face for primary CTAs (flat green).
  static const LinearGradient accentConvex = LinearGradient(
    colors: [Color(0xFF2E7D32), Color(0xFF2E7D32)],
  );

  /// Accent CTA depth: a soft green drop.
  static const List<BoxShadow> accentShadow = [
    BoxShadow(offset: Offset(0, 8), blurRadius: 18, color: Color(0x382E7D32)),
  ];
}

/// Base soft-UI container. [inset] flips the surface from raised (convex,
/// outer shadows) to carved-in (concave, no outer shadows).
class NeuBox extends StatelessWidget {
  const NeuBox({
    super.key,
    required this.child,
    this.inset = false,
    this.radius = AppRadii.card,
    this.padding = EdgeInsets.zero,
    this.shadow,
    this.shape = BoxShape.rectangle,
  });

  final Widget child;
  final bool inset;
  final double radius;
  final EdgeInsets padding;
  final List<BoxShadow>? shadow;
  final BoxShape shape;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        shape: shape,
        gradient: inset ? Neu.concave : Neu.convex,
        borderRadius:
            shape == BoxShape.circle ? null : BorderRadius.circular(radius),
        boxShadow: inset ? null : (shadow ?? Neu.raisedShadow),
        border: inset
            ? Border.all(color: const Color(0x1A2E7D32), width: 0.8)
            : null,
      ),
      child: child,
    );
  }
}

/// Raised card that physically presses into the page while touched: shadows
/// collapse, the face flips concave and the card scales down a hair.
class NeuCard extends StatefulWidget {
  const NeuCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(18),
    this.radius = AppRadii.card,
    this.shadow,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  final double radius;
  final List<BoxShadow>? shadow;

  @override
  State<NeuCard> createState() => _NeuCardState();
}

class _NeuCardState extends State<NeuCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final card = AnimatedScale(
      scale: _pressed ? 0.977 : 1,
      duration: const Duration(milliseconds: 140),
      curve: Curves.easeOutCubic,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOut,
        padding: widget.padding,
        decoration: BoxDecoration(
          gradient: _pressed ? Neu.concave : Neu.convex,
          borderRadius: BorderRadius.circular(widget.radius),
          boxShadow: _pressed ? null : (widget.shadow ?? Neu.raisedShadow),
        ),
        child: widget.child,
      ),
    );

    if (widget.onTap == null) return card;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onTap!();
      },
      child: card,
    );
  }
}

/// 3D press-tilt: the child leans toward wherever the finger lands (subtle
/// perspective rotation) and springs back on release. Wrap hero cards and
/// grid tiles for a gentle dimensional feel.
class NeuTilt extends StatefulWidget {
  const NeuTilt({super.key, required this.child, this.maxTilt = 0.035});

  final Widget child;

  /// Max rotation in radians (~2 degrees by default — keep it classy).
  final double maxTilt;

  @override
  State<NeuTilt> createState() => _NeuTiltState();
}

class _NeuTiltState extends State<NeuTilt> {
  double _rx = 0, _ry = 0;

  void _update(Offset local, Size size) {
    // -1..1 relative to the center.
    final dx = (local.dx / size.width) * 2 - 1;
    final dy = (local.dy / size.height) * 2 - 1;
    setState(() {
      _ry = dx * widget.maxTilt;
      _rx = -dy * widget.maxTilt;
    });
  }

  void _reset() => setState(() {
        _rx = 0;
        _ry = 0;
      });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final size = Size(constraints.maxWidth,
          constraints.maxHeight.isFinite ? constraints.maxHeight : 120);
      return Listener(
        onPointerDown: (e) => _update(e.localPosition, size),
        onPointerMove: (e) => _update(e.localPosition, size),
        onPointerUp: (_) => _reset(),
        onPointerCancel: (_) => _reset(),
        // AnimatedContainer lerps the matrix, easing the lean in and
        // springing it back on release.
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOutCubic,
          transformAlignment: Alignment.center,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.0016) // perspective
            ..rotateX(_rx)
            ..rotateY(_ry),
          child: widget.child,
        ),
      );
    });
  }
}

/// Primary CTA — a convex accent pill that presses in on touch.
class NeuButton extends StatefulWidget {
  const NeuButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.fullWidth = true,
    this.height = 52,
    this.color,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool fullWidth;
  final double height;

  /// Overrides the teal fill (e.g. danger red for destructive actions).
  final Color? color;

  @override
  State<NeuButton> createState() => _NeuButtonState();
}

class _NeuButtonState extends State<NeuButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;
    final base = widget.color;
    final gradient = base == null
        ? Neu.accentConvex
        : LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color.lerp(base, Colors.white, 0.18)!,
              Color.lerp(base, Colors.black, 0.12)!,
            ],
          );
    final shadow = base == null
        ? Neu.accentShadow
        : [
            const BoxShadow(
                offset: Offset(-4, -4),
                blurRadius: 10,
                color: Color(0xB3FFFFFF)),
            BoxShadow(
                offset: const Offset(0, 7),
                blurRadius: 16,
                color: base.withValues(alpha: 0.35)),
          ];
    return GestureDetector(
      onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
      onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
      onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
      onTap: enabled
          ? () {
              HapticFeedback.lightImpact();
              widget.onPressed!();
            }
          : null,
      child: AnimatedScale(
        scale: _pressed ? 0.965 : 1,
        duration: const Duration(milliseconds: 130),
        curve: Curves.easeOutCubic,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          height: widget.height,
          width: widget.fullWidth ? double.infinity : null,
          padding: const EdgeInsets.symmetric(horizontal: 24),
          decoration: BoxDecoration(
            gradient: enabled ? gradient : null,
            color: enabled ? null : Neu.well,
            borderRadius: BorderRadius.circular(AppRadii.button + 2),
            boxShadow: enabled && !_pressed ? shadow : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.icon != null) ...[
                Icon(widget.icon,
                    color: enabled ? Colors.white : AppColors.textMuted,
                    size: 20),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Text(
                  widget.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: enabled ? Colors.white : AppColors.textMuted,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Quiet sibling of [NeuButton] — raised neutral surface with accent text.
class NeuGhostButton extends StatelessWidget {
  const NeuGhostButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.color,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Neu.accent;
    return NeuCard(
      onTap: onPressed,
      radius: AppRadii.button + 2,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (icon != null) ...[
            Icon(icon, color: c, size: 19),
            const SizedBox(width: 8),
          ],
          Text(label,
              style: TextStyle(
                  color: c, fontSize: 14.5, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

/// Toggle chip: raised when idle; sinks in (concave) with accent text when
/// selected — the classic neumorphic switch.
class NeuChip extends StatelessWidget {
  const NeuChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.accent,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final c = accent ?? Neu.accent;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 9),
        decoration: BoxDecoration(
          gradient: selected ? Neu.concave : Neu.convex,
          borderRadius: BorderRadius.circular(AppRadii.chip),
          boxShadow: selected ? null : Neu.raisedShadow,
          border: selected
              ? Border.all(color: c.withValues(alpha: 0.45), width: 1)
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? c : AppColors.textMuted,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}

/// Small raised circle holding an icon — avatar wells, icon badges.
class NeuIconWell extends StatelessWidget {
  const NeuIconWell({
    super.key,
    required this.icon,
    this.color,
    this.size = 46,
    this.iconSize = 22,
    this.onTap,
    this.inset = false,
  });

  final IconData icon;
  final Color? color;
  final double size;
  final double iconSize;
  final VoidCallback? onTap;
  final bool inset;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Neu.accent;
    final well = NeuBox(
      inset: inset,
      shape: BoxShape.circle,
      child: SizedBox(
        width: size,
        height: size,
        child: Icon(icon, color: c, size: iconSize),
      ),
    );
    if (onTap == null) return well;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap!();
      },
      child: well,
    );
  }
}

/// Carved-in container for search fields and progress tracks.
class NeuInset extends StatelessWidget {
  const NeuInset({
    super.key,
    required this.child,
    this.radius = 24,
    this.padding = EdgeInsets.zero,
  });

  final Widget child;
  final double radius;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return NeuBox(inset: true, radius: radius, padding: padding, child: child);
  }
}

/// Animated progress bar: inset track with a convex accent fill.
class NeuProgressBar extends StatelessWidget {
  const NeuProgressBar({super.key, required this.value, this.height = 12});

  /// 0..1
  final double value;
  final double height;

  @override
  Widget build(BuildContext context) {
    return NeuInset(
      radius: height,
      child: SizedBox(
        height: height,
        child: LayoutBuilder(builder: (context, c) {
          return Align(
            alignment: Alignment.centerLeft,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 350),
              curve: Curves.easeOutCubic,
              width: c.maxWidth * value.clamp(0.0, 1.0),
              decoration: BoxDecoration(
                gradient: Neu.accentConvex,
                borderRadius: BorderRadius.circular(height),
              ),
            ),
          );
        }),
      ),
    );
  }
}

/// Round P / A / L marker: raised with colored text when idle, filled convex
/// with white text once selected.
class NeuMarkPill extends StatelessWidget {
  const NeuMarkPill({
    super.key,
    required this.label,
    required this.selected,
    required this.color,
    required this.onTap,
    this.size = 34,
  });

  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: selected
              ? LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [color.withValues(alpha: 0.95), color],
                )
              : Neu.convex,
          boxShadow: selected
              ? [
                  BoxShadow(
                      offset: const Offset(0, 4),
                      blurRadius: 9,
                      color: color.withValues(alpha: 0.45)),
                ]
              : Neu.raisedShadow,
        ),
        child: Text(label,
            style: TextStyle(
              color: selected ? Colors.white : color,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            )),
      ),
    );
  }
}

/// Soft-UI bottom navigation: raised bar; the active item sits in a carved
/// well with an accent icon that pops in.
class NeuBottomNav extends StatelessWidget {
  const NeuBottomNav({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onTap,
    this.accent,
  });

  final List<({String label, IconData icon, IconData activeIcon})> items;
  final int currentIndex;
  final ValueChanged<int> onTap;

  /// Active-item color; defaults to the teacher teal.
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final active = accent ?? Neu.accent;
    // Black floating pill; the active tab expands into an accent pill with its
    // label — the signature bold-maximalist nav.
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: Container(
          height: 66,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(
            color: AppColors.ink,
            borderRadius: BorderRadius.circular(AppRadii.bottomNav),
            boxShadow: const [
              BoxShadow(
                  offset: Offset(0, 10),
                  blurRadius: 24,
                  color: Color(0x33000000)),
            ],
          ),
          child: Row(
            children: List.generate(items.length, (i) {
              final item = items[i];
              final selected = i == currentIndex;
              return Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    onTap(i);
                  },
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Compact accent highlight behind the active icon —
                      // sized to fit even a 6-item nav on a narrow phone.
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 260),
                        curve: Curves.easeOutCubic,
                        width: 38,
                        height: 30,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: selected ? active : Colors.transparent,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Icon(
                          selected ? item.activeIcon : item.icon,
                          color: selected
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.55),
                          size: 20,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.nunito(
                          fontSize: 9.5,
                          height: 1,
                          fontWeight:
                              selected ? FontWeight.w800 : FontWeight.w600,
                          color: selected
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.45),
                        ),
                      ),
                    ],
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

/// Shared push transition: the new page floats up with a gentle fade +
/// settle while the page beneath recedes. Same motion as the app-wide
/// [SoftPageTransitionsBuilder], slightly longer so it reads as a glide.
Route<T> neuRoute<T>(Widget page) {
  return PageRouteBuilder<T>(
    transitionDuration: const Duration(milliseconds: 450),
    reverseTransitionDuration: const Duration(milliseconds: 340),
    pageBuilder: (_, _, _) => page,
    transitionsBuilder: (_, animation, secondaryAnimation, child) =>
        SoftPageTransitionsBuilder.transition(
            animation, secondaryAnimation, child),
  );
}
