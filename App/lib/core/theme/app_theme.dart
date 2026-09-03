import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Centralized design tokens for Sproutly.
///
/// Design language: **joyful maximalism** — a Sproutly-green anchor with bold,
/// saturated accents (grape, coral, gold, aqua, pink), chunky rounded shapes,
/// a playful rounded display face (Fredoka), and layered colourful surfaces.
/// Every screen inherits this through the tokens + Material component themes
/// below, so the whole app shifts together.
class AppColors {
  AppColors._();

  // ── Neutrals ──────────────────────────────────────────────
  // Flat pastel canvas + a near-black "ink" for the bold dark cards and the
  // floating pill nav (the signature of the maximalist reference).
  static const Color softWhite = Color(0xFFE9F2E1); // soft green pastel page
  static const Color warmSurface = Colors.white;
  static const Color mutedGray = Color(0xFFE2E7DD); // hairline/divider
  static const Color textDark = Color(0xFF1A201A); // near-black ink text
  static const Color textMuted = Color(0xFF6B756B);
  static const Color ink = Color(0xFF1B201B); // dark card / pill-nav surface
  static const Color onInk = Color(0xFFF2F6EE); // text on ink

  // ── Sproutly brand + bold accent palette ──────────────────
  // green is the anchor; everything else is a loud, joyful accent.
  static const Color brandGreen = Color(0xFF2E7D32); // THE anchor
  static const Color brandGreenDeep = Color(0xFF1B5E20);
  static const Color brandGreenLight = Color(0xFF66BB6A);
  static const Color greenBright = Color(0xFF57C15A); // vivid flat-block green

  // Kept names (used across 30+ screens) — revalued onto the new palette.
  static const Color brandNavy = brandGreenDeep; // was navy → deep green
  static const Color brandIndigo = Color(0xFF7C3AED); // grape
  static const Color heroGradientStart = brandGreen;
  static const Color heroGradientEnd = Color(0xFF00C9A7); // mint-teal
  static const Color gold = Color(0xFFFFC21C);
  static const Color brandPink = Color(0xFFFF4D8D);
  static const Color brandBlue = Color(0xFF2B8AF0);
  static const Color brandPurple = Color(0xFF8B3DFF);
  static const Color brandTeal = Color(0xFF00BFA6);

  // New loud accents (additive — safe to reference from new work).
  static const Color coral = Color(0xFFFF6B3D);
  static const Color lime = Color(0xFF8BD450);
  static const Color sky = Color(0xFF38BDF8);
  static const Color sunny = Color(0xFFFFB020);
  static const Color grape = brandPurple;

  /// The app-wide hero gradient (headers, banners, splash): green → mint.
  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [heroGradientStart, heroGradientEnd],
  );

  /// A second, warmer gradient for playful accents (coral → gold).
  static const LinearGradient sunsetGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [coral, gold],
  );

  // Semantic
  static const Color success = Color(0xFF22C77E);
  static const Color warning = gold;
  static const Color danger = Color(0xFFFF3B6B);
  static const Color info = brandBlue;

  // ── Role accents (each role gets its own loud voice) ──────
  // Parent — grape
  static const Color parentPrimary = brandIndigo;
  static const Color parentTint = Color(0xFFF1E7FE);
  static const Color parentBg = Color(0xFFFBF7F0);

  // Teacher — aqua/teal
  static const Color teacherPrimary = brandTeal;
  static const Color teacherTint = Color(0xFFDBF6F1);

  // Admin (a school) — the Sproutly green anchor
  static const Color adminPrimary = brandGreen;
  static const Color adminTint = Color(0xFFE3F3E4);

  // Super Admin — coral
  static const Color superAdminPrimary = coral;
  static const Color superAdminTint = Color(0xFFFFEADF);

  // Shimmer base (warm)
  static const Color shimmerBase = Color(0xFFF2ECE2);
  static const Color shimmerHighlight = Color(0xFFE9E1D4);

  // Tint helpers
  static Color tintForRole(UserRole role) {
    switch (role) {
      case UserRole.parent:
        return parentTint;
      case UserRole.teacher:
        return teacherTint;
      case UserRole.admin:
        return adminTint;
      case UserRole.superAdmin:
        return superAdminTint;
    }
  }

  static Color primaryForRole(UserRole role) {
    switch (role) {
      case UserRole.parent:
        return parentPrimary;
      case UserRole.teacher:
        return teacherPrimary;
      case UserRole.admin:
        return adminPrimary;
      case UserRole.superAdmin:
        return superAdminPrimary;
    }
  }

  /// Flat solid fill for a role (hero headers, CTAs, badges). Kept as a
  /// `LinearGradient` so existing `gradient:` call sites stay valid, but both
  /// stops are the same colour — the maximalist reference is flat, not glossy.
  static LinearGradient gradientForRole(UserRole role) {
    final base = primaryForRole(role);
    return LinearGradient(colors: [base, base]);
  }
}

