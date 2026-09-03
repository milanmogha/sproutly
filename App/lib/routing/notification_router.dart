import 'package:flutter/material.dart';

import '../core/models/app_notification.dart';
import '../core/network/admin_api.dart';
import '../core/network/auth_api.dart';
import '../core/theme/app_theme.dart';
import '../core/widgets/atoms.dart';
import '../features/admin/screens/admin_messages.dart';
import '../features/admin/screens/admin_ptm.dart';
import '../features/admin/screens/admin_student_profile.dart';
import '../features/admin/screens/admin_students.dart';
import '../features/parent/screens/parent_more.dart';
import '../features/parent/screens/parent_student_profile.dart';
import '../features/teacher/screens/teacher_messages.dart';
import '../features/teacher/screens/teacher_more.dart';
import 'home_shell.dart';

/// Where a tapped notification takes you.
///
/// The backend stamps every notification with a `type` (and, where it matters,
/// a `data` payload) — see the `notifications.send` calls across the backend
/// modules: message, circular, event, fee, attendance, homework,
/// profile_change_request, profile_update.
///
/// Destinations are role-dependent: a "fee" notification means the Fees tab to
/// a parent, but the fee dashboard to an admin. Two shapes of destination:
///
///  * **Push a screen** when the notification points at one thing (a chat
///    thread, a student profile). The notifications route stays underneath, so
///    Back returns to the list.
///  * **Jump a tab** when the target *is* one of the shell's tabs. The shell
///    lives below this route, so we switch its tab and pop back to it.
///
/// Unknown types simply mark-as-read and stay put — better than navigating
/// somewhere arbitrary.
Future<void> openNotification(
  BuildContext context,
  AppNotification n,
) async {
  final role = AuthApi.instance.currentSession?.uiRole;
  if (role == null) return;

  switch (role) {
    case UserRole.parent:
      await _openForParent(context, n);
    case UserRole.teacher:
      await _openForTeacher(context, n);
    case UserRole.admin:
      await _openForAdmin(context, n);
    case UserRole.superAdmin:
      // The super admin portal has no notification-backed screens.
      break;
  }
}

// ── Per-role routing ────────────────────────────────────────

// Parent tabs: 0 Home · 1 Attendance · 2 Fees · 3 Academics · 4 More
Future<void> _openForParent(BuildContext context, AppNotification n) async {
  switch (n.type) {
    case 'message':
      final sender = _sender(n);
      if (sender == null) return;
      await _push(
        context,
        ParentChatThreadScreen(
          otherId: sender.id,
          otherName: sender.name,
        ),
      );
    case 'circular':
      await _push(
        context,
        const ParentCommunicationScreen(initialTab: 1),
      );
    case 'event':
      await _push(context, const ParentEventsScreen());
    case 'ptm':
      // Read-only for a parent: the school decided, this is the outcome.
      await _push(context, const ParentCommunicationScreen(initialTab: 2));
    case 'profile_update':
      // The screen loads the selected child itself when given none.
      await _push(context, const ParentStudentProfileScreen());
    case 'attendance':
      _jumpToTab(context, 1);
    case 'fee':
      _jumpToTab(context, 2);
    case 'homework':
      _jumpToTab(context, 3);
  }
}

// Teacher tabs: 0 Home · 1 Attendance · 2 Students · 3 Academics · 4 More
Future<void> _openForTeacher(BuildContext context, AppNotification n) async {
  switch (n.type) {
    case 'message':
      final sender = _sender(n);
      if (sender == null) return;
      await _push(
        context,
        TeacherChatThreadScreen(
          otherId: sender.id,
          otherName: sender.name,
        ),
      );
    case 'circular':
      await _push(context, const TeacherCircularsScreen());
    case 'ptm':
      await _push(context, const TeacherPtmScreen());
    case 'attendance':
      _jumpToTab(context, 1);
    case 'homework':
      _jumpToTab(context, 3);
  }
}

// Admin tabs: 0 Home · 1 Students · 2 Attendance · 3 Fees · 4 More
Future<void> _openForAdmin(BuildContext context, AppNotification n) async {
  switch (n.type) {
    case 'message':
      final sender = _sender(n);
      if (sender == null) return;
      await _push(
        context,
        AdminChatThreadScreen(
          otherId: sender.id,
          otherName: sender.name,
        ),
      );
    case 'profile_change_request':
      await _openStudentProfile(context, n);
    case 'circular':
      await _push(context, const AdminCommunicationScreen());
    case 'ptm':
      // The admin is the one who acts on a PTM — land them on the queue.
      await _push(context, const AdminPtmScreen());
    case 'event':
      await _push(context, const AdminEventsScreen());
    case 'attendance':
      _jumpToTab(context, 2);
    case 'fee':
      _jumpToTab(context, 3);
  }
}

// ── Destinations ────────────────────────────────────────────

/// A parent's profile-change request names the student it's about; the admin
/// resolves it on that student's profile.
Future<void> _openStudentProfile(
  BuildContext context,
  AppNotification n,
) async {
  final id = n.studentId;
  if (id == null || id.isEmpty) return;
  try {
    final student = await AdminApi.instance.getStudent(id);
    if (!context.mounted) return;
    await _push(context, AdminStudentProfileScreen(student: student));
  } catch (_) {
    if (!context.mounted) return;
    AppToast.show(
      context,
      'Could not open the student profile.',
      type: ToastType.error,
    );
  }
}

/// The chat notification carries who sent it, so the thread can be opened
/// without a lookup.
({String id, String name})? _sender(AppNotification n) {
  final id = n.data['senderId'] as String?;
  if (id == null || id.isEmpty) return null;
  return (id: id, name: n.data['senderName'] as String? ?? 'Message');
}

Future<void> _push(BuildContext context, Widget screen) {
  return Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => screen),
  );
}

/// Switches the shell's tab, then closes the notifications route so the user
/// actually sees it.
void _jumpToTab(BuildContext context, int index) {
  HomeShell.selectTab(index);
  final nav = Navigator.of(context);
  if (nav.canPop()) nav.pop();
}
