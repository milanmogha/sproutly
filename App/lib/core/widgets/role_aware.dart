import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Resolves role-accent colors at the widget tree level.
class RoleColors extends InheritedWidget {
  const RoleColors({
    super.key,
    required this.role,
    required super.child,
  });

  final UserRole role;

  Color get primary => AppColors.primaryForRole(role);
  Color get tint => AppColors.tintForRole(role);

  static RoleColors of(BuildContext context) {
    final rc = context.dependOnInheritedWidgetOfExactType<RoleColors>();
    assert(rc != null, 'RoleColors not found in widget tree');
    return rc!;
  }

  @override
  bool updateShouldNotify(RoleColors oldWidget) => oldWidget.role != role;
}
