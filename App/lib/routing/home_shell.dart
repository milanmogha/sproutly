import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax/iconsax.dart';
import '../core/services/app_services.dart';
import '../core/services/http_notification_service.dart';
import '../core/services/http_school_service.dart';
import '../core/services/http_user_service.dart';
import '../core/services/services_scope.dart';
import '../core/theme/app_theme.dart';
import '../core/widgets/motion.dart';
import '../core/widgets/neu.dart';
import '../core/widgets/role_aware.dart';
import '../features/parent/screens/parent_academics.dart';
import '../features/parent/screens/parent_attendance.dart';
import '../features/parent/screens/parent_fees.dart';
import '../features/parent/screens/parent_home.dart';
import '../features/parent/screens/parent_more.dart';
import '../features/parent/widgets/max_kit.dart';
import '../features/teacher/screens/teacher_academics.dart';
import '../features/teacher/screens/teacher_attendance.dart';
import '../features/teacher/screens/teacher_home.dart';
import '../features/teacher/screens/teacher_more.dart';
import '../features/teacher/screens/teacher_students.dart';
import '../features/admin/screens/admin_attendance.dart';
import '../features/admin/screens/admin_home.dart';
import '../features/admin/screens/admin_students.dart';
import '../features/admin/screens/admin_fees.dart';
import '../features/super_admin/screens/super_admin_home.dart';