enum UserRole { parent, teacher, admin, superAdmin }

extension UserRoleX on UserRole {
  String get label {
    switch (this) {
      case UserRole.parent:
        return 'Parent';
      case UserRole.teacher:
        return 'Teacher';
      case UserRole.admin:
        return 'Admin';
      case UserRole.superAdmin:
        return 'Super Admin';
    }
  }
}

class AppSpacing {
  AppSpacing._();
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
}

class AppRadii {
  AppRadii._();
  // Chunkier, friendlier corners across the board.
  static const double card = 26;
  static const double button = 18;
  static const double bottomNav = 34;
  static const double input = 16;
  static const double sheet = 32;
  static const double bottomSheet = 32;
  static const double chip = 999;
}

class AppShadows {
  AppShadows._();

  // Softer + a touch deeper, so the colourful cards feel like they float.
  static const List<BoxShadow> card = [
    BoxShadow(
      offset: Offset(0, 10),
      blurRadius: 30,
      color: Color(0x14000000),
    ),
    BoxShadow(
      offset: Offset(0, 2),
      blurRadius: 6,
      color: Color(0x0A000000),
    ),
  ];

  static const List<BoxShadow> bottomNav = [
    BoxShadow(
      offset: Offset(0, -2),
      blurRadius: 22,
      color: Color(0x12000000),
    ),
  ];

  static const List<BoxShadow> sheet = [
    BoxShadow(
      offset: Offset(0, -10),
      blurRadius: 44,
      color: Color(0x24000000),
    ),
  ];

  /// A soft accent-tinted drop-shadow under a filled block. Kept subtle so the
  /// look stays flat rather than glowy.
  static List<BoxShadow> pop(Color color, {double strength = 0.22}) => [
        BoxShadow(
          offset: const Offset(0, 8),
          blurRadius: 18,
          color: color.withValues(alpha: strength),
        ),
      ];
}

/// Soft-UI (neumorphic) tokens — active while the parent portal is open.
/// Re-tinted warm/green so the tactile portals read joyful rather than cold.
class AppNeu {
  AppNeu._();

  static bool on = false;

  static const Color surface = Colors.white;

  /// Light glow top-left + a warm green-tinted shade bottom-right.
  static const List<BoxShadow> shadow = [
    BoxShadow(offset: Offset(-4, -4), blurRadius: 10, color: Color(0xF0FFFFFF)),
    BoxShadow(offset: Offset(5, 5), blurRadius: 14, color: Color(0x1A2E7D32)),
  ];
}

class AppTypography {
  AppTypography._();

  // Rounded, chunky display face + warm readable body.
  static TextStyle _display(double size, FontWeight w, {double h = 1.15}) =>
      GoogleFonts.fredoka(
        fontSize: size,
        fontWeight: w,
        color: AppColors.textDark,
        height: h,
      );

  static TextStyle _body(double size, FontWeight w,
          {Color? color, double h = 1.4}) =>
      GoogleFonts.nunito(
        fontSize: size,
        fontWeight: w,
        color: color ?? AppColors.textDark,
        height: h,
      );

  static TextTheme buildTextTheme(TextTheme base) {
    return base.copyWith(
      displayLarge: _display(32, FontWeight.w700),
      displayMedium: _display(25, FontWeight.w600, h: 1.2),
      displaySmall: _display(21, FontWeight.w600, h: 1.2),
      headlineMedium: _display(19, FontWeight.w600),
      headlineSmall: _display(17, FontWeight.w600),
      titleLarge: _display(18, FontWeight.w600),
      titleMedium: _display(16, FontWeight.w500),
      bodyLarge: _body(14.5, FontWeight.w500),
      bodyMedium: _body(13.5, FontWeight.w500),
      labelLarge: _body(13, FontWeight.w700, color: AppColors.textMuted),
    );
  }
}

/// Soft fade-through used app-wide (unchanged mechanics).
class SoftPageTransitionsBuilder extends PageTransitionsBuilder {
  const SoftPageTransitionsBuilder();

