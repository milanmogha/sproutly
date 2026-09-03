import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// Emoji avatar for a child. When [gender] is provided it shows a cartoonish
/// boy (male) or girl (female) face; otherwise it falls back to a predictable,
/// seed-based animal (used where gender is unknown, e.g. admission inquiries).
/// No real photos required; joyful, consistent avatars for preschoolers.
class AnimalAvatar extends StatelessWidget {
  const AnimalAvatar({
    super.key,
    required this.seed,
    this.gender,
    this.size = 44,
    this.borderColor = Colors.white,
    this.borderWidth = 2,
  });

  final String seed;

  /// 'male' / 'female' (case-insensitive). Anything else → animal fallback.
  final String? gender;
  final double size;
  final Color borderColor;
  final double borderWidth;

  // A little skin-tone variety by seed while staying clearly boy/girl.
  static const List<String> _boys = ['👦', '👦🏻', '👦🏽', '👦🏾'];
  static const List<String> _girls = ['👧', '👧🏻', '👧🏽', '👧🏾'];

  static const List<String> _animals = [
    '🦉', // owl
    '🐰', // bunny
    '🐻', // bear
    '🐼', // panda
    '🐯', // tiger
    '🦁', // lion
    '🐶', // puppy
    '🐱', // kitten
    '🦊', // fox
    '🐨', // koala
    '🐸', // frog
    '🐵', // monkey
    '🦄', // unicorn
    '🐢', // turtle
    '🐬', // dolphin
    '🦋', // butterfly
  ];

  static const List<Color> _backgrounds = [
    Color(0xFFFFE4E1),
    Color(0xFFE4F7F2),
    Color(0xFFEEF0FF),
    Color(0xFFFFF0EE),
    Color(0xFFFFF6D9),
    Color(0xFFE6F7FF),
    Color(0xFFF3E8FF),
    Color(0xFFE8FFE3),
  ];

  @override
  Widget build(BuildContext context) {
    final code = seed.codeUnits.fold<int>(0, (a, b) => a + b);
    final g = gender?.toLowerCase();
    final String emoji;
    if (g == 'male') {
      emoji = _boys[code % _boys.length];
    } else if (g == 'female') {
      emoji = _girls[code % _girls.length];
    } else {
      emoji = _animals[code % _animals.length];
    }
    final bg = _backgrounds[code % _backgrounds.length];

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        border: Border.all(color: borderColor, width: borderWidth),
      ),
      alignment: Alignment.center,
      child: Text(
        emoji,
        style: TextStyle(fontSize: size * 0.55),
      ),
    );
  }
}

/// Circular initials avatar for teachers/staff/admins.
class InitialAvatar extends StatelessWidget {
  const InitialAvatar({
    super.key,
    required this.name,
    this.size = 44,
    this.color,
  });

  final String name;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final initials = name
        .trim()
        .split(RegExp(r'\s+'))
        .take(2)
        .map((e) => e.isNotEmpty ? e[0].toUpperCase() : '')
        .join();
    final accent = color ?? AppColors.parentPrimary;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.18),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
      ),
      child: Text(
        initials,
        style: TextStyle(
          color: accent,
          fontSize: size * 0.36,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
