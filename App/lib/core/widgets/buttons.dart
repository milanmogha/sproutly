import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

/// Primary CTA button — a bold gradient pill with a colourful pop-shadow, 54dp
/// tall. Joyful-maximalist: filled with a two-stop accent gradient and a
/// coloured drop-shadow so it reads as a candy button that floats.
class PrimaryButton extends StatefulWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    this.fullWidth = true,
    this.color,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final bool fullWidth;
  final Color? color;

  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton> {
  double _scale = 1;

  @override
  Widget build(BuildContext context) {
    final accent = widget.color ?? AppColors.brandGreen;
    final enabled = widget.onPressed != null && !widget.isLoading;
    final radius = BorderRadius.circular(AppRadii.button);

    final btn = AnimatedScale(
      scale: _scale,
      duration: const Duration(milliseconds: 120),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: radius,
          boxShadow: enabled ? AppShadows.pop(accent) : null,
        ),
        child: SizedBox(
          width: widget.fullWidth ? double.infinity : null,
          height: 54,
          child: Material(
            color: Colors.transparent,
            child: Ink(
              decoration: BoxDecoration(
                color: enabled ? accent : accent.withValues(alpha: 0.4),
                borderRadius: radius,
              ),
              child: InkWell(
                borderRadius: radius,
                onTap: widget.isLoading
                    ? null
                    : () {
                        HapticFeedback.lightImpact();
                        widget.onPressed?.call();
                      },
                onTapDown: (_) => setState(() => _scale = 0.96),
                onTapCancel: () => setState(() => _scale = 1),
                onTapUp: (_) => setState(() => _scale = 1),
                child: Center(
                  child: widget.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (widget.icon != null) ...[
                              Icon(widget.icon, color: Colors.white, size: 21),
                              const SizedBox(width: 9),
                            ],
                            Text(
                              widget.label,
                              style: GoogleFonts.fredoka(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.2,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    return btn;
  }
}

/// Outlined secondary button.
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
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
    final accent = color ?? AppColors.parentPrimary;
    return SizedBox(
      height: 48,
      child: OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          foregroundColor: accent,
          side: BorderSide(color: accent.withValues(alpha: 0.5), width: 1.4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.button),
          ),
        ),
        onPressed: () {
          HapticFeedback.lightImpact();
          onPressed?.call();
        },
        icon: icon != null ? Icon(icon, size: 18) : const SizedBox.shrink(),
        label: Text(label),
      ),
    );
  }
}

/// Small circular tinted icon button.
class TintedIconButton extends StatelessWidget {
  const TintedIconButton({
    super.key,
    required this.icon,
    required this.color,
    this.onTap,
    this.size = 44,
  });

  final IconData icon;
  final Color color;
  final VoidCallback? onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withValues(alpha: 0.14),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () {
          HapticFeedback.lightImpact();
          onTap?.call();
        },
        child: SizedBox(
          width: size,
          height: size,
          child: Icon(icon, color: color, size: 22),
        ),
      ),
    );
  }
}