  static Widget transition(
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final enter = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutQuint,
      reverseCurve: Curves.easeInCubic,
    );
    final fade = CurvedAnimation(
      parent: animation,
      curve: const Interval(0, 0.6, curve: Curves.easeOut),
      reverseCurve: const Interval(0.4, 1, curve: Curves.easeIn),
    );
    final recede = CurvedAnimation(
      parent: secondaryAnimation,
      curve: Curves.easeInOutCubic,
    );
    return FadeTransition(
      opacity: fade,
      child: AnimatedBuilder(
        animation: recede,
        builder: (_, c) => Opacity(
          opacity: 1 - 0.10 * recede.value,
          child: Transform.scale(
            scale: 1 - 0.03 * recede.value,
            child: c,
          ),
        ),
        child: SlideTransition(
          position: Tween<Offset>(
                  begin: const Offset(0, 0.03), end: Offset.zero)
              .animate(enter),
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.985, end: 1).animate(enter),
            child: RepaintBoundary(child: child),
          ),
        ),
      ),
    );
  }

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return transition(animation, secondaryAnimation, child);
  }
}

ThemeData buildAppTheme() {
  final base = ThemeData.light(useMaterial3: true);
  final radius = BorderRadius.circular(AppRadii.input);
  final textTheme = AppTypography.buildTextTheme(base.textTheme);

  return base.copyWith(
    scaffoldBackgroundColor: AppColors.softWhite,
    colorScheme: const ColorScheme.light(
      primary: AppColors.brandGreen,
      onPrimary: Colors.white,
      secondary: AppColors.brandIndigo,
      onSecondary: Colors.white,
      tertiary: AppColors.gold,
      surface: AppColors.warmSurface,
      error: AppColors.danger,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.softWhite,
      foregroundColor: AppColors.textDark,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      titleTextStyle: GoogleFonts.fredoka(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        color: AppColors.textDark,
      ),
    ),
    textTheme: textTheme,
    splashFactory: InkSparkle.splashFactory,
    visualDensity: VisualDensity.adaptivePlatformDensity,
    dividerTheme: const DividerThemeData(
      color: AppColors.mutedGray,
      thickness: 1,
      space: 1,
    ),
    // Rounded, filled inputs with a bold green focus ring.
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      hintStyle: GoogleFonts.nunito(
        color: AppColors.textMuted,
        fontWeight: FontWeight.w500,
      ),
      labelStyle: GoogleFonts.nunito(
        color: AppColors.textMuted,
        fontWeight: FontWeight.w600,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: const BorderSide(color: AppColors.mutedGray, width: 1.5),
      ),
      border: OutlineInputBorder(
        borderRadius: radius,
        borderSide: const BorderSide(color: AppColors.mutedGray, width: 1.5),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: const BorderSide(color: AppColors.brandGreen, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: const BorderSide(color: AppColors.danger, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.brandGreen,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 15),
        textStyle: GoogleFonts.fredoka(fontSize: 15, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.button),
        ),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.brandGreen,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 15),
        textStyle: GoogleFonts.fredoka(fontSize: 15, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.button),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.brandGreen,
        textStyle: GoogleFonts.nunito(fontWeight: FontWeight.w700),
      ),
    ),
    chipTheme: ChipThemeData(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.chip),
      ),
      side: BorderSide.none,
      backgroundColor: AppColors.adminTint,
      labelStyle: GoogleFonts.nunito(
        fontWeight: FontWeight.w700,
        color: AppColors.textDark,
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: AppColors.brandGreen,
      foregroundColor: Colors.white,
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.brandGreenDeep,
      contentTextStyle:
          GoogleFonts.nunito(color: Colors.white, fontWeight: FontWeight.w600),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppRadii.bottomSheet),
        ),
      ),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppColors.brandGreen,
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: AppColors.brandGreen,
      unselectedLabelColor: AppColors.textMuted,
      indicatorColor: AppColors.brandGreen,
      labelStyle: GoogleFonts.fredoka(fontWeight: FontWeight.w600),
      unselectedLabelStyle: GoogleFonts.nunito(fontWeight: FontWeight.w600),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.selected) ? Colors.white : Colors.white,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.selected)
            ? AppColors.brandGreen
            : AppColors.mutedGray,
      ),
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: <TargetPlatform, PageTransitionsBuilder>{
        TargetPlatform.android: SoftPageTransitionsBuilder(),
        TargetPlatform.windows: SoftPageTransitionsBuilder(),
        TargetPlatform.macOS: SoftPageTransitionsBuilder(),
        TargetPlatform.linux: SoftPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
  );
}