/// Hosts the 4 role-based interfaces. Each tab is a stack of pages that share
/// the role accent and bottom-nav. Notifications & Profile live in shared
/// screens and are opened as routes.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.role, required this.onLogout});

  final UserRole role;
  final VoidCallback onLogout;

  /// Switches the mounted shell to [index] of its bottom nav.
  ///
  /// Screens pushed *above* the shell (Notifications, say) sit on a different
  /// route and can't reach its state, so they call this to land the user on
  /// the right tab — see `notification_router.dart`. A no-op when no shell is
  /// mounted.
  static void selectTab(int index) => _selectTab?.call(index);
  static void Function(int index)? _selectTab;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  AppServices? _services;

  AppServices get services => _services ??= _buildServices();

  @override
  void initState() {
    super.initState();
    services; // initialize eagerly so the rest of the build can rely on it
    ServicesScope.current = services; // for screens pushed as routes
    HomeShell._selectTab = (i) {
      if (mounted) setState(() => _index = i);
    };
    // Soft-UI portals. The shared cards/nav render neumorphic surfaces here;
    // teacher screens get the same look by using the Neu kit directly.
    AppNeu.on =
        widget.role == UserRole.parent || widget.role == UserRole.admin;
  }

  @override
  void dispose() {
    ServicesScope.current = null;
    HomeShell._selectTab = null;
    AppNeu.on = false;
    super.dispose();
  }

  AppServices _buildServices() {
    return AppServices(
      notifications: HttpNotificationService(),
      // Real-backend services used by the Super Admin portal only; they fetch
      // nothing until that portal uses them.
      schools: HttpSchoolService(),
      users: HttpUserService(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ServicesScope(
      services: services,
      child: RoleColors(
        role: widget.role,
        child: Builder(builder: (context) {
          final accent = RoleColors.of(context).primary;
          return AnnotatedRegion<SystemUiOverlayStyle>(
            value: const SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarIconBrightness: Brightness.dark,
            ),
            // Block the system back button/gesture so users can only leave a
            // portal via the Logout button (which pops explicitly). Explicit
            // Navigator.pop() from onLogout is unaffected by canPop.
            child: PopScope(
              canPop: false,
              child: _buildShell(context, accent),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildShell(BuildContext context, Color accent) {
    switch (widget.role) {
      case UserRole.parent:
        return _ParentShell(
          currentIndex: _index,
          onTap: (i) => setState(() => _index = i),
          accent: accent,
          onLogout: widget.onLogout,
        );
      case UserRole.teacher:
        return _TeacherShell(
          currentIndex: _index,
          onTap: (i) => setState(() => _index = i),
          accent: accent,
          onLogout: widget.onLogout,
        );
      case UserRole.admin:
        return _AdminShell(
          currentIndex: _index,
          onTap: (i) => setState(() => _index = i),
          accent: accent,
          onLogout: widget.onLogout,
        );
      case UserRole.superAdmin:
        return _SuperAdminShell(
          currentIndex: _index,
          onTap: (i) => setState(() => _index = i),
          accent: accent,
          onLogout: widget.onLogout,
        );
    }
  }
}

class _ParentShell extends StatelessWidget {
  const _ParentShell({
    required this.currentIndex,
    required this.onTap,
    required this.accent,
    required this.onLogout,
  });
  final int currentIndex;
  final ValueChanged<int> onTap;
  final Color accent;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    const items = <({String label, IconData icon, IconData activeIcon})>[
      (label: 'Home', icon: Iconsax.home, activeIcon: Iconsax.home_1),
      (
        label: 'Attendance',
        icon: Iconsax.calendar,
        activeIcon: Iconsax.calendar_1
      ),
      (
        label: 'Fees',
        icon: Iconsax.money_recive,
        activeIcon: Iconsax.money_tick
      ),
      (label: 'Academics', icon: Iconsax.book, activeIcon: Iconsax.book_1),
      (label: 'More', icon: Iconsax.more, activeIcon: Iconsax.more_2),
    ];
    final pages = [
      const ParentHomeScreen(),
      const ParentAttendanceScreen(),
      const ParentFeesScreen(),
      const ParentAcademicsScreen(),
      const ParentMoreScreen(),
    ];

    return Scaffold(
      backgroundColor: Max.canvas,
      // Not extendBody: tab screens end above the nav, so nothing hides
      // behind it.
      body: AnimatedIndexedStack(index: currentIndex, children: pages),
      bottomNavigationBar: NeuBottomNav(
        items: items,
        currentIndex: currentIndex,
        onTap: onTap,
        accent: accent,
      ),
    );
  }
}

class _TeacherShell extends StatelessWidget {
  const _TeacherShell({
    required this.currentIndex,
    required this.onTap,
    required this.accent,
    required this.onLogout,
  });
  final int currentIndex;
  final ValueChanged<int> onTap;
  final Color accent;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    const items = <({String label, IconData icon, IconData activeIcon})>[
      (label: 'Home', icon: Iconsax.home, activeIcon: Iconsax.home_1),
      (
        label: 'Attendance',
        icon: Iconsax.clipboard_text,
        activeIcon: Iconsax.clipboard_text1
      ),
      (label: 'Students', icon: Iconsax.people, activeIcon: Iconsax.people1),
      (label: 'Academics', icon: Iconsax.book, activeIcon: Iconsax.book_1),
      (label: 'More', icon: Iconsax.more, activeIcon: Iconsax.more_2),
    ];
    final pages = [
      const TeacherHomeScreen(),
      const TeacherAttendanceMarkingScreen(),
      const TeacherStudentsScreen(),
      const TeacherAcademicsScreen(),
      const TeacherMoreScreen(),
    ];

    return Scaffold(
      backgroundColor: Neu.bg,
      extendBody: true,
      body: AnimatedIndexedStack(index: currentIndex, children: pages),
      bottomNavigationBar: NeuBottomNav(
        items: items,
        currentIndex: currentIndex,
        onTap: onTap,
      ),
    );
  }
}

class _AdminShell extends StatelessWidget {
  const _AdminShell({
    required this.currentIndex,
    required this.onTap,
    required this.accent,
    required this.onLogout,
  });
  final int currentIndex;
  final ValueChanged<int> onTap;
  final Color accent;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    const items = <({String label, IconData icon, IconData activeIcon})>[
      (label: 'Home', icon: Iconsax.home, activeIcon: Iconsax.home_1),
      (label: 'Students', icon: Iconsax.people, activeIcon: Iconsax.people1),
      (
        label: 'Attendance',
        icon: Iconsax.clipboard_text,
        activeIcon: Iconsax.clipboard_text1
      ),
      (
        label: 'Fees',
        icon: Iconsax.money_recive,
        activeIcon: Iconsax.money_tick
      ),
      (label: 'More', icon: Iconsax.more, activeIcon: Iconsax.more_2),
    ];
    final pages = [
      const AdminHomeScreen(),
      const AdminStudentsScreen(),
      const AdminAttendanceScreen(),
      const AdminFeesScreen(),
      const AdminMoreScreen(),
    ];

    return Scaffold(
      backgroundColor: Neu.bg,
      extendBody: true,
      body: AnimatedIndexedStack(index: currentIndex, children: pages),
      bottomNavigationBar: NeuBottomNav(
        items: items,
        currentIndex: currentIndex,
        onTap: onTap,
        accent: accent,
      ),
    );
  }
}

class _SuperAdminShell extends StatelessWidget {
  const _SuperAdminShell({
    required this.currentIndex,
    required this.onTap,
    required this.accent,
    required this.onLogout,
  });
  final int currentIndex;
  final ValueChanged<int> onTap;
  final Color accent;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    // Minimal UI: white surfaces, flat hairline nav (no floating pill), body
    // does not extend under the bar.
    final pages = [
      const SuperAdminHomeScreen(),
      const SuperAdminSchoolsScreen(),
      const SuperAdminUsersScreen(),
      const SuperAdminSettingsScreen(),
    ];

    return Scaffold(
      backgroundColor: Colors.white,
      // Glass nav: content scrolls beneath the frosted bar and gets blurred.
      extendBody: true,
      body: AnimatedIndexedStack(index: currentIndex, children: pages),
      bottomNavigationBar:
          SuperAdminNavBar(currentIndex: currentIndex, onTap: onTap),
    );
  }
}